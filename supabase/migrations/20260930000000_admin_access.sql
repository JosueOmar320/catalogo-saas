-- =============================================================================
-- Vitrina · v4 "Acceso administrado"
-- - Usuarios aprovisionados por un administrador; acceso con nombre de usuario.
-- - Rol de plataforma (admin | user) y estado de usuario protegidos en la base.
-- - Negocios suspendibles y catálogos activables (sólo el admin).
-- - Negocios creados y asignados sólo por el admin (RPCs admin_*).
-- - Auditoría (audit_log + triggers) y biblioteca de medios (media_assets).
-- Todo es aditivo: no se borra ni se pierde información existente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfiles: usuario, email de contacto opcional, rol y estado
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists email text check (email is null or char_length(email) <= 254),
  add column if not exists platform_role text not null default 'user' check (platform_role in ('admin', 'user')),
  add column if not exists status text not null default 'active' check (status in ('active', 'disabled')),
  add column if not exists last_login_at timestamptz,
  add column if not exists max_businesses int check (max_businesses is null or max_businesses >= 0),
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- Usuarios existentes: nombre de usuario derivado del email (único) y email como contacto.
with base as (
  select p.id, p.created_at, u.email,
    ltrim(regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), '._-') as b
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username is null
),
named as (
  select id, email,
    left(case when char_length(b) < 3 then b || 'usuario' else b end, 26) as b,
    row_number() over (partition by left(case when char_length(b) < 3 then b || 'usuario' else b end, 26) order by created_at, id) as rn
  from base
)
update public.profiles p
set username = case when n.rn = 1 then n.b else n.b || '-' || substr(replace(p.id::text, '-', ''), 1, 4) end,
    email = coalesce(p.email, n.email)
from named n
where n.id = p.id;

-- Perfiles sin fila en auth.users (no debería ocurrir): nombre a partir del id.
update public.profiles set username = 'usuario-' || substr(replace(id::text, '-', ''), 1, 8) where username is null;

alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
create unique index if not exists profiles_username_key on public.profiles (username);

-- El usuario sólo edita su nombre y avatar: nunca su rol, estado ni usuario.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Nuevas cuentas. Sólo las aprovisionadas por el admin (app_metadata.provisioned,
-- que sólo la service role puede escribir) quedan activas: un registro por fuera
-- del panel nace desactivado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
  v_i int := 1;
  v_provisioned boolean := coalesce((new.raw_app_meta_data ->> 'provisioned')::boolean, false);
begin
  v_base := lower(coalesce(nullif(new.raw_app_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1)));
  v_base := ltrim(regexp_replace(v_base, '[^a-z0-9._-]', '', 'g'), '._-');
  if char_length(v_base) < 3 then v_base := v_base || 'usuario'; end if;
  v_base := left(v_base, 28);
  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_i := v_i + 1;
    v_username := v_base || v_i;
  end loop;

  insert into public.profiles (id, full_name, username, email, status, platform_role, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_username,
    nullif(new.raw_app_meta_data ->> 'contact_email', ''),
    case when v_provisioned then 'active' else 'disabled' end,
    'user',
    nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Helpers de autorización
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and platform_role = 'admin' and status = 'active'
  );
$$;

-- Negocios: estado controlado por el admin (el usuario no tiene privilegio de columna).
alter table public.businesses
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));

-- Catálogos: activación controlada por el admin.
alter table public.catalogs add column if not exists is_active boolean not null default true;
revoke update on public.catalogs from anon, authenticated;
grant update (name, slug, status, theme, settings, seo, cover_path, favicon_path, published_at, navigation, pdf, attribute_defs)
  on public.catalogs to authenticated;

-- Miembro = admin de plataforma, o miembro ACTIVO de un negocio ACTIVO.
-- Todas las políticas (tablas y Storage) usan estas funciones: el cambio aplica en todo el sistema.
create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id
    join public.profiles p on p.id = m.user_id
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and b.status = 'active' and b.deleted_at is null
      and p.status = 'active'
  );
$$;

create or replace function public.has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id
    join public.profiles p on p.id = m.user_id
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
      and b.status = 'active' and b.deleted_at is null
      and p.status = 'active'
  );
$$;

-- Los admins ven todos los perfiles; cada usuario, el suyo.
drop policy if exists "profiles: admins read" on public.profiles;
create policy "profiles: admins read" on public.profiles
  for select to authenticated using (public.is_platform_admin());

-- Los miembros de un negocio ven los perfiles de su equipo (nombre y usuario).
drop policy if exists "profiles: team read" on public.profiles;
create policy "profiles: team read" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.business_members me
      join public.business_members other on other.business_id = me.business_id
      where me.user_id = (select auth.uid()) and other.user_id = profiles.id
    )
  );

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null check (char_length(action) <= 80),
  entity_type  text not null check (char_length(entity_type) <= 60),
  entity_id    text,
  -- Sin FK: el historial sobrevive a las entidades (y a borrados en cascada).
  business_id  uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_business_idx on public.audit_log (business_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "audit: admins read" on public.audit_log;
create policy "audit: admins read" on public.audit_log for select to authenticated using (public.is_platform_admin());
-- Sin políticas de escritura: sólo funciones SECURITY DEFINER insertan.
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- Evento explícito (acciones del panel que no pasan por una tabla, p. ej. cambiar una contraseña).
create or replace function public.log_audit(p_action text, p_entity_type text, p_entity_id text, p_business_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, business_id, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, p_business_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Cambios de filas en entidades clave: quién, qué entidad, qué columnas cambiaron.
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

do $$
declare
  t text;
begin
  foreach t in array array['businesses', 'business_members', 'catalogs', 'catalog_pages', 'categories', 'catalog_items', 'profiles'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Biblioteca de medios
-- -----------------------------------------------------------------------------
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  path         text not null check (public.storage_path_business_id(path) = business_id),
  thumb_path   text check (thumb_path is null or public.storage_path_business_id(thumb_path) = business_id),
  kind         text not null default 'site' check (kind in ('items', 'category', 'cover', 'og', 'site', 'logo', 'favicon')),
  mime_type    text,
  width        int check (width is null or width > 0),
  height       int check (height is null or height > 0),
  size_bytes   bigint check (size_bytes is null or size_bytes >= 0),
  alt          text not null default '' check (char_length(alt) <= 300),
  tags         text[] not null default '{}',
  source       text not null default 'upload' check (source in ('upload', 'import', 'stock', 'chat')),
  source_url   text check (source_url is null or char_length(source_url) <= 1000),
  attribution  text check (attribution is null or char_length(attribution) <= 300),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index if not exists media_assets_path_key on public.media_assets (path);
create index if not exists media_assets_business_idx on public.media_assets (business_id, created_at desc) where deleted_at is null;

drop trigger if exists media_assets_updated_at on public.media_assets;
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();
drop trigger if exists media_assets_audit on public.media_assets;
create trigger media_assets_audit after insert or update or delete on public.media_assets
  for each row execute function public.audit_row_change();

alter table public.media_assets enable row level security;
drop policy if exists "media: members all" on public.media_assets;
create policy "media: members all" on public.media_assets
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- Imágenes que ya estaban en Storage → biblioteca (las miniaturas se asocian a su original).
insert into public.media_assets (business_id, path, thumb_path, kind, source, created_by)
select
  public.storage_path_business_id(o.name),
  o.name,
  (select t.name from storage.objects t
    where t.bucket_id = o.bucket_id
      and t.name = regexp_replace(o.name, '\.(jpg|jpeg|png|webp)$', '-thumb.\1')
    limit 1),
  split_part(o.name, '/', 2),
  'upload',
  null
from storage.objects o
where o.bucket_id = 'catalog-media'
  and o.name !~ '-thumb\.(jpg|jpeg|png|webp)$'
  and split_part(o.name, '/', 2) in ('items', 'category', 'cover', 'og', 'site', 'logo', 'favicon')
  and exists (select 1 from public.businesses b where b.id = public.storage_path_business_id(o.name))
on conflict (path) do nothing;

-- -----------------------------------------------------------------------------
-- Catálogo público: sólo negocios activos y catálogos activos
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
        'remove_branding', b.remove_branding
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
-- Creación de negocios: sólo administradores
-- -----------------------------------------------------------------------------
revoke execute on function public.create_business(text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_create_business(
  p_name text,
  p_slug text,
  p_owner uuid default null,
  p_plan_id text default 'free',
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
  v_business uuid;
begin
  perform public.require_platform_admin();
  if not public.is_business_slug_available(p_slug) then
    raise exception 'slug_unavailable' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;
  if p_owner is not null then
    perform public.assert_business_quota(p_owner);
  end if;

  insert into public.businesses (name, slug, contact, plan_id, created_by)
  values (p_name, p_slug, coalesce(p_contact, '{}'::jsonb), p_plan_id, (select auth.uid()))
  returning id into v_business;

  if p_owner is not null then
    insert into public.business_members (business_id, user_id, role) values (v_business, p_owner, 'owner');
  end if;

  insert into public.catalogs (business_id, name, slug, is_default, theme, settings)
  values (v_business, p_name, 'principal', true, coalesce(p_catalog_theme, '{}'::jsonb), coalesce(p_catalog_settings, '{}'::jsonb));

  return v_business;
end;
$$;

-- Límite de negocios por usuario (profiles.max_businesses; nulo = sin límite).
create or replace function public.assert_business_quota(p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select max_businesses into v_max from public.profiles where id = p_user;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if v_max is not null and (select count(*) from public.business_members where user_id = p_user) >= v_max then
    raise exception 'business_limit_reached' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_update_business(p_business uuid, p_name text, p_slug text, p_plan_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  if p_slug <> (select slug from public.businesses where id = p_business) and not public.is_business_slug_available(p_slug) then
    raise exception 'slug_unavailable' using errcode = 'P0001';
  end if;
  update public.businesses
  set name = p_name, slug = p_slug, plan_id = p_plan_id, status = p_status
  where id = p_business and deleted_at is null;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_set_business_member(p_business uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  if p_role not in ('owner', 'admin', 'editor') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.business_members where business_id = p_business and user_id = p_user) then
    perform public.assert_business_quota(p_user);
  end if;
  insert into public.business_members (business_id, user_id, role)
  values (p_business, p_user, p_role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.admin_remove_business_member(p_business uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  delete from public.business_members where business_id = p_business and user_id = p_user;
end;
$$;

-- Perfil de un usuario (el admin no puede quitarse a sí mismo el rol ni desactivarse,
-- y siempre queda al menos un administrador activo).
create or replace function public.admin_update_profile(
  p_user uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_status text,
  p_max_businesses int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current record;
begin
  perform public.require_platform_admin();
  if p_role not in ('admin', 'user') or p_status not in ('active', 'disabled') then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  select * into v_current from public.profiles where id = p_user;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if p_user = (select auth.uid()) and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'cannot_demote_self' using errcode = 'P0001';
  end if;
  if v_current.platform_role = 'admin' and v_current.status = 'active' and (p_role <> 'admin' or p_status <> 'active')
     and (select count(*) from public.profiles where platform_role = 'admin' and status = 'active') <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  update public.profiles
  set full_name = coalesce(p_full_name, ''),
      email = nullif(trim(p_email), ''),
      platform_role = p_role,
      status = p_status,
      max_businesses = p_max_businesses
  where id = p_user;
end;
$$;

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
begin
  perform public.require_platform_admin();
  if not exists (select 1 from public.businesses where id = p_business and deleted_at is null) then
    raise exception 'business_not_found' using errcode = 'P0001';
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

create or replace function public.admin_update_catalog(p_catalog uuid, p_name text, p_is_active boolean, p_make_default boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  perform public.require_platform_admin();
  select business_id into v_business from public.catalogs where id = p_catalog and deleted_at is null;
  if v_business is null then
    raise exception 'catalog_not_found' using errcode = 'P0001';
  end if;
  if p_make_default then
    update public.catalogs set is_default = false where business_id = v_business and id <> p_catalog and is_default;
  end if;
  update public.catalogs
  set name = p_name, is_active = p_is_active, is_default = is_default or coalesce(p_make_default, false)
  where id = p_catalog;
end;
$$;

-- Primer administrador: sólo desde el SQL Editor / service role (no ejecutable por usuarios).
create or replace function public.bootstrap_platform_admin(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set platform_role = 'admin', status = 'active' where username = lower(p_username);
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.bootstrap_platform_admin(text) from public, anon, authenticated;
revoke execute on function public.admin_create_business(text, text, uuid, text, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.admin_update_business(uuid, text, text, text, text) from public, anon;
revoke execute on function public.admin_set_business_member(uuid, uuid, text) from public, anon;
revoke execute on function public.admin_remove_business_member(uuid, uuid) from public, anon;
revoke execute on function public.admin_update_profile(uuid, text, text, text, text, int) from public, anon;
revoke execute on function public.admin_create_catalog(uuid, text) from public, anon;
revoke execute on function public.admin_update_catalog(uuid, text, boolean, boolean) from public, anon;
revoke execute on function public.log_audit(text, text, text, uuid, jsonb) from public, anon;
revoke execute on function public.assert_business_quota(uuid) from public, anon, authenticated;
grant execute on function public.admin_create_business(text, text, uuid, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.admin_update_business(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_set_business_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_business_member(uuid, uuid) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, int) to authenticated;
grant execute on function public.admin_create_catalog(uuid, text) to authenticated;
grant execute on function public.admin_update_catalog(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.log_audit(text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
