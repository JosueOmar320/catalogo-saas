-- =============================================================================
-- Código propio (sección HTML, widgets con código y CSS del sitio): lo
-- habilita el administrador de la plataforma, por plan (plans.features
-- .custom_code) o por negocio (businesses.custom_code: null = según el plan).
-- Los miembros no pueden cambiarlo (permisos por columna en businesses).
-- El sitio público sólo muestra el código propio si está habilitado: se
-- publica el valor efectivo en get_public_catalog (business.custom_code).
-- =============================================================================

alter table public.businesses add column if not exists custom_code boolean;
comment on column public.businesses.custom_code is 'Código propio: null = según el plan; true/false = decisión del administrador para este negocio.';

create or replace function public.admin_set_custom_code(p_business uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  update public.businesses set custom_code = p_value where id = p_business and deleted_at is null;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_set_custom_code(uuid, boolean) from public, anon;
grant execute on function public.admin_set_custom_code(uuid, boolean) to authenticated;

create or replace function public.admin_set_plan_custom_code(p_plan text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  update public.plans set features = features || jsonb_build_object('custom_code', p_value) where id = p_plan;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_set_plan_custom_code(text, boolean) from public, anon;
grant execute on function public.admin_set_plan_custom_code(text, boolean) to authenticated;

-- Igual que en 20260930000000_admin_access.sql, más business.custom_code (valor efectivo).
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
        'remove_branding', b.remove_branding, 'custom_code', b.custom_code_enabled
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
