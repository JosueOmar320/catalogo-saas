-- =============================================================================
-- Clientes: el pedido guarda (si el cliente lo da) su WhatsApp, y el panel
-- arma la lista de clientes con los pedidos de la bandeja.
--
-- · orders.customer_phone: opcional, sólo dígitos (y "+" inicial). Es un dato
--   personal más: se borra a los 180 días con el nombre, la dirección y la
--   nota (trigger sobre personal_data_cleared, así aplica en record_order_v2
--   y en purge_old_data sin cambiarlas).
-- · orders.customer_key: a quién pertenece el pedido. Con teléfono, sus
--   últimos 10 dígitos (el mismo número con o sin lada internacional); sin
--   teléfono, el nombre en minúsculas. Sin ninguno de los dos, null.
-- · customer_summaries: vista con los permisos de quien consulta (RLS de
--   orders: sólo los miembros del negocio).
-- =============================================================================

alter table public.orders add column if not exists customer_phone text check (customer_phone ~ '^\+?[0-9]{8,15}$');
alter table public.orders add column if not exists customer_key text generated always as (
  case
    when customer_phone is not null then 'tel:' || right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10)
    when nullif(btrim(customer_name), '') is not null then 'name:' || lower(btrim(customer_name))
  end
) stored;
create index if not exists orders_business_customer_idx on public.orders (business_id, customer_key) where customer_key is not null;

-- Al borrar los datos personales de un pedido, también el teléfono.
create or replace function public.orders_clear_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.personal_data_cleared then
    new.customer_phone := null;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_clear_phone on public.orders;
create trigger orders_clear_phone before insert or update of personal_data_cleared on public.orders
  for each row execute function public.orders_clear_phone();
-- Pedidos ya limpiados (por si alguno tuviera teléfono).
update public.orders set customer_phone = null where personal_data_cleared and customer_phone is not null;

-- -----------------------------------------------------------------------------
-- Registro del pedido: igual que en 20261031000000_orders_inbox, más el teléfono
-- ("customerPhone" en p_order).
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
  v_phone text;
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
    -- Teléfono: sólo dígitos (y "+" inicial); si no parece un número, no se guarda.
    v_phone := left(coalesce(p_order ->> 'customerPhone', ''), 30);
    v_phone := case when btrim(v_phone) like '+%' then '+' else '' end || regexp_replace(v_phone, '[^0-9]', '', 'g');
    v_phone := case when v_phone ~ '^\+?[0-9]{8,15}$' then v_phone end;

    insert into public.orders (business_id, reference, customer_name, customer_phone, fulfillment, address, zone, branch, table_label, scheduled_for, payment, note, coupon,
                               lines, currency, subtotal, discount, delivery_fee, tip, total, partial)
    values (
      v_business,
      p_order ->> 'reference',
      nullif(left(btrim(coalesce(p_order ->> 'customerName', '')), 80), ''),
      v_phone,
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
-- Clientes del negocio, a partir de los pedidos (los cancelados no suman).
-- -----------------------------------------------------------------------------
create or replace view public.customer_summaries with (security_invoker = true) as
select
  o.business_id,
  o.customer_key as key,
  (array_agg(o.customer_name order by o.created_at desc) filter (where o.customer_name is not null))[1] as name,
  (array_agg(o.customer_phone order by o.created_at desc) filter (where o.customer_phone is not null))[1] as phone,
  (count(*) filter (where o.status <> 'cancelled'))::int as orders,
  (count(*) filter (where o.status = 'delivered'))::int as delivered,
  coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::numeric(14, 2) as spent,
  (array_agg(o.currency order by o.created_at desc))[1] as currency,
  min(o.created_at) as first_order_at,
  max(o.created_at) as last_order_at
from public.orders o
where o.customer_key is not null
group by o.business_id, o.customer_key;

revoke all on public.customer_summaries from public, anon;
grant select on public.customer_summaries to authenticated;
