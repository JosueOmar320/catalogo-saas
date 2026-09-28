-- =============================================================================
-- Vitrina · v2 "Website & Catalog Builder"
-- - Páginas con secciones (JSONB) por catálogo.
-- - Navegación y configuración de PDF por catálogo (JSONB).
-- - Slogan del negocio.
-- - RPC save_site (guardado atómico del sitio) y get_public_catalog ampliada.
-- - Migración de datos: cada catálogo existente recibe una página "Inicio".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Negocio: slogan
-- -----------------------------------------------------------------------------
alter table public.businesses
  add column if not exists slogan text check (char_length(slogan) <= 160);

grant update (slogan) on public.businesses to authenticated;

-- -----------------------------------------------------------------------------
-- Catálogo: navegación y PDF
-- -----------------------------------------------------------------------------
alter table public.catalogs
  add column if not exists navigation jsonb not null default '{}'::jsonb,
  add column if not exists pdf jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Páginas. Las secciones viven en `sections` (arreglo JSONB): agregar un tipo
-- de sección nuevo no requiere migración. La página se guarda completa.
-- -----------------------------------------------------------------------------
create table public.catalog_pages (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  catalog_id    uuid not null,
  title         text not null check (char_length(title) between 1 and 80),
  -- "p" está reservado para las fichas de producto (/catalogo/[negocio]/p/[item]).
  slug          text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$' and slug <> 'p'),
  template      text not null default 'custom' check (char_length(template) <= 30),
  is_home       boolean not null default false,
  is_published  boolean not null default true,
  position      int not null default 0,
  sections      jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array' and pg_column_size(sections) < 1000000),
  style         jsonb not null default '{}'::jsonb,
  seo           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (id, business_id),
  foreign key (catalog_id, business_id) references public.catalogs (id, business_id) on delete cascade
);

create unique index catalog_pages_slug_key on public.catalog_pages (catalog_id, slug) where deleted_at is null;
create unique index catalog_pages_one_home_key on public.catalog_pages (catalog_id) where is_home and deleted_at is null;
create index catalog_pages_position_idx on public.catalog_pages (catalog_id, position) where deleted_at is null;
create index catalog_pages_business_idx on public.catalog_pages (business_id);

create trigger catalog_pages_updated_at before update on public.catalog_pages
  for each row execute function public.set_updated_at();

alter table public.catalog_pages enable row level security;

-- Las páginas son diseño del sitio: las gestionan owner/admin (igual que catalogs).
create policy "pages: members read" on public.catalog_pages
  for select to authenticated using (public.is_business_member(business_id));
create policy "pages: admins insert" on public.catalog_pages
  for insert to authenticated with check (public.has_business_role(business_id, array['owner', 'admin']));
create policy "pages: admins update" on public.catalog_pages
  for update to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']))
  with check (public.has_business_role(business_id, array['owner', 'admin']));
create policy "pages: admins delete" on public.catalog_pages
  for delete to authenticated using (public.has_business_role(business_id, array['owner', 'admin']));

-- -----------------------------------------------------------------------------
-- save_site: guarda tema, navegación y páginas en UNA transacción.
-- SECURITY INVOKER: RLS aplica a cada fila.
-- p_pages: [{id, title, slug, template, is_home, is_published, sections, style, seo}] en orden.
-- -----------------------------------------------------------------------------
create or replace function public.save_site(
  p_catalog_id uuid,
  p_theme jsonb default null,
  p_navigation jsonb default null,
  p_pages jsonb default null,
  p_deleted_page_ids uuid[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business uuid;
  v_count int;
begin
  select business_id into v_business
  from public.catalogs
  where id = p_catalog_id and deleted_at is null;
  if v_business is null then
    raise exception 'catalog_not_found' using errcode = 'P0001';
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

    -- Paso 1: libera slugs y la marca de inicio de las páginas existentes para
    -- permitir intercambios (A↔B) sin chocar con los índices únicos.
    update public.catalog_pages cp
       set is_home = false
     where cp.catalog_id = p_catalog_id and cp.is_home and cp.deleted_at is null;

    update public.catalog_pages cp
       set slug = 'tmp-' || replace(cp.id::text, '-', '')
     where cp.catalog_id = p_catalog_id
       and cp.deleted_at is null
       and cp.id in (select (p ->> 'id')::uuid from jsonb_array_elements(p_pages) p);

    -- Paso 2: upsert con el orden recibido.
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

revoke execute on function public.save_site(uuid, jsonb, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.save_site(uuid, jsonb, jsonb, jsonb, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Catálogo público: ahora incluye páginas publicadas, navegación y slogan.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_catalog(p_business_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select b.*, coalesce((p.features ->> 'remove_branding')::boolean, false) as remove_branding
    from public.businesses b
    join public.plans p on p.id = b.plan_id
    where b.slug = p_business_slug and b.deleted_at is null
  ),
  c as (
    select c.*
    from public.catalogs c
    join b on b.id = c.business_id
    where c.is_default and c.status = 'published' and c.deleted_at is null
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
        'remove_branding', b.remove_branding
      ) from b
    ),
    'catalog', (select to_jsonb(c) - 'deleted_at' - 'pdf' from c),
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
-- Migración de datos: cada catálogo sin páginas recibe "Inicio" con
--   Hero (si tenía portada/descripción) → Catálogo completo → Contacto
-- conservando las opciones de su tema v1 (layout, columnas, buscador, filtros).
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_page uuid;
  v_sections jsonb;
  v_hero jsonb;
begin
  for r in
    select c.id, c.business_id, c.theme, c.cover_path, b.description
    from public.catalogs c
    join public.businesses b on b.id = c.business_id
    where c.deleted_at is null
      and not exists (select 1 from public.catalog_pages p where p.catalog_id = c.id and p.deleted_at is null)
  loop
    v_page := gen_random_uuid();
    v_hero := null;

    if coalesce(r.theme -> 'header' ->> 'style', 'cover') <> 'compact'
       and (r.cover_path is not null or coalesce(r.description, '') <> '') then
      v_hero := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'hero',
        'visible', true,
        'content', jsonb_build_object('height', case when r.cover_path is null then 'sm' else 'md' end),
        'style', case when r.cover_path is null then '{}'::jsonb else jsonb_build_object(
          'background', jsonb_build_object(
            'type', 'image',
            'image', jsonb_build_object('path', r.cover_path),
            'overlay', jsonb_build_object('color', '#000000', 'opacity', 45)
          ),
          'textColor', 'light'
        ) end
      );
    end if;

    v_sections := (case when v_hero is null then '[]'::jsonb else jsonb_build_array(v_hero) end)
      || jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'catalog',
          'visible', true,
          'content', jsonb_strip_nulls(jsonb_build_object(
            'layout', r.theme -> 'layout' ->> 'variant',
            'columns', jsonb_build_object('desktop', coalesce((r.theme -> 'layout' ->> 'columns')::int, 3)),
            'showSearch', (r.theme -> 'sections' ->> 'showSearch')::boolean,
            'showFilters', (r.theme -> 'sections' ->> 'showFilters')::boolean,
            'showCategoryNav', (r.theme -> 'header' ->> 'showMenu')::boolean,
            'groupByCategory', (r.theme -> 'sections' ->> 'groupByCategory')::boolean,
            'showFeatured', (r.theme -> 'sections' ->> 'showFeatured')::boolean
          )),
          'style', '{}'::jsonb
        ),
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'contact', 'visible', true, 'content', '{}'::jsonb, 'style', '{}'::jsonb)
      );

    insert into public.catalog_pages (id, business_id, catalog_id, title, slug, template, is_home, is_published, position, sections)
    values (v_page, r.business_id, r.id, 'Inicio', 'inicio', 'home', true, true, 0, v_sections);

    update public.catalogs
       set navigation = jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
             'id', gen_random_uuid()::text, 'kind', 'page', 'pageId', v_page::text, 'label', '', 'visible', true, 'style', 'link'
           )))
     where id = r.id and (navigation = '{}'::jsonb or navigation -> 'items' is null);
  end loop;
end;
$$;
