-- =============================================================================
-- v5: biblioteca de medios
-- - media_assets pasa a ser la fuente de verdad de los recursos del negocio:
--   nombre, carpeta, proveedor de storage y URLs externas registradas.
-- - Los archivos NO se mueven: ya están en Storage y sus rutas siguen válidas.
-- - Funciones para saber dónde se usa una imagen y para reemplazarla en todo
--   el contenido del negocio (sin duplicar archivos).
-- Todo es aditivo: no se borra información existente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.media_assets
  add column if not exists name text not null default '' check (char_length(name) <= 200),
  add column if not exists original_name text check (original_name is null or char_length(original_name) <= 255),
  add column if not exists folder text not null default 'images'
    check (folder in ('images', 'logos', 'products', 'backgrounds', 'banners', 'other')),
  add column if not exists storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'external')),
  add column if not exists public_url text check (public_url is null or char_length(public_url) <= 1000);

-- La ruta puede ser una clave de Storage del negocio o una URL externa registrada.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.media_assets'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%storage_path_business_id(path)%' or pg_get_constraintdef(oid) like '%kind%')
  loop
    execute format('alter table public.media_assets drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.media_assets
  add constraint media_assets_path_check check (
    -- coalesce: una ruta que no empieza con un uuid (p. ej. una URL) NO pasa como archivo propio.
    (storage_provider = 'supabase' and coalesce(public.storage_path_business_id(path) = business_id, false))
    or (storage_provider = 'external' and path ~ '^https://[^\s]+$' and char_length(path) <= 1000)
  ),
  add constraint media_assets_kind_check check (kind in ('items', 'category', 'cover', 'og', 'site', 'logo', 'favicon', 'media'));

-- Una misma URL externa puede estar en la biblioteca de varios negocios.
drop index if exists public.media_assets_path_key;
create unique index if not exists media_assets_business_path_key on public.media_assets (business_id, path);
create index if not exists media_assets_folder_idx on public.media_assets (business_id, folder, created_at desc) where deleted_at is null;

-- Carpeta y nombre de lo que ya existía.
update public.media_assets set folder = case kind
    when 'logo' then 'logos'
    when 'favicon' then 'logos'
    when 'items' then 'products'
    when 'category' then 'products'
    when 'cover' then 'banners'
    when 'og' then 'other'
    else 'images'
  end
where folder = 'images' and kind <> 'site';

update public.media_assets
set name = left(coalesce(nullif(alt, ''), regexp_replace(split_part(path, '/', 3), '\.[a-z0-9]+$', '')), 200)
where name = '';

-- Archivos referenciados que aún no estaban en la biblioteca (por ejemplo, si el registro falló).
insert into public.media_assets (business_id, path, kind, folder, name, source, created_by)
select r.business_id, r.path, r.kind, r.folder, left(regexp_replace(split_part(r.path, '/', 3), '\.[a-z0-9]+$', ''), 200), 'upload', null
from (
  select id as business_id, logo_path as path, 'logo' as kind, 'logos' as folder from public.businesses where logo_path is not null
  union all select business_id, cover_path, 'cover', 'banners' from public.catalogs where cover_path is not null
  union all select business_id, favicon_path, 'favicon', 'logos' from public.catalogs where favicon_path is not null
  union all select business_id, image_path, 'category', 'products' from public.categories where image_path is not null
  union all select business_id, storage_path, 'items', 'products' from public.catalog_item_images
) r
where public.storage_path_business_id(r.path) = r.business_id
on conflict (business_id, path) do nothing;

-- Miniaturas de productos que ya existían.
update public.media_assets m
set thumb_path = i.thumb_path
from public.catalog_item_images i
where m.business_id = i.business_id and m.path = i.storage_path and m.thumb_path is null and i.thumb_path is not null;

-- -----------------------------------------------------------------------------
-- ¿Dónde se usa? (SECURITY INVOKER: cada consulta respeta RLS)
-- Las rutas son uuid + extensión y las URLs se validan sin comillas, así que
-- buscarlas en el texto del JSONB es exacto.
-- -----------------------------------------------------------------------------
create or replace function public.media_references(p_business uuid, p_path text)
returns table (place text, ref_id uuid, label text)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'logo', b.id, 'Logo del negocio'
  from public.businesses b
  where b.id = p_business and b.logo_path = p_path
  union all
  select 'cover', c.id, 'Portada del catálogo'
  from public.catalogs c where c.business_id = p_business and c.cover_path = p_path
  union all
  select 'favicon', c.id, 'Ícono del sitio'
  from public.catalogs c where c.business_id = p_business and c.favicon_path = p_path
  union all
  select 'theme', c.id, 'Diseño del sitio'
  from public.catalogs c where c.business_id = p_business and position(p_path in c.theme::text) > 0
  union all
  select 'seo', c.id, 'SEO del sitio'
  from public.catalogs c where c.business_id = p_business and position(p_path in c.seo::text) > 0
  union all
  select 'pdf', c.id, 'PDF'
  from public.catalogs c where c.business_id = p_business and position(p_path in c.pdf::text) > 0
  union all
  select 'page', p.id, 'Página «' || p.title || '»'
  from public.catalog_pages p
  where p.business_id = p_business and p.deleted_at is null
    and position(p_path in (p.sections::text || p.style::text || p.seo::text)) > 0
  union all
  select 'category', c.id, 'Categoría «' || c.name || '»'
  from public.categories c
  where c.business_id = p_business and c.deleted_at is null and c.image_path = p_path
  union all
  select 'product', i.id, 'Producto «' || i.name || '»'
  from public.catalog_items i
  where i.business_id = p_business and i.deleted_at is null
    and exists (
      select 1 from public.catalog_item_images img
      where img.item_id = i.id and (img.storage_path = p_path or img.thumb_path = p_path)
    );
$$;

-- -----------------------------------------------------------------------------
-- Reemplazar una imagen en TODO el contenido del negocio (la nueva ya subida).
-- SECURITY INVOKER: sólo actualiza lo que el usuario puede editar (owner/admin).
-- -----------------------------------------------------------------------------
create or replace function public.replace_media_references(p_business uuid, p_old text, p_new text, p_new_thumb text default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_rows int;
begin
  if p_old is null or p_new is null or p_old = p_new then
    return 0;
  end if;
  if public.storage_path_business_id(p_new) is distinct from p_business then
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

revoke execute on function public.media_references(uuid, text) from public, anon;
revoke execute on function public.replace_media_references(uuid, text, text, text) from public, anon;
grant execute on function public.media_references(uuid, text) to authenticated;
grant execute on function public.replace_media_references(uuid, text, text, text) to authenticated;
