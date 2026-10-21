-- =============================================================================
-- Endurecimiento (auditoría oct-2026). Todo es aditivo e idempotente; corre
-- igual en producción (con datos) y en PGlite (pruebas, sin pg_cron).
--
--  1. set_order_status devolvía más existencias de las que descontó (el
--     descuento se topaba en 0 pero la devolución sumaba la cantidad pedida).
--     Ahora orders.stock_deltas guarda cuánto se descontó por producto y se
--     devuelve exactamente eso.
--  2. save_site con control de concurrencia optimista: p_expected_version
--     (= site_version(catálogo)) y error `site_changed` si otra persona guardó
--     en medio. Se elimina la firma de 5 argumentos (PostgREST no resuelve
--     firmas ambiguas por nombre).
--  3. Menos ruido en audit_log: los pasos transitorios de save_site (slug
--     temporal / quitar la marca de inicio) no se auditan y sólo se tocan las
--     páginas que realmente cambian de slug o de inicio.
--  4. Retención: purge_old_data() (sólo service_role) limpia datos personales
--     de pedidos, intentos de rate limit, auditoría vieja, estadísticas
--     diarias y el registro de avisos. Se programa con pg_cron si existe;
--     además la ruta /api/cron/catalog-review la llamará (lo cablea otra
--     tarea) — la función es segura de llamar cuantas veces haga falta.
--  5. Se elimina la política "profiles: team read": exponía email, rol de
--     plataforma, estado y último acceso de los compañeros y la app nunca
--     lista al equipo.
--  6. Topes de tamaño en las columnas JSONB que los miembros escriben por la
--     API (NOT VALID + VALIDATE; si alguna fila existente excede el tope, el
--     VALIDATE avisa y la restricción queda NOT VALID: sigue aplicando a lo
--     nuevo).
--  7. Privilegios por columna: business_id / catalog_id / item_id no pueden
--     cambiar por la API en categories, catalog_items, catalog_item_images y
--     catalog_pages.
--  8. Candados en los triggers de límite por plan (dos inserciones simultáneas
--     ya no pasan el último cupo).
--  9. admin_create_catalog respeta max_catalogs del plan.
-- 10. get_public_reviews sólo muestra reseñas de productos del catálogo
--     publicado (no de otro catálogo del negocio).
-- 11. replace_media_references valida la forma de las rutas (evita inyectar
--     texto arbitrario en el JSON del sitio).
-- 12. get_public_catalog publica business.site_kind. Se elimina la función
--     muerta create_business.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3 · Auditoría: interruptor local a la transacción (vitrina.skip_audit)
-- -----------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_changed jsonb := '[]'::jsonb;
  v_business uuid;
  v_entity text;
begin
  -- Pasos transitorios (p. ej. el slug temporal de save_site): no son un cambio real.
  if coalesce(current_setting('vitrina.skip_audit', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key)
      and n.key not in ('updated_at', 'last_login_at');
    if jsonb_array_length(v_changed) = 0 then
      return null;
    end if;
  end if;

  v_business := case
    when tg_table_name = 'businesses' then (v_row ->> 'id')::uuid
    when v_row ? 'business_id' then (v_row ->> 'business_id')::uuid
    else null
  end;
  v_entity := case
    when tg_table_name = 'business_members' then (v_row ->> 'business_id') || ':' || (v_row ->> 'user_id')
    else v_row ->> 'id'
  end;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, business_id, metadata)
  values (
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_entity,
    v_business,
    case
      when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed)
      when tg_table_name = 'business_members' then jsonb_build_object('role', v_row ->> 'role')
      when v_row ? 'name' then jsonb_build_object('name', v_row ->> 'name')
      when v_row ? 'title' then jsonb_build_object('title', v_row ->> 'title')
      when v_row ? 'username' then jsonb_build_object('username', v_row ->> 'username')
      else '{}'::jsonb
    end
  );
  return null;
end;
$$;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2 · Versión del sitio y save_site con control de concurrencia
-- -----------------------------------------------------------------------------
-- La versión es la última modificación del catálogo o de cualquiera de sus
-- páginas (también las borradas lógicamente: así un borrado también la
-- avanza). SECURITY INVOKER: sólo se ve lo que RLS permite.
create or replace function public.site_version(p_catalog_id uuid)
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select greatest(c.updated_at, (select max(p.updated_at) from public.catalog_pages p where p.catalog_id = c.id))
  from public.catalogs c
  where c.id = p_catalog_id and c.deleted_at is null;
$$;
revoke execute on function public.site_version(uuid) from public, anon;
grant execute on function public.site_version(uuid) to authenticated;

drop function if exists public.save_site(uuid, jsonb, jsonb, jsonb, uuid[]);

-- p_expected_version: la versión que el editor cargó (site_version). Si otra
-- persona guardó después, `site_changed`. null = sin verificación.
create or replace function public.save_site(
  p_catalog_id uuid,
  p_theme jsonb default null,
  p_navigation jsonb default null,
  p_pages jsonb default null,
  p_deleted_page_ids uuid[] default '{}',
  p_expected_version timestamptz default null
)
returns void
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
end;
$$;

revoke execute on function public.save_site(uuid, jsonb, jsonb, jsonb, uuid[], timestamptz) from public, anon;
grant execute on function public.save_site(uuid, jsonb, jsonb, jsonb, uuid[], timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 1 · Existencias: se devuelve exactamente lo que se descontó
-- -----------------------------------------------------------------------------
-- {"<item_id>": <cantidad descontada>} del último descuento (vacío si no hay).
alter table public.orders add column if not exists stock_deltas jsonb not null default '{}'::jsonb;
comment on column public.orders.stock_deltas is 'Existencias descontadas por producto al confirmar (se devuelven tal cual al cancelar).';

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
  v_deltas jsonb := '{}'::jsonb;
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

  if v_sign = -1 then
    -- Cuánto se puede descontar de verdad por producto (nunca por debajo de 0).
    select coalesce(jsonb_object_agg(s.item_id, s.applied), '{}'::jsonb) into v_deltas
    from (
      select i.id as item_id,
             least(q.qty, greatest(round((i.attributes ->> 'stock')::numeric)::integer, 0)) as applied
      from (
        select (l ->> 'itemId')::uuid as item_id, sum((l ->> 'qty')::integer)::integer as qty
        from jsonb_array_elements(v_order.lines) l
        where (l ->> 'itemId') is not null
        group by 1
      ) q
      join public.catalog_items i on i.id = q.item_id and i.business_id = v_order.business_id
      where jsonb_typeof(i.attributes -> 'stock') = 'number'
      for update of i
    ) s;

    update public.catalog_items i
       set attributes = jsonb_set(i.attributes, '{stock}', to_jsonb(round((i.attributes ->> 'stock')::numeric)::integer - d.applied))
      from (select key::uuid as item_id, value::integer as applied from jsonb_each_text(v_deltas)) d
     where i.id = d.item_id and i.business_id = v_order.business_id and d.applied > 0
       and jsonb_typeof(i.attributes -> 'stock') = 'number';
  elsif v_sign = 1 then
    -- Pedidos descontados antes de esta migración (sin registro): se devuelve lo pedido, como antes.
    if v_order.stock_deltas = '{}'::jsonb then
      select coalesce(jsonb_object_agg(q.item_id, q.qty), '{}'::jsonb) into v_deltas
      from (
        select (l ->> 'itemId')::uuid as item_id, sum((l ->> 'qty')::integer)::integer as qty
        from jsonb_array_elements(v_order.lines) l
        where (l ->> 'itemId') is not null
        group by 1
      ) q;
    else
      v_deltas := v_order.stock_deltas;
    end if;

    update public.catalog_items i
       set attributes = jsonb_set(i.attributes, '{stock}', to_jsonb(round((i.attributes ->> 'stock')::numeric)::integer + d.applied))
      from (select key::uuid as item_id, value::integer as applied from jsonb_each_text(v_deltas)) d
     where i.id = d.item_id and i.business_id = v_order.business_id and d.applied > 0
       and jsonb_typeof(i.attributes -> 'stock') = 'number';
  end if;

  update public.orders
     set status = p_status,
         status_changed_at = now(),
         stock_applied = case when v_sign = -1 then true when v_sign = 1 then false else stock_applied end,
         stock_deltas = case when v_sign = -1 then v_deltas when v_sign = 1 then '{}'::jsonb else stock_deltas end
   where id = p_order;
  return p_status;
end;
$$;
revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4 · Retención
-- -----------------------------------------------------------------------------
create index if not exists rate_limit_events_created_idx on public.rate_limit_events (created_at);
create index if not exists notification_log_kind_sent_idx on public.notification_log (kind, sent_at desc);
create index if not exists catalog_items_business_live_idx on public.catalog_items (business_id) where deleted_at is null;

-- Sólo service_role (pg_cron o la ruta de cron del servidor). Devuelve cuántas
-- filas tocó cada paso. Se puede llamar las veces que sea: lo ya limpio no cambia.
create or replace function public.purge_old_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orders int; v_rate int; v_audit_old int; v_audit_content int; v_stats int := 0; v_notify int; v_rows int;
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

  delete from public.order_stats_daily where day < current_date - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.order_item_stats_daily where day < current_date - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.site_view_stats_daily where day < current_date - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.item_view_stats_daily where day < current_date - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;
  delete from public.search_miss_stats_daily where day < current_date - 400;
  get diagnostics v_rows = row_count; v_stats := v_stats + v_rows;

  delete from public.notification_log where sent_at < now() - interval '90 days';
  get diagnostics v_notify = row_count;

  return jsonb_build_object(
    'orders_cleared', v_orders, 'rate_limit_events', v_rate,
    'audit_log_old', v_audit_old, 'audit_log_content', v_audit_content,
    'daily_stats', v_stats, 'notification_log', v_notify
  );
end;
$$;
revoke execute on function public.purge_old_data() from public, anon, authenticated;
grant execute on function public.purge_old_data() to service_role;

-- Diario a las 04:15 UTC si pg_cron está instalado (en PGlite no lo está).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$select cron.schedule('vitrina-purge-old-data', '15 4 * * *', 'select public.purge_old_data()')$cron$;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5 · Perfiles: nadie lee los perfiles de sus compañeros por la API
-- -----------------------------------------------------------------------------
drop policy if exists "profiles: team read" on public.profiles;

-- -----------------------------------------------------------------------------
-- 6 · Topes de tamaño en JSONB escribible por la API
-- -----------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('catalogs',      'catalogs_theme_size_check',          'pg_column_size(theme) <= 307200'),
      ('catalogs',      'catalogs_settings_size_check',       'pg_column_size(settings) <= 102400'),
      ('catalogs',      'catalogs_seo_size_check',            'pg_column_size(seo) <= 20480'),
      ('catalogs',      'catalogs_navigation_size_check',     'pg_column_size(navigation) <= 51200'),
      ('catalogs',      'catalogs_pdf_size_check',            'pg_column_size(pdf) <= 204800'),
      ('catalog_items', 'catalog_items_attributes_size_check','pg_column_size(attributes) <= 102400'),
      ('catalog_items', 'catalog_items_tags_count_check',     'cardinality(tags) <= 30'),
      ('businesses',    'businesses_contact_size_check',      'pg_column_size(contact) <= 20480'),
      ('businesses',    'businesses_social_links_size_check', 'pg_column_size(social_links) <= 10240')
    ) as v(tbl, name, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name and conrelid = ('public.' || c.tbl)::regclass) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
    end if;
    -- Si una fila existente ya excede el tope, la restricción queda NOT VALID
    -- (aplica a escrituras nuevas) y se avisa para revisarla a mano.
    begin
      execute format('alter table public.%I validate constraint %I', c.tbl, c.name);
    exception when check_violation then
      raise warning 'hardening: la restricción % no se pudo validar (hay filas que la exceden); queda NOT VALID', c.name;
    end;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7 · Privilegios por columna: las claves de pertenencia no cambian por la API
-- -----------------------------------------------------------------------------
revoke update on public.categories from anon, authenticated;
grant update (name, description, image_path, position, is_active, deleted_at) on public.categories to authenticated;

revoke update on public.catalog_items from anon, authenticated;
grant update (category_id, type, name, slug, short_description, description, price, compare_at_price, currency,
              price_note, sku, is_available, is_featured, is_visible, position, tags, attributes, deleted_at)
  on public.catalog_items to authenticated;

revoke update on public.catalog_item_images from anon, authenticated;
grant update (storage_path, thumb_path, width, height, size_bytes, mime_type, alt, position) on public.catalog_item_images to authenticated;

revoke update on public.catalog_pages from anon, authenticated;
grant update (title, slug, template, is_home, is_published, position, sections, style, seo, deleted_at) on public.catalog_pages to authenticated;

-- -----------------------------------------------------------------------------
-- 8 · Límites por plan: candado por negocio/ítem antes de contar
-- -----------------------------------------------------------------------------
create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := public.plan_limit(new.business_id, 'max_items');
begin
  if v_limit is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('items:' || new.business_id::text, 0));
  if (
    select count(*) from public.catalog_items
    where business_id = new.business_id and deleted_at is null
  ) >= v_limit then
    raise exception 'plan_limit_reached:max_items' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_item_limit() from public, anon, authenticated;

create or replace function public.enforce_image_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := public.plan_limit(new.business_id, 'max_images_per_item');
begin
  if v_limit is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('images:' || new.item_id::text, 0));
  if (
    select count(*) from public.catalog_item_images where item_id = new.item_id
  ) >= v_limit then
    raise exception 'plan_limit_reached:max_images_per_item' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_image_limit() from public, anon, authenticated;

create or replace function public.enforce_section_template_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('section_templates:' || new.business_id::text, 0));
  if (select count(*) from public.section_templates where business_id = new.business_id) >= 50 then
    raise exception 'section_template_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_section_template_limit() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9 · admin_create_catalog respeta max_catalogs
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_catalog(p_business uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog uuid;
  v_slug text;
  v_i int := 1;
  v_has_default boolean;
  v_limit int;
begin
  perform public.require_platform_admin();
  if not exists (select 1 from public.businesses where id = p_business and deleted_at is null) then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('catalogs:' || p_business::text, 0));
  v_limit := public.plan_limit(p_business, 'max_catalogs');
  if v_limit is not null and (select count(*) from public.catalogs where business_id = p_business and deleted_at is null) >= v_limit then
    raise exception 'plan_limit_reached:max_catalogs' using errcode = 'P0001';
  end if;
  v_slug := 'catalogo';
  while exists (select 1 from public.catalogs where business_id = p_business and slug = v_slug and deleted_at is null) loop
    v_i := v_i + 1;
    v_slug := 'catalogo-' || v_i;
  end loop;
  v_has_default := exists (select 1 from public.catalogs where business_id = p_business and is_default and deleted_at is null);
  insert into public.catalogs (business_id, name, slug, is_default)
  values (p_business, p_name, v_slug, not v_has_default)
  returning id into v_catalog;
  return v_catalog;
end;
$$;
revoke execute on function public.admin_create_catalog(uuid, text) from public, anon;
grant execute on function public.admin_create_catalog(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 10 · Reseñas públicas: sólo productos del catálogo publicado
-- -----------------------------------------------------------------------------
create or replace function public.get_public_reviews(p_business_slug text)
returns table (id uuid, item_id uuid, name text, rating smallint, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.item_id, r.name, r.rating, r.body, r.created_at
  from public.reviews r
  join public.businesses b on b.id = r.business_id
  join public.catalogs c on c.business_id = b.id and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and r.status = 'approved'
    and coalesce((c.settings -> 'reviews' ->> 'enabled')::boolean, false)
    -- La de un producto oculto, eliminado o de otro catálogo del negocio no se muestra.
    and (r.item_id is null or exists (
      select 1 from public.catalog_items i where i.id = r.item_id and i.catalog_id = c.id and i.is_visible and i.deleted_at is null
    ))
  order by r.created_at desc
  limit 500;
$$;
revoke execute on function public.get_public_reviews(text) from public;
grant execute on function public.get_public_reviews(text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 11 · replace_media_references: rutas con forma válida
-- -----------------------------------------------------------------------------
-- p_old: ruta de Storage del negocio o URL https registrada (imagen externa →
-- copia propia). p_new / p_new_thumb: ruta de Storage del negocio. Sin comillas
-- ni barras invertidas: el reemplazo se hace sobre el texto del JSONB.
create or replace function public.replace_media_references(p_business uuid, p_old text, p_new text, p_new_thumb text default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_rows int;
  v_path constant text := '^[0-9a-f-]{36}/[a-z]+/[A-Za-z0-9._-]+$';
begin
  if p_old is null or p_new is null or p_old = p_new then
    return 0;
  end if;
  if not (p_old ~ v_path or (p_old ~ '^https://[^\s"\\'']+$' and char_length(p_old) <= 1000)) then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;
  if p_new !~ v_path or public.storage_path_business_id(p_new) is distinct from p_business then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;
  if p_new_thumb is not null and (p_new_thumb !~ v_path or public.storage_path_business_id(p_new_thumb) is distinct from p_business) then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;

  update public.businesses set logo_path = p_new where id = p_business and logo_path = p_old;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  update public.catalogs set cover_path = p_new where business_id = p_business and cover_path = p_old;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  update public.catalogs set favicon_path = p_new where business_id = p_business and favicon_path = p_old;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  update public.catalogs
  set theme = replace(theme::text, p_old, p_new)::jsonb,
      seo = replace(seo::text, p_old, p_new)::jsonb,
      pdf = replace(pdf::text, p_old, p_new)::jsonb
  where business_id = p_business
    and position(p_old in (theme::text || seo::text || pdf::text)) > 0;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  update public.catalog_pages
  set sections = replace(sections::text, p_old, p_new)::jsonb,
      style = replace(style::text, p_old, p_new)::jsonb,
      seo = replace(seo::text, p_old, p_new)::jsonb
  where business_id = p_business and deleted_at is null
    and position(p_old in (sections::text || style::text || seo::text)) > 0;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  update public.categories set image_path = p_new where business_id = p_business and image_path = p_old;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  update public.catalog_item_images
  set storage_path = p_new, thumb_path = p_new_thumb
  where business_id = p_business and storage_path = p_old;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  return v_count;
end;
$$;
revoke execute on function public.replace_media_references(uuid, text, text, text) from public, anon;
grant execute on function public.replace_media_references(uuid, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 12 · Catálogo público con business.site_kind; adiós create_business
-- -----------------------------------------------------------------------------
drop function if exists public.create_business(text, text, jsonb, jsonb, jsonb);

-- Igual que en 20261030000000_custom_code.sql, más business.site_kind.
create or replace function public.get_public_catalog(p_business_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select b.*, coalesce((p.features ->> 'remove_branding')::boolean, false) as remove_branding,
      coalesce(b.custom_code, (p.features ->> 'custom_code')::boolean, false) as custom_code_enabled
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
        'remove_branding', b.remove_branding, 'custom_code', b.custom_code_enabled, 'site_kind', b.site_kind
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
