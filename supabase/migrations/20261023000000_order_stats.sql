-- =============================================================================
-- Uso del pedido por WhatsApp: cuántos pedidos se envían por día y qué
-- productos se piden. Sólo contadores agregados por negocio y día (UTC): no se
-- guarda nada del visitante (ni nombre, ni nota, ni IP, ni el mensaje).
--
-- Escritura: únicamente record_order(), ejecutable sólo con la service role.
-- La llama /api/orders después del límite de intentos por IP. La función
-- valida todo en la base: negocio activo con catálogo publicado y pedidos
-- activos; cuenta sólo productos visibles y disponibles de ese catálogo, y el
-- valor sale de los precios del catálogo (nunca de lo que mande el navegador).
-- Lectura: los miembros del negocio (RLS). Sólo agrega tablas y una función.
-- =============================================================================

create table if not exists public.order_stats_daily (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  orders integer not null default 0 check (orders >= 0),
  units integer not null default 0 check (units >= 0),
  -- Valor estimado: suma de cantidad × precio del catálogo (moneda del catálogo).
  value numeric(14, 2) not null default 0 check (value >= 0),
  primary key (business_id, day)
);

create table if not exists public.order_item_stats_daily (
  business_id uuid not null,
  day date not null,
  item_id uuid not null,
  orders integer not null default 0 check (orders >= 0),
  units integer not null default 0 check (units >= 0),
  primary key (business_id, day, item_id),
  foreign key (item_id, business_id) references public.catalog_items (id, business_id) on delete cascade
);
create index if not exists order_item_stats_daily_item_idx on public.order_item_stats_daily (item_id, business_id);

alter table public.order_stats_daily enable row level security;
alter table public.order_item_stats_daily enable row level security;
revoke all on public.order_stats_daily, public.order_item_stats_daily from public, anon, authenticated;
grant select on public.order_stats_daily, public.order_item_stats_daily to authenticated;

create policy "order stats: members read" on public.order_stats_daily
  for select to authenticated using (public.is_business_member(business_id));
create policy "order item stats: members read" on public.order_item_stats_daily
  for select to authenticated using (public.is_business_member(business_id));

-- Registra un pedido enviado. p_items: [{"id": "<uuid>", "qty": 1..99}, …] (hasta 50).
-- Devuelve false (sin registrar nada) si el pedido no es válido.
create or replace function public.record_order(p_business_slug text, p_items jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_catalog uuid;
  v_enabled boolean;
  v_units integer;
  v_day date := (now() at time zone 'utc')::date;
begin
  if p_business_slug is null or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    return false;
  end if;

  -- Mismo criterio que el sitio público (get_public_catalog).
  select b.id, c.id, coalesce((c.settings -> 'order' ->> 'enabled')::boolean, false)
    into v_business, v_catalog, v_enabled
  from public.businesses b
  join public.catalogs c on c.business_id = b.id
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  limit 1;
  if v_business is null or not v_enabled then
    return false;
  end if;

  -- Una sola sentencia: líneas válidas → contadores por producto → contador del día.
  -- Ids repetidos se suman; cantidades entre 1 y 99; lo demás se descarta.
  with requested as (
    select (e ->> 'id')::uuid as item_id, least(greatest((e ->> 'qty')::integer, 1), 99) as qty
    from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) = 'object'
      and (e ->> 'id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and (e ->> 'qty') ~ '^[0-9]{1,3}$'
  ),
  lines as (
    select i.id as item_id, least(sum(r.qty), 99)::integer as qty, max(i.price) as price
    from requested r
    join public.catalog_items i on i.id = r.item_id
    where i.business_id = v_business and i.catalog_id = v_catalog and i.type = 'product'
      and i.is_visible and i.is_available and i.deleted_at is null
    group by i.id
  ),
  per_item as (
    insert into public.order_item_stats_daily (business_id, day, item_id, orders, units)
    select v_business, v_day, item_id, 1, qty from lines
    on conflict (business_id, day, item_id) do update
      set orders = public.order_item_stats_daily.orders + 1,
          units = public.order_item_stats_daily.units + excluded.units
    returning 1
  )
  insert into public.order_stats_daily (business_id, day, orders, units, value)
  select v_business, v_day, 1, sum(qty), coalesce(sum(qty * price), 0)
  from lines
  having count(*) > 0
  on conflict (business_id, day) do update
    set orders = public.order_stats_daily.orders + 1,
        units = public.order_stats_daily.units + excluded.units,
        value = public.order_stats_daily.value + excluded.value
  returning units into v_units;

  return v_units is not null;
end;
$$;

revoke execute on function public.record_order(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_order(text, jsonb) to service_role;
