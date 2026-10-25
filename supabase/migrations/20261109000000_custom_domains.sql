-- =============================================================================
-- Dominio propio: cada negocio puede servir su sitio en su dominio
-- (mitienda.com) además de /catalogo/<negocio>.
--
-- · businesses.custom_domain: el dominio en minúsculas (único entre negocios).
--   custom_domain_status: none · pending (agregado, falta el DNS) · active
--   (Vercel lo verificó y apunta bien). Lo escribe sólo el servidor (service
--   role) después de hablar con la API de Vercel; los miembros no tienen
--   permiso de escritura sobre estas columnas.
-- · get_site_by_domain: qué negocio se sirve en un dominio activo (lo usa el
--   proxy en cada visita a un dominio propio; sólo devuelve el slug). Sólo si
--   la función está encendida para el negocio (decisión del administrador o plan).
-- · get_public_catalog: como en 20261102000000_hardening.sql, más
--   business.custom_domain (sólo si está activo) para las URL canónicas.
-- · admin_set_business_features: suma «custom_domain» a las funciones que el
--   administrador puede encender o apagar por negocio.
-- =============================================================================

alter table public.businesses add column if not exists custom_domain text;
alter table public.businesses add column if not exists custom_domain_status text not null default 'none';
alter table public.businesses add column if not exists custom_domain_checked_at timestamptz;
alter table public.businesses drop constraint if exists businesses_custom_domain_status_check;
alter table public.businesses add constraint businesses_custom_domain_status_check check (custom_domain_status in ('none', 'pending', 'active'));
alter table public.businesses drop constraint if exists businesses_custom_domain_format;
alter table public.businesses add constraint businesses_custom_domain_format check (
  custom_domain is null
  or (char_length(custom_domain) between 4 and 253 and custom_domain = lower(custom_domain) and custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')
);
alter table public.businesses drop constraint if exists businesses_custom_domain_state;
alter table public.businesses add constraint businesses_custom_domain_state check ((custom_domain is null) = (custom_domain_status = 'none'));
create unique index if not exists businesses_custom_domain_key on public.businesses (custom_domain) where custom_domain is not null;
comment on column public.businesses.custom_domain is 'Dominio propio (minúsculas, sin protocolo). Lo escribe el servidor tras registrarlo en Vercel.';

create or replace function public.get_site_by_domain(p_host text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select b.slug
  from public.businesses b
  join public.plans p on p.id = b.plan_id
  where b.custom_domain = lower(p_host) and b.custom_domain_status = 'active' and b.deleted_at is null and b.status = 'active'
    -- Si el administrador apaga la función o el plan ya no la incluye, el dominio deja de servir el sitio.
    and coalesce((b.feature_overrides ->> 'custom_domain')::boolean, (p.features ->> 'custom_domain')::boolean, false)
  limit 1;
$$;
revoke execute on function public.get_site_by_domain(text) from public;
grant execute on function public.get_site_by_domain(text) to anon, authenticated;

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
      coalesce((b.feature_overrides ->> 'custom_domain')::boolean, (p.features ->> 'custom_domain')::boolean, false) as custom_domain_enabled
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
        'custom_domain', case when b.custom_domain_status = 'active' and b.custom_domain_enabled then b.custom_domain end
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

create or replace function public.admin_set_business_features(p_business uuid, p_features jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  if p_features is null or jsonb_typeof(p_features) <> 'object' or exists (
    select 1 from jsonb_each(p_features) e
    where e.key not in ('assistant', 'pdf_export', 'orders', 'analytics', 'import', 'custom_domain') or jsonb_typeof(e.value) <> 'boolean'
  ) then
    raise exception 'invalid_features' using errcode = 'P0001';
  end if;
  update public.businesses set feature_overrides = p_features where id = p_business and deleted_at is null;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_set_business_features(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_business_features(uuid, jsonb) to authenticated;
