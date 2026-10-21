-- =============================================================================
-- Bandeja de pedidos: además de los contadores (order_stats), cada pedido que
-- el visitante envía por WhatsApp queda como copia en el panel del negocio
-- para darle seguimiento (nuevo → confirmado → listo → entregado/cancelado).
--
-- · Escritura del pedido: sólo record_order_v2() con la service role (la
--   llama /api/orders con límite por IP). Valida el negocio como record_order
--   y sólo guarda si el negocio tiene la bandeja activa (settings.order.inbox,
--   activa por defecto). Las líneas guardan el producto sólo si es de ese
--   catálogo. Los importes son los del pedido que vio el cliente (el mismo
--   mensaje que llega por WhatsApp): por eso el pedido entra como "nuevo",
--   para que el negocio lo confirme.
-- · Datos personales mínimos (nombre si lo dio, dirección sólo a domicilio,
--   nota) y se borran solos a los 180 días; el pedido (folio, productos,
--   importes, estado) se conserva para el historial.
-- · Miembros: leen y cambian el estado (set_order_status, que también
--   descuenta o devuelve existencias si el negocio lo activó); los dueños y
--   administradores pueden borrar un pedido.
-- =============================================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  reference text not null check (reference ~ '^[A-Z0-9]{4,8}$'),
  status text not null default 'new' check (status in ('new', 'confirmed', 'ready', 'delivered', 'cancelled')),
  customer_name text check (char_length(customer_name) <= 80),
  fulfillment text check (fulfillment in ('pickup', 'delivery', 'table')),
  address text check (char_length(address) <= 300),
  zone text check (char_length(zone) <= 60),
  branch text check (char_length(branch) <= 60),
  table_label text check (char_length(table_label) <= 20),
  scheduled_for text check (char_length(scheduled_for) <= 40),
  payment text check (char_length(payment) <= 20),
  note text check (char_length(note) <= 500),
  coupon text check (char_length(coupon) <= 24),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 50 and pg_column_size(lines) <= 60000),
  currency text not null default '' check (char_length(currency) <= 3),
  subtotal numeric(14, 2) check (subtotal between 0 and 99999999),
  discount numeric(14, 2) check (discount between 0 and 99999999),
  delivery_fee numeric(14, 2) check (delivery_fee between 0 and 99999999),
  tip numeric(14, 2) check (tip between 0 and 99999999),
  total numeric(14, 2) check (total between 0 and 99999999),
  -- Algún producto sin precio o en otra moneda: el total es parcial.
  partial boolean not null default false,
  stock_applied boolean not null default false,
  personal_data_cleared boolean not null default false,
  created_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);
create index if not exists orders_business_created_idx on public.orders (business_id, created_at desc);
-- El folio (4 caracteres) se repite con el tiempo: no es único; sólo evita duplicados del mismo envío.
create index if not exists orders_business_reference_idx on public.orders (business_id, reference, created_at desc);
create index if not exists orders_business_status_idx on public.orders (business_id, status);

alter table public.orders enable row level security;
revoke all on public.orders from public, anon, authenticated;
grant select, delete on public.orders to authenticated;

create policy "orders: members read" on public.orders
  for select to authenticated using (public.is_business_member(business_id));
create policy "orders: owners and admins delete" on public.orders
  for delete to authenticated using (public.has_business_role(business_id, array['owner', 'admin']));

-- -----------------------------------------------------------------------------
-- Registro del pedido (contadores + copia en la bandeja).
-- p_order: {"reference": "K7Q2", "customerName": "", "fulfillment": "pickup|delivery|table",
--   "address": "", "zone": "", "branch": "", "table": "", "when": "", "payment": "", "note": "",
--   "coupon": "", "currency": "MXN", "subtotal": 0, "discount": 0, "deliveryFee": 0, "tip": 0,
--   "total": 0, "partial": false,
--   "lines": [{"itemId": "<uuid>", "name": "", "variant": "", "qty": 1, "unitPrice": 0, "note": ""}]}
-- -----------------------------------------------------------------------------
create or replace function public.record_order_v2(p_business_slug text, p_items jsonb, p_order jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counted boolean;
  v_business uuid;
  v_catalog uuid;
  v_inbox boolean;
  v_lines jsonb;
  v_fulfillment text;
  v_amount numeric;
begin
  v_counted := public.record_order(p_business_slug, p_items);
  if not v_counted or p_order is null or jsonb_typeof(p_order) <> 'object' then
    return v_counted;
  end if;

  select b.id, c.id, coalesce((c.settings -> 'order' ->> 'inbox')::boolean, true)
    into v_business, v_catalog, v_inbox
  from public.businesses b
  join public.catalogs c on c.business_id = b.id
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  limit 1;
  if v_business is null or not v_inbox or coalesce(p_order ->> 'reference', '') !~ '^[A-Z0-9]{4,8}$'
     or jsonb_typeof(p_order -> 'lines') <> 'array' then
    return v_counted;
  end if;

  -- La copia en la bandeja nunca debe deshacer los contadores: si algo falla, se omite.
  begin
    -- Líneas: texto acotado, cantidades 1–99, importes ≥ 0; el producto sólo si es de este catálogo.
    select jsonb_agg(jsonb_build_object(
             -- CASE: el cast a uuid sólo se evalúa si el texto tiene forma de uuid.
             'itemId', case when coalesce(l ->> 'itemId', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
                         (select i.id from public.catalog_items i where i.id = (l ->> 'itemId')::uuid and i.business_id = v_business and i.catalog_id = v_catalog)
                       end,
             'name', left(coalesce(l ->> 'name', ''), 160),
             'variant', left(coalesce(l ->> 'variant', ''), 120),
             'qty', least(greatest((l ->> 'qty')::integer, 1), 99),
             'unitPrice', case when jsonb_typeof(l -> 'unitPrice') = 'number' then least(greatest((l ->> 'unitPrice')::numeric, 0), 99999999) end,
             'note', left(coalesce(l ->> 'note', ''), 200)))
      into v_lines
    from (select l from jsonb_array_elements(p_order -> 'lines') l where jsonb_typeof(l) = 'object' limit 50) s(l)
    where coalesce(l ->> 'name', '') <> '' and coalesce(l ->> 'qty', '') ~ '^[0-9]{1,3}$';
    if v_lines is null then
      return v_counted;
    end if;

    -- El mismo folio en las últimas 24 h (el cliente volvió a tocar "Enviar"): un solo pedido.
    -- El bloqueo evita que dos avisos simultáneos del mismo envío entren los dos.
    perform pg_advisory_xact_lock(hashtextextended(v_business::text || ':' || (p_order ->> 'reference'), 0));
    if exists (select 1 from public.orders o where o.business_id = v_business and o.reference = p_order ->> 'reference' and o.created_at > now() - interval '24 hours') then
      return v_counted;
    end if;

    v_fulfillment := case when p_order ->> 'fulfillment' in ('pickup', 'delivery', 'table') then p_order ->> 'fulfillment' end;

    insert into public.orders (business_id, reference, customer_name, fulfillment, address, zone, branch, table_label, scheduled_for, payment, note, coupon,
                               lines, currency, subtotal, discount, delivery_fee, tip, total, partial)
    values (
      v_business,
      p_order ->> 'reference',
      nullif(left(btrim(coalesce(p_order ->> 'customerName', '')), 80), ''),
      v_fulfillment,
      case when v_fulfillment = 'delivery' then nullif(left(btrim(coalesce(p_order ->> 'address', '')), 300), '') end,
      nullif(left(btrim(coalesce(p_order ->> 'zone', '')), 60), ''),
      nullif(left(btrim(coalesce(p_order ->> 'branch', '')), 60), ''),
      case when v_fulfillment = 'table' then nullif(left(btrim(coalesce(p_order ->> 'table', '')), 20), '') end,
      nullif(left(btrim(coalesce(p_order ->> 'when', '')), 40), ''),
      nullif(left(btrim(coalesce(p_order ->> 'payment', '')), 20), ''),
      nullif(left(btrim(coalesce(p_order ->> 'note', '')), 500), ''),
      nullif(left(upper(btrim(coalesce(p_order ->> 'coupon', ''))), 24), ''),
      v_lines,
      left(coalesce(p_order ->> 'currency', ''), 3),
      case when jsonb_typeof(p_order -> 'subtotal') = 'number' then least(greatest((p_order ->> 'subtotal')::numeric, 0), 99999999) end,
      case when jsonb_typeof(p_order -> 'discount') = 'number' then least(greatest((p_order ->> 'discount')::numeric, 0), 99999999) end,
      case when jsonb_typeof(p_order -> 'deliveryFee') = 'number' then least(greatest((p_order ->> 'deliveryFee')::numeric, 0), 99999999) end,
      case when jsonb_typeof(p_order -> 'tip') = 'number' then least(greatest((p_order ->> 'tip')::numeric, 0), 99999999) end,
      case when jsonb_typeof(p_order -> 'total') = 'number' then least(greatest((p_order ->> 'total')::numeric, 0), 99999999) end,
      case when jsonb_typeof(p_order -> 'partial') = 'boolean' then (p_order ->> 'partial')::boolean else false end
    );

    -- Retención: los datos de quien pidió se borran a los 180 días (el pedido queda).
    update public.orders
    set customer_name = null, address = null, note = null, personal_data_cleared = true
    where business_id = v_business and not personal_data_cleared and created_at < now() - interval '180 days';
  exception when others then
    raise warning 'record_order_v2: pedido no guardado en la bandeja (%)', sqlstate;
  end;

  return v_counted;
end;
$$;
revoke execute on function public.record_order_v2(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_order_v2(text, jsonb, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Cambio de estado. Con "descontar existencias" activo, confirmar descuenta
-- (sin bajar de 0) y cancelar un pedido ya descontado las devuelve.
-- -----------------------------------------------------------------------------
create or replace function public.set_order_status(p_order uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_stock boolean;
  v_sign integer := 0;
begin
  if p_status not in ('new', 'confirmed', 'ready', 'delivered', 'cancelled') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null or not public.is_business_member(v_order.business_id) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status = p_status then
    return p_status;
  end if;

  select coalesce((c.settings -> 'order' ->> 'inboxStock')::boolean, false) into v_stock
  from public.catalogs c where c.business_id = v_order.business_id and c.is_default and c.deleted_at is null limit 1;

  if coalesce(v_stock, false) and not v_order.stock_applied and p_status in ('confirmed', 'ready', 'delivered') then
    v_sign := -1;
  elsif v_order.stock_applied and p_status in ('new', 'cancelled') then
    v_sign := 1;
  end if;

  if v_sign <> 0 then
    update public.catalog_items i
    set attributes = jsonb_set(i.attributes, '{stock}', to_jsonb(greatest(0, round((i.attributes ->> 'stock')::numeric)::integer + v_sign * q.qty)))
    from (
      select (l ->> 'itemId')::uuid as item_id, sum((l ->> 'qty')::integer) as qty
      from jsonb_array_elements(v_order.lines) l
      where (l ->> 'itemId') is not null
      group by 1
    ) q
    where i.id = q.item_id and i.business_id = v_order.business_id
      and jsonb_typeof(i.attributes -> 'stock') = 'number';
  end if;

  update public.orders
  set status = p_status,
      status_changed_at = now(),
      stock_applied = case when v_sign = -1 then true when v_sign = 1 then false else stock_applied end
  where id = p_order;
  return p_status;
end;
$$;
revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;
