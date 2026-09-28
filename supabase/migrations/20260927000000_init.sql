-- =============================================================================
-- Vitrina · esquema inicial
-- Multi-tenant: todo dato pertenece a un business. El aislamiento lo garantiza
-- RLS; el rol anon no tiene acceso directo a ninguna tabla (lee vía RPC).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Extrae el business_id del primer segmento de una ruta de Storage
-- ("{business_id}/items/abc.jpg"). Devuelve null si no es un uuid.
create or replace function public.storage_path_business_id(p_path text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_path, '/', 1)::uuid
    else null
  end;
$$;

-- Slugs reservados para rutas de la plataforma.
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'auth', 'catalogo', 'dashboard', 'demo', 'login', 'logout',
    'onboarding', 'signup', 'settings', 'soporte', 'support', 'www', 'vitrina', 'static'
  ]);
$$;

-- -----------------------------------------------------------------------------
-- Planes (preparado para monetización; sin billing todavía)
-- -----------------------------------------------------------------------------
create table public.plans (
  id          text primary key,
  name        text not null,
  sort_order  int  not null default 0,
  limits      jsonb not null default '{}'::jsonb,
  features    jsonb not null default '{}'::jsonb,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans (id, name, sort_order, limits, features) values
  ('free', 'Gratis', 0,
    '{"max_catalogs": 1, "max_items": 50, "max_images_per_item": 4, "max_members": 1}',
    '{"pdf_export": true, "remove_branding": false, "custom_domain": false, "analytics": false}'),
  ('pro', 'Pro', 1,
    '{"max_catalogs": 1, "max_items": 1000, "max_images_per_item": 10, "max_members": 1}',
    '{"pdf_export": true, "remove_branding": true, "custom_domain": true, "analytics": false}'),
  ('business', 'Business', 2,
    '{"max_catalogs": 10, "max_items": 5000, "max_images_per_item": 20, "max_members": 10}',
    '{"pdf_export": true, "remove_branding": true, "custom_domain": true, "analytics": true}')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Negocios (tenant)
-- -----------------------------------------------------------------------------
create table public.businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  slug          text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$' and not public.is_reserved_slug(slug)),
  description   text check (char_length(description) <= 500),
  logo_path     text check (logo_path is null or public.storage_path_business_id(logo_path) = id),
  plan_id       text not null default 'free' references public.plans (id),
  contact       jsonb not null default '{}'::jsonb,
  social_links  jsonb not null default '[]'::jsonb check (jsonb_typeof(social_links) = 'array'),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- El slug es único para siempre (incluso borrado) para no reciclar URLs públicas.
create unique index businesses_slug_key on public.businesses (slug);

create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- Privilegios por columna: el usuario puede editar su perfil de negocio, pero
-- nunca plan_id, created_by ni deleted_at (eso lo hará billing / un RPC).
revoke update on public.businesses from anon, authenticated;
grant update (name, slug, description, logo_path, contact, social_links) on public.businesses to authenticated;

create table public.business_members (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner', 'admin', 'editor')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_idx on public.business_members (user_id);

create trigger business_members_updated_at before update on public.business_members
  for each row execute function public.set_updated_at();

-- Helpers de autorización. SECURITY DEFINER evita recursión de RLS sobre
-- business_members y permite usarlos en políticas de cualquier tabla.
create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- Catálogos
-- -----------------------------------------------------------------------------
create table public.catalogs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  slug          text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$'),
  status        text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  is_default    boolean not null default false,
  theme         jsonb not null default '{}'::jsonb,
  settings      jsonb not null default '{}'::jsonb,
  seo           jsonb not null default '{}'::jsonb,
  cover_path    text check (cover_path is null or public.storage_path_business_id(cover_path) = business_id),
  favicon_path  text check (favicon_path is null or public.storage_path_business_id(favicon_path) = business_id),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (id, business_id)
);

create unique index catalogs_business_slug_key on public.catalogs (business_id, slug) where deleted_at is null;
create unique index catalogs_one_default_key on public.catalogs (business_id) where is_default and deleted_at is null;

create trigger catalogs_updated_at before update on public.catalogs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Categorías
-- -----------------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  catalog_id   uuid not null,
  name         text not null check (char_length(name) between 1 and 80),
  description  text check (char_length(description) <= 500),
  image_path   text check (image_path is null or public.storage_path_business_id(image_path) = business_id),
  position     int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (id, business_id),
  -- FK compuesta: la categoría sólo puede apuntar a un catálogo del mismo negocio.
  foreign key (catalog_id, business_id) references public.catalogs (id, business_id) on delete cascade
);

create index categories_catalog_position_idx on public.categories (catalog_id, position) where deleted_at is null;
create index categories_business_idx on public.categories (business_id);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Ítems (productos y servicios)
-- -----------------------------------------------------------------------------
create table public.catalog_items (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null,
  catalog_id         uuid not null,
  category_id        uuid,
  type               text not null default 'product' check (type in ('product', 'service')),
  name               text not null check (char_length(name) between 1 and 160),
  slug               text not null check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  short_description  text check (char_length(short_description) <= 300),
  description        text check (char_length(description) <= 5000),
  price              numeric(12, 2) check (price >= 0),
  compare_at_price   numeric(12, 2) check (compare_at_price >= 0),
  currency           text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  price_note         text check (char_length(price_note) <= 40),
  sku                text check (char_length(sku) <= 64),
  is_available       boolean not null default true,
  is_featured        boolean not null default false,
  is_visible         boolean not null default true,
  position           int not null default 0,
  tags               text[] not null default '{}',
  attributes         jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (id, business_id),
  foreign key (catalog_id, business_id) references public.catalogs (id, business_id) on delete cascade,
  foreign key (category_id, business_id) references public.categories (id, business_id) on delete set null (category_id)
);

create unique index catalog_items_slug_key on public.catalog_items (catalog_id, slug) where deleted_at is null;
create index catalog_items_catalog_position_idx on public.catalog_items (catalog_id, position) where deleted_at is null;
create index catalog_items_category_idx on public.catalog_items (category_id) where deleted_at is null;
create index catalog_items_business_idx on public.catalog_items (business_id);

create trigger catalog_items_updated_at before update on public.catalog_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Imágenes de ítems (sólo referencias; los archivos viven en Storage)
-- -----------------------------------------------------------------------------
create table public.catalog_item_images (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  item_id       uuid not null,
  storage_path  text not null check (public.storage_path_business_id(storage_path) = business_id),
  thumb_path    text check (thumb_path is null or public.storage_path_business_id(thumb_path) = business_id),
  width         int check (width > 0),
  height        int check (height > 0),
  size_bytes    int check (size_bytes > 0),
  mime_type     text check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  alt           text check (char_length(alt) <= 200),
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (item_id, business_id) references public.catalog_items (id, business_id) on delete cascade
);

create index catalog_item_images_item_idx on public.catalog_item_images (item_id, position);
create index catalog_item_images_business_idx on public.catalog_item_images (business_id);

create trigger catalog_item_images_updated_at before update on public.catalog_item_images
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Límites del plan aplicados en la base (defensa en profundidad; la app
-- también los verifica para dar mensajes claros).
-- -----------------------------------------------------------------------------
create or replace function public.plan_limit(p_business_id uuid, p_key text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(p.limits ->> p_key, '')::int
  from public.businesses b
  join public.plans p on p.id = b.plan_id
  where b.id = p_business_id;
$$;

create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := public.plan_limit(new.business_id, 'max_items');
begin
  if v_limit is not null and (
    select count(*) from public.catalog_items
    where business_id = new.business_id and deleted_at is null
  ) >= v_limit then
    raise exception 'plan_limit_reached:max_items' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger catalog_items_limit before insert on public.catalog_items
  for each row execute function public.enforce_item_limit();

create or replace function public.enforce_image_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := public.plan_limit(new.business_id, 'max_images_per_item');
begin
  if v_limit is not null and (
    select count(*) from public.catalog_item_images where item_id = new.item_id
  ) >= v_limit then
    raise exception 'plan_limit_reached:max_images_per_item' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger catalog_item_images_limit before insert on public.catalog_item_images
  for each row execute function public.enforce_image_limit();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.plans               enable row level security;
alter table public.profiles            enable row level security;
alter table public.businesses          enable row level security;
alter table public.business_members    enable row level security;
alter table public.catalogs            enable row level security;
alter table public.categories          enable row level security;
alter table public.catalog_items       enable row level security;
alter table public.catalog_item_images enable row level security;

-- plans: catálogo de planes, legible por usuarios autenticados.
create policy "plans: read" on public.plans
  for select to authenticated using (true);

-- profiles: cada usuario sólo ve y edita el suyo.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- businesses: los miembros leen; owner/admin editan. La creación es sólo vía
-- create_business() (no hay política de insert).
create policy "businesses: members read" on public.businesses
  for select to authenticated using (public.is_business_member(id));
create policy "businesses: admins update" on public.businesses
  for update to authenticated
  using (public.has_business_role(id, array['owner', 'admin']))
  with check (public.has_business_role(id, array['owner', 'admin']));

-- business_members: los miembros ven al equipo; sólo el owner lo administra.
create policy "members: members read" on public.business_members
  for select to authenticated using (public.is_business_member(business_id));
create policy "members: owner insert" on public.business_members
  for insert to authenticated with check (public.has_business_role(business_id, array['owner']));
create policy "members: owner update" on public.business_members
  for update to authenticated
  using (public.has_business_role(business_id, array['owner']))
  with check (public.has_business_role(business_id, array['owner']));
create policy "members: owner delete" on public.business_members
  for delete to authenticated using (public.has_business_role(business_id, array['owner']));

-- catalogs: miembros leen; owner/admin crean y editan (diseño, publicación).
create policy "catalogs: members read" on public.catalogs
  for select to authenticated using (public.is_business_member(business_id));
create policy "catalogs: admins insert" on public.catalogs
  for insert to authenticated with check (public.has_business_role(business_id, array['owner', 'admin']));
create policy "catalogs: admins update" on public.catalogs
  for update to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']))
  with check (public.has_business_role(business_id, array['owner', 'admin']));

-- Contenido (categorías, ítems, imágenes): cualquier miembro del negocio.
create policy "categories: members all" on public.categories
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy "items: members all" on public.catalog_items
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy "images: members all" on public.catalog_item_images
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------


create or replace function public.is_business_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'
    and not public.is_reserved_slug(p_slug)
    and not exists (select 1 from public.businesses where slug = p_slug);
$$;

-- Crea negocio + membresía owner + catálogo por defecto de forma atómica.
create or replace function public.create_business(
  p_name text,
  p_slug text,
  p_contact jsonb default '{}'::jsonb,
  p_catalog_theme jsonb default '{}'::jsonb,
  p_catalog_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_business_slug_available(p_slug) then
    raise exception 'slug_unavailable' using errcode = 'P0001';
  end if;

  -- Límite anti-abuso de negocios por usuario (independiente del plan).
  if (select count(*) from public.business_members where user_id = v_user and role = 'owner') >= 5 then
    raise exception 'business_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.businesses (name, slug, contact, created_by)
  values (p_name, p_slug, coalesce(p_contact, '{}'::jsonb), v_user)
  returning id into v_business;

  insert into public.business_members (business_id, user_id, role)
  values (v_business, v_user, 'owner');

  insert into public.catalogs (business_id, name, slug, is_default, theme, settings)
  values (v_business, p_name, 'principal', true,
          coalesce(p_catalog_theme, '{}'::jsonb), coalesce(p_catalog_settings, '{}'::jsonb));

  return v_business;
end;
$$;

-- Reordena filas de una tabla de contenido. SECURITY INVOKER: RLS aplica,
-- así que sólo se actualizan filas del negocio del usuario.
create or replace function public.reorder_rows(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_table not in ('categories', 'catalog_items', 'catalog_item_images') then
    raise exception 'invalid_table' using errcode = 'P0001';
  end if;

  execute format(
    'update public.%I t set position = x.ord - 1
       from unnest($1) with ordinality as x(id, ord)
      where t.id = x.id and t.position is distinct from x.ord - 1',
    p_table
  ) using p_ids;
end;
$$;

-- Catálogo público: una sola llamada devuelve todo lo publicado.
-- Sólo expone catálogos publicados, categorías activas e ítems visibles.
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
  )
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'business', (
      select jsonb_build_object(
        'id', b.id, 'name', b.name, 'slug', b.slug, 'description', b.description,
        'logo_path', b.logo_path, 'contact', b.contact, 'social_links', b.social_links,
        'remove_branding', b.remove_branding
      ) from b
    ),
    'catalog', (
      select to_jsonb(c) - 'deleted_at' from c
    ),
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
    ), '[]'::jsonb)
  ) end;
$$;

-- Permisos de ejecución: por defecto PUBLIC puede ejecutar funciones.
revoke execute on function public.create_business(text, text, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.reorder_rows(text, uuid[]) from public, anon;
revoke execute on function public.is_business_slug_available(text) from public, anon;
revoke execute on function public.plan_limit(uuid, text) from public, anon;
grant execute on function public.create_business(text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.reorder_rows(text, uuid[]) to authenticated;
grant execute on function public.is_business_slug_available(text) to authenticated;
grant execute on function public.get_public_catalog(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket público con límites de tamaño y tipo. Rutas:
--   {business_id}/{logo|cover|favicon|category|items}/{uuid}.{jpg|png}
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-media', 'catalog-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog-media: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'catalog-media' and public.is_business_member(public.storage_path_business_id(name)));

create policy "catalog-media: members insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalog-media' and public.is_business_member(public.storage_path_business_id(name)));

create policy "catalog-media: members update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog-media' and public.is_business_member(public.storage_path_business_id(name)))
  with check (bucket_id = 'catalog-media' and public.is_business_member(public.storage_path_business_id(name)));

create policy "catalog-media: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog-media' and public.is_business_member(public.storage_path_business_id(name)));
