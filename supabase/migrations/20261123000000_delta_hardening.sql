-- =============================================================================
-- Endurecimiento delta (auditoría nov-2026). Todo es aditivo e idempotente;
-- corre igual en producción (con datos) y en PGlite (pruebas, sin pg_cron).
--
--  1. Estadísticas agregadas en SQL: analytics_summary e item_performance.
--     PostgREST corta en 1000 filas (max_rows) y las lecturas por día e ítem
--     con .limit(5000|20000) devolvían totales incompletos en catálogos
--     grandes. SECURITY INVOKER: RLS aplica y además se exige ser miembro.
--  2. stale_pending_domains: dominios propios que llevan N días pendientes
--     sin verificarse (el cron los libera para que nadie «reserve» dominios).
--  3. purge_old_data llama a purge_analytics_data (el pg_cron diario no
--     limpiaba las tablas de analítica) y ambas usan la misma fecha UTC que
--     record_funnel / record_view / record_order_v2.
--  4. register_push_subscription ya no borra la suscripción de OTRO usuario
--     con el mismo endpoint: sólo reemplaza la propia; si el dispositivo es
--     de otra cuenta, `push_duplicate`.
--  5. prune_site_versions con tope total de bytes por sitio (50 MB): tras la
--     poda por cantidad, se borran las versiones automáticas más antiguas
--     hasta caber. Las versiones con nombre y la más reciente nunca se borran.
--  6. Dominio propio: businesses.custom_domain_apex (raíz registrable, única):
--     mitienda.com, www.mitienda.com y tienda.mitienda.com son del mismo negocio.
--  7. La función «Pedidos y clientes» apagada por el administrador también
--     aplica al sitio publicado: record_order_v2 no guarda copia ni teléfono,
--     claim_order_push no avisa y get_public_catalog publica orders_enabled.
--  8. save_site devuelve la versión nueva (site_version) en la misma
--     transacción: el editor ya no la relee en otro viaje.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Estadísticas agregadas en SQL
-- -----------------------------------------------------------------------------
-- Un solo JSONB (sin tope de filas) con lo que necesita el panel:
--   funnel      por día y origen (grano de la tabla; ≤ 13 orígenes por día)
--   orders      por día (pedidos, unidades, valor)
--   page_views  por día (visitas al sitio)
--   item_views  por día (fichas vistas, suma de todos los productos)
--   items       por producto: fichas vistas, veces agregado, unidades pedidas
--               desde p_items_since (por defecto p_since).
-- p_until por defecto es hoy (UTC, como se guardan los contadores).
create or replace function public.analytics_summary(p_business uuid, p_since date, p_until date default null, p_items_since date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_until date := coalesce(p_until, (now() at time zone 'utc')::date);
  v_items_since date := coalesce(p_items_since, p_since);
begin
  if p_business is null or p_since is null or not public.is_business_member(p_business) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'funnel', coalesce((
      select jsonb_agg(jsonb_build_object('day', f.day, 'source', f.source, 'sessions', f.sessions, 'viewed_product', f.viewed_product, 'started_cart', f.started_cart, 'sent_order', f.sent_order) order by f.day, f.source)
      from public.funnel_stats_daily f
      where f.business_id = p_business and f.day between p_since and v_until
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('day', o.day, 'orders', o.orders, 'units', o.units, 'value', o.value) order by o.day)
      from public.order_stats_daily o
      where o.business_id = p_business and o.day between p_since and v_until
    ), '[]'::jsonb),
    'page_views', coalesce((
      select jsonb_agg(jsonb_build_object('day', v.day, 'views', v.views) order by v.day)
      from public.site_view_stats_daily v
      where v.business_id = p_business and v.day between p_since and v_until
    ), '[]'::jsonb),
    'item_views', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views) order by d.day)
      from (
        select iv.day, sum(iv.views)::int as views
        from public.item_view_stats_daily iv
        where iv.business_id = p_business and iv.day between p_since and v_until
        group by iv.day
      ) d
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', i.item_id, 'views', i.views, 'adds', i.adds, 'units', i.units) order by i.item_id)
      from (
        select s.item_id, sum(s.views)::int as views, sum(s.adds)::int as adds, sum(s.units)::int as units
        from (
          select iv.item_id, iv.views, 0 as adds, 0 as units from public.item_view_stats_daily iv
           where iv.business_id = p_business and iv.day between v_items_since and v_until
          union all
          select ic.item_id, 0, ic.adds, 0 from public.item_cart_stats_daily ic
           where ic.business_id = p_business and ic.day between v_items_since and v_until
          union all
          select oi.item_id, 0, 0, oi.units from public.order_item_stats_daily oi
           where oi.business_id = p_business and oi.day between v_items_since and v_until
        ) s
        group by s.item_id
      ) i
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.analytics_summary(uuid, date, date, date) from public, anon;
grant execute on function public.analytics_summary(uuid, date, date, date) to authenticated;

-- Por producto, desde p_since (incluido) hasta hoy: fichas vistas, unidades
-- pedidas y veces agregado al pedido. Devuelve filas (ordenar por item_id y
-- paginar con range: PostgREST también corta las funciones en max_rows).
create or replace function public.item_performance(p_business uuid, p_since date)
returns table (item_id uuid, views int, units int, carts int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_business is null or p_since is null or not public.is_business_member(p_business) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select s.item_id, sum(s.views)::int, sum(s.units)::int, sum(s.carts)::int
    from (
      select iv.item_id, iv.views, 0 as units, 0 as carts from public.item_view_stats_daily iv
       where iv.business_id = p_business and iv.day >= p_since
      union all
      select oi.item_id, 0, oi.units, 0 from public.order_item_stats_daily oi
       where oi.business_id = p_business and oi.day >= p_since
      union all
      select ic.item_id, 0, 0, ic.adds from public.item_cart_stats_daily ic
       where ic.business_id = p_business and ic.day >= p_since
    ) s
    group by s.item_id
    order by s.item_id;
end;
$$;
revoke execute on function public.item_performance(uuid, date) from public, anon;
grant execute on function public.item_performance(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · Dominios pendientes vencidos (sólo service_role)
-- -----------------------------------------------------------------------------
-- Dominios agregados hace más de p_days días que siguen sin verificarse. El
-- cron semanal los quita de Vercel y libera la columna. Hasta 50 por corrida.
create or replace function public.stale_pending_domains(p_days int default 14)
returns table (business_id uuid, custom_domain text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.custom_domain
  from public.businesses b
  where b.custom_domain is not null
    and b.custom_domain_status = 'pending'
    and coalesce(b.custom_domain_checked_at, b.updated_at) < now() - make_interval(days => greatest(coalesce(p_days, 14), 1))
  order by coalesce(b.custom_domain_checked_at, b.updated_at)
  limit 50;
$$;
revoke execute on function public.stale_pending_domains(int) from public, anon, authenticated;
grant execute on function public.stale_pending_domains(int) to service_role;

-- -----------------------------------------------------------------------------
-- 3 · Retención: misma fecha UTC y purge_old_data incluye la analítica
-- -----------------------------------------------------------------------------
-- Igual que en 20261107000000_funnel_stats.sql, con el día en UTC (como record_funnel).
create or replace function public.purge_analytics_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_funnel integer;
  v_cart integer;
begin
  delete from public.funnel_stats_daily where day < v_today - 400;
  get diagnostics v_funnel = row_count;
  delete from public.item_cart_stats_daily where day < v_today - 400;
  get diagnostics v_cart = row_count;
  return jsonb_build_object('funnel_stats', v_funnel, 'item_cart_stats', v_cart);
end;
$$;
revoke execute on function public.purge_analytics_data() from public, anon, authenticated;
grant execute on function public.purge_analytics_data() to service_role;

-- Igual que en 20261102000000_hardening.sql, más purge_analytics_data() (sus
-- cuentas se suman al JSON devuelto) y el mismo día UTC para las estadísticas.
create or replace function public.purge_old_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_orders int; v_rate int; v_audit_old int; v_audit_content int; v_stats int := 0; v_notify int; v_rows int;
  v_analytics jsonb;
begin
  -- Datos personales de pedidos de TODOS los negocios (record_order_v2 sólo limpia el negocio que recibe un pedido).
  update public.orders
     set customer_name = null, address = null, note = null, personal_data_cleared = true
   where not personal_data_cleared and created_at < now() - interval '180 days';
  get diagnostics v_orders = row_count;

  delete from public.rate_limit_events where created_at < now() - interval '2 days';
  get diagnostics v_rate = row_count;

  delete from public.audit_log where created_at < now() - interval '2 years';
  get diagnostics v_audit_old = row_count;
  -- Ruido de contenido (cada edición de página/ítem/categoría/medio): 180 días.
  delete from public.audit_log
   where entity_type in ('catalog_pages', 'catalog_items', 'categories', 'media_assets')
     and created_at < now() - interval '180 days';
  get diagnostics v_audit_content = row_count;

  delete from public.order_stats_daily where day < v_today - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.order_item_stats_daily where day < v_today - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.site_view_stats_daily where day < v_today - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.item_view_stats_daily where day < v_today - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.search_miss_stats_daily where day < v_today - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;

  delete from public.notification_log where sent_at < now() - interval '90 days';
  get diagnostics v_notify = row_count;

  -- Analítica (recorrido y productos agregados): mismo plazo de 400 días.
  v_analytics := public.purge_analytics_data();

  return jsonb_build_object(
    'orders_cleared', v_orders, 'rate_limit_events', v_rate,
    'audit_log_old', v_audit_old, 'audit_log_content', v_audit_content,
    'daily_stats', v_stats, 'notification_log', v_notify
  ) || v_analytics;
end;
$$;
revoke execute on function public.purge_old_data() from public, anon, authenticated;
grant execute on function public.purge_old_data() to service_role;

-- -----------------------------------------------------------------------------
-- 4 · Avisos push: cada quien reemplaza sólo su propia suscripción
-- -----------------------------------------------------------------------------
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Volver a activar en el mismo dispositivo renueva las claves; la de OTRO usuario no se toca.
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = v_user;
  if (select count(*) from public.push_subscriptions where user_id = v_user) >= 10 then
    raise exception 'push_limit' using errcode = 'P0001';
  end if;
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
    values (v_user, p_endpoint, p_p256dh, p_auth, nullif(left(btrim(coalesce(p_device, '')), 120), ''))
    returning id into v_id;
  exception when unique_violation then
    -- El dispositivo tiene avisos de otra cuenta: esa cuenta debe desactivarlos primero.
    raise exception 'push_duplicate' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5 · Historial del sitio: tope total de bytes por catálogo
-- -----------------------------------------------------------------------------
-- Poda por cantidad (como en 20261104000000_site_versions.sql) y después por
-- tamaño: mientras la suma de las copias supere p_max_bytes se borran las
-- automáticas más antiguas. Nunca se borran las versiones con nombre ni la
-- más reciente (la que se acaba de registrar). El tamaño es `bytes` (lo fija
-- record_site_version); si es 0 (fila sembrada a mano) se mide la copia.
create or replace function public.prune_site_versions(p_catalog_id uuid, p_max_bytes bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_excess bigint;
begin
  delete from public.site_versions v
  where v.catalog_id = p_catalog_id
    and v.label is null
    and v.id not in (
      select r.id from public.site_versions r
      where r.catalog_id = p_catalog_id and r.label is null
      order by r.created_at desc
      limit 30
    )
    and (
      v.created_at < now() - interval '60 days'
      or exists (
        select 1 from public.site_versions w
        where w.catalog_id = p_catalog_id and w.label is null
          and w.created_at > v.created_at
          and date_trunc('day', w.created_at) = date_trunc('day', v.created_at)
      )
    );

  select coalesce(sum(case when v.bytes > 0 then v.bytes else octet_length(v.snapshot::text) end), 0) - p_max_bytes
    into v_excess
  from public.site_versions v
  where v.catalog_id = p_catalog_id;
  if v_excess <= 0 then
    return;
  end if;

  -- De la más antigua a la más nueva, hasta liberar el exceso.
  delete from public.site_versions v
  where v.id in (
    select s.id
    from (
      select a.id,
             sum(a.size) over (order by a.created_at, a.id) - a.size as freed_before
      from (
        select x.id, x.created_at, case when x.bytes > 0 then x.bytes else octet_length(x.snapshot::text) end::bigint as size
        from public.site_versions x
        where x.catalog_id = p_catalog_id and x.label is null
          and x.id <> (select n.id from public.site_versions n where n.catalog_id = p_catalog_id order by n.created_at desc, n.id limit 1)
      ) a
    ) s
    where s.freed_before < v_excess
  );
end;
$$;
revoke execute on function public.prune_site_versions(uuid, bigint) from public, anon, authenticated;

-- Misma firma que antes (la llama record_site_version): tope de 50 MB.
create or replace function public.prune_site_versions(p_catalog_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.prune_site_versions(p_catalog_id, (50 * 1024 * 1024)::bigint);
$$;
revoke execute on function public.prune_site_versions(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6 · Dominio propio: un dominio registrable por negocio (raíz, www y subdominios)
-- -----------------------------------------------------------------------------
-- El índice único de 20261109 compara el texto exacto: A conectaba mitienda.com
-- y B podía guardar www.mitienda.com (y al desconectarlo, borrar de Vercel el
-- dominio de A). custom_domain_apex guarda la raíz registrable (misma lista de
-- terminaciones de dos partes que lib/domains/domain.ts) y es única.
create or replace function public.domain_apex(p_domain text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with parts as (select string_to_array(lower(p_domain), '.') as labels)
  select case
    when array_length(labels, 1) >= 3 and array_to_string(labels[array_length(labels, 1) - 1 : array_length(labels, 1)], '.') in (
      'com.mx', 'org.mx', 'edu.mx', 'gob.mx', 'net.mx', 'com.ar', 'com.co', 'com.pe', 'com.ec', 'com.gt', 'com.uy', 'com.py', 'com.bo', 'com.ve',
      'com.sv', 'com.hn', 'com.ni', 'com.pa', 'com.do', 'com.cu', 'co.cr', 'fi.cr', 'com.br', 'com.es', 'co.uk', 'org.uk', 'com.au', 'co.nz'
    ) then array_to_string(labels[array_length(labels, 1) - 2 : array_length(labels, 1)], '.')
    when array_length(labels, 1) >= 2 then array_to_string(labels[array_length(labels, 1) - 1 : array_length(labels, 1)], '.')
    else lower(p_domain)
  end
  from parts;
$$;
grant execute on function public.domain_apex(text) to anon, authenticated, service_role;

alter table public.businesses add column if not exists custom_domain_apex text
  generated always as (public.domain_apex(custom_domain)) stored;
comment on column public.businesses.custom_domain_apex is 'Raíz registrable del dominio propio (mitienda.com para www.mitienda.com o tienda.mitienda.com): única entre negocios.';

-- Si en producción ya hubiera dos negocios con la misma raíz, el índice no se
-- puede crear: se avisa para resolverlo a mano (la app igual rechaza nuevos choques).
do $$
begin
  if exists (select 1 from public.businesses where custom_domain_apex is not null group by custom_domain_apex having count(*) > 1) then
    raise warning 'delta_hardening: hay negocios con la misma raíz de dominio propio; businesses_custom_domain_apex_key no se creó';
  else
    create unique index if not exists businesses_custom_domain_apex_key on public.businesses (custom_domain_apex) where custom_domain_apex is not null;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7 · La función «Pedidos y clientes» apagada por el administrador se respeta
--     también fuera del panel: sin copia en la bandeja, sin teléfono, sin aviso
-- -----------------------------------------------------------------------------
-- Igual que en 20261105000000_customers.sql; la bandeja efectiva es
-- settings.order.inbox Y la función `orders` del negocio (decisión del
-- administrador; sin decisión, encendida — como lib/plans/features.ts).
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

  select b.id, c.id,
         coalesce((c.settings -> 'order' ->> 'inbox')::boolean, true) and coalesce((b.feature_overrides ->> 'orders')::boolean, true)
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

-- Igual que en 20261106000000_push_notifications.sql, sólo si la función «Pedidos» está encendida.
create or replace function public.claim_order_push(p_business_slug text, p_reference text)
returns table (order_id uuid, business_id uuid, business_name text, reference text, customer_name text, items int, total numeric, currency text, partial boolean)
language sql
security definer
set search_path = ''
as $$
  update public.orders o
     set push_notified_at = now()
    from public.businesses b
   where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
     and coalesce((b.feature_overrides ->> 'orders')::boolean, true)
     and o.business_id = b.id
     and o.reference = p_reference
     and o.push_notified_at is null
     and o.created_at > now() - interval '10 minutes'
  returning o.id, b.id, b.name, o.reference, o.customer_name,
            (select coalesce(sum((l ->> 'qty')::int), 0)::int from jsonb_array_elements(o.lines) l),
            o.total, o.currency, o.partial;
$$;
revoke execute on function public.claim_order_push(text, text) from public, anon, authenticated;
grant execute on function public.claim_order_push(text, text) to service_role;

-- Igual que en 20261109000000_custom_domains.sql, más business.orders_enabled
-- (la función «Pedidos y clientes»): el sitio publicado no pide teléfono ni
-- promete copia en la bandeja cuando está apagada.
create or replace function public.get_public_catalog(p_business_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select b.*, coalesce((p.features ->> 'remove_branding')::boolean, false) as remove_branding,
      coalesce(b.custom_code, (p.features ->> 'custom_code')::boolean, false) as custom_code_enabled,
      coalesce((b.feature_overrides ->> 'custom_domain')::boolean, (p.features ->> 'custom_domain')::boolean, false) as custom_domain_enabled,
      coalesce((b.feature_overrides ->> 'orders')::boolean, true) as orders_enabled
    from public.businesses b
    join public.plans p on p.id = b.plan_id
    where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
  ),
  c as (
    select c.*
    from public.catalogs c
    join b on b.id = c.business_id
    where c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
    limit 1
  ),
  cats as (
    select cat.*
    from public.categories cat
    join c on c.id = cat.catalog_id
    where cat.is_active and cat.deleted_at is null
  ),
  items as (
    select i.*
    from public.catalog_items i
    join c on c.id = i.catalog_id
    where i.is_visible and i.deleted_at is null
      and (i.category_id is null or i.category_id in (select id from cats))
  ),
  pages as (
    select pg.*
    from public.catalog_pages pg
    join c on c.id = pg.catalog_id
    where pg.is_published and pg.deleted_at is null
  )
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'business', (
      select jsonb_build_object(
        'id', b.id, 'name', b.name, 'slug', b.slug, 'description', b.description, 'slogan', b.slogan,
        'logo_path', b.logo_path, 'contact', b.contact, 'social_links', b.social_links,
        'remove_branding', b.remove_branding, 'custom_code', b.custom_code_enabled, 'site_kind', b.site_kind,
        'custom_domain', case when b.custom_domain_status = 'active' and b.custom_domain_enabled then b.custom_domain end,
        'orders_enabled', b.orders_enabled
      ) from b
    ),
    'catalog', (select to_jsonb(c) - 'deleted_at' - 'pdf' - 'is_active' from c),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(cats) - 'deleted_at' order by cats.position, cats.created_at) from cats
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        (to_jsonb(items) - 'deleted_at') || jsonb_build_object('images', coalesce((
          select jsonb_agg(to_jsonb(im) order by im.position, im.created_at)
          from public.catalog_item_images im
          where im.item_id = items.id
        ), '[]'::jsonb))
        order by items.position, items.created_at
      ) from items
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(to_jsonb(pages) - 'deleted_at' order by pages.position, pages.created_at) from pages
    ), '[]'::jsonb)
  ) end;
$$;
grant execute on function public.get_public_catalog(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8 · save_site devuelve la versión nueva (el editor ya no la relee)
-- -----------------------------------------------------------------------------
-- Mismo cuerpo que en 20261102000000_hardening.sql; cambia el tipo devuelto
-- (void → timestamptz), por eso se elimina y se vuelve a crear. Los nombres de
-- los argumentos no cambian (PostgREST resuelve por nombre).
drop function if exists public.save_site(uuid, jsonb, jsonb, jsonb, uuid[], timestamptz);

create or replace function public.save_site(
  p_catalog_id uuid,
  p_theme jsonb default null,
  p_navigation jsonb default null,
  p_pages jsonb default null,
  p_deleted_page_ids uuid[] default '{}',
  p_expected_version timestamptz default null
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business uuid;
  v_count int;
  v_version timestamptz;
  v_new_home uuid;
begin
  select business_id into v_business
  from public.catalogs
  where id = p_catalog_id and deleted_at is null;
  if v_business is null then
    raise exception 'catalog_not_found' using errcode = 'P0001';
  end if;

  -- Un guardado a la vez por catálogo: la comparación de versión es exacta.
  perform pg_advisory_xact_lock(hashtextextended('site:' || p_catalog_id::text, 0));
  if p_expected_version is not null then
    v_version := public.site_version(p_catalog_id);
    if v_version is distinct from p_expected_version then
      raise exception 'site_changed' using errcode = 'P0001';
    end if;
  end if;

  if p_theme is not null or p_navigation is not null then
    update public.catalogs
       set theme = coalesce(p_theme, theme),
           navigation = coalesce(p_navigation, navigation)
     where id = p_catalog_id;
    if not found then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;

  if coalesce(array_length(p_deleted_page_ids, 1), 0) > 0 then
    update public.catalog_pages
       set deleted_at = now(), is_home = false
     where catalog_id = p_catalog_id and id = any (p_deleted_page_ids) and deleted_at is null;
  end if;

  if p_pages is not null then
    if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
      raise exception 'pages_required' using errcode = 'P0001';
    end if;
    if (select count(*) from jsonb_array_elements(p_pages) p where (p ->> 'is_home')::boolean) <> 1 then
      raise exception 'home_required' using errcode = 'P0001';
    end if;
    select (p ->> 'id')::uuid into v_new_home from jsonb_array_elements(p_pages) p where (p ->> 'is_home')::boolean;

    -- Paso 1 (transitorio, sin auditar): libera la marca de inicio si cambia de
    -- página y el slug de las páginas que cambian de slug, para permitir
    -- intercambios (A↔B) sin chocar con los índices únicos.
    perform set_config('vitrina.skip_audit', 'on', true);
    update public.catalog_pages cp
       set is_home = false
     where cp.catalog_id = p_catalog_id and cp.is_home and cp.deleted_at is null
       and cp.id is distinct from v_new_home;

    update public.catalog_pages cp
       set slug = 'tmp-' || replace(cp.id::text, '-', '')
      from jsonb_array_elements(p_pages) p
     where cp.catalog_id = p_catalog_id
       and cp.deleted_at is null
       and cp.id = (p ->> 'id')::uuid
       and cp.slug is distinct from (p ->> 'slug');
    perform set_config('vitrina.skip_audit', '', true);

    -- Paso 2: upsert con el orden recibido (auditado: sólo lo que cambió de verdad).
    insert into public.catalog_pages as cp
      (id, business_id, catalog_id, title, slug, template, is_home, is_published, position, sections, style, seo)
    select (p ->> 'id')::uuid, v_business, p_catalog_id,
           p ->> 'title', p ->> 'slug', coalesce(p ->> 'template', 'custom'),
           coalesce((p ->> 'is_home')::boolean, false), coalesce((p ->> 'is_published')::boolean, true),
           (ord - 1)::int,
           coalesce(p -> 'sections', '[]'::jsonb), coalesce(p -> 'style', '{}'::jsonb), coalesce(p -> 'seo', '{}'::jsonb)
      from jsonb_array_elements(p_pages) with ordinality as t(p, ord)
    on conflict (id) do update
       set title = excluded.title,
           slug = excluded.slug,
           template = excluded.template,
           is_home = excluded.is_home,
           is_published = excluded.is_published,
           position = excluded.position,
           sections = excluded.sections,
           style = excluded.style,
           seo = excluded.seo,
           deleted_at = null
     where cp.catalog_id = p_catalog_id;

    -- Un id que pertenece a otro catálogo no se actualiza: se reporta como error.
    get diagnostics v_count = row_count;
    if v_count <> jsonb_array_length(p_pages) then
      raise exception 'page_conflict' using errcode = 'P0001';
    end if;
  end if;

  -- La versión que quedó guardada (misma transacción): el editor la usa para el siguiente guardado.
  return public.site_version(p_catalog_id);
end;
$$;

revoke execute on function public.save_site(uuid, jsonb, jsonb, jsonb, uuid[], timestamptz) from public, anon;
grant execute on function public.save_site(uuid, jsonb, jsonb, jsonb, uuid[], timestamptz) to authenticated;
