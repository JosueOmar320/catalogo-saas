-- =============================================================================
-- Endurecimiento de seguridad (auditoría oct-2026). Sólo cambia permisos y
-- agrega una tabla de límites; no modifica datos existentes.
--
-- 1. Membresías: desde la v4 sólo un administrador de la plataforma asigna
--    personas a negocios (admin_set_business_member / admin_remove_business_member,
--    SECURITY DEFINER, con cuotas). Las políticas de la v1 que dejaban al dueño
--    escribir business_members directamente por la API REST seguían activas:
--    permitían saltarse las cuotas, agregar a cualquier usuario (incluido un
--    administrador, cuyo perfil quedaba legible por "profiles: team read") o
--    cambiar roles sin auditoría.
-- 2. Catálogos: igual, se crean con admin_create_catalog (respeta max_catalogs).
-- 3. Biblioteca: la app sólo hace borrado lógico (deleted_at). El DELETE físico
--    por la API queda para dueño/admin, como ya exigen las Server Actions.
-- 4. Límite de intentos compartido entre instancias (login y Garfield).
-- =============================================================================

-- 1 · Membresías: sólo por las funciones de administración.
drop policy if exists "members: owner insert" on public.business_members;
drop policy if exists "members: owner update" on public.business_members;
drop policy if exists "members: owner delete" on public.business_members;

-- 2 · Catálogos: alta sólo por admin_create_catalog.
drop policy if exists "catalogs: admins insert" on public.catalogs;

-- 3 · Biblioteca de medios: los miembros leen, suben y editan; borrar físicamente, dueño/admin.
drop policy if exists "media: members all" on public.media_assets;
drop policy if exists "media: members read" on public.media_assets;
drop policy if exists "media: members insert" on public.media_assets;
drop policy if exists "media: members update" on public.media_assets;
drop policy if exists "media: admins delete" on public.media_assets;
create policy "media: members read" on public.media_assets
  for select to authenticated using (public.is_business_member(business_id));
create policy "media: members insert" on public.media_assets
  for insert to authenticated with check (public.is_business_member(business_id));
create policy "media: members update" on public.media_assets
  for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
create policy "media: admins delete" on public.media_assets
  for delete to authenticated using (public.has_business_role(business_id, array['owner', 'admin']));

-- 4 · Límite de intentos (ventana deslizante) compartido por todas las instancias.
-- Sin políticas: nadie la lee por la API; sólo la función (con la service role).
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null check (length(key) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_key_created_idx on public.rate_limit_events (key, created_at desc);
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from public, anon, authenticated;

-- Registra un intento y devuelve false si la clave ya llegó al límite en la ventana.
-- El candado por clave hace que dos pedidos simultáneos no pasen ambos el último cupo.
create or replace function public.rate_limit_consume(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  if p_key is null or length(p_key) not between 1 and 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  delete from public.rate_limit_events
    where key = p_key and created_at < now() - make_interval(secs => p_window_seconds);
  select count(*) into recent from public.rate_limit_events where key = p_key;
  if recent >= p_limit then
    return false;
  end if;
  insert into public.rate_limit_events (key) values (p_key);
  -- Limpieza ocasional de claves que no volvieron (evita que la tabla crezca sin fin).
  if random() < 0.01 then
    delete from public.rate_limit_events where created_at < now() - interval '2 days';
  end if;
  return true;
end;
$$;

revoke execute on function public.rate_limit_consume(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_consume(text, integer, integer) to service_role;
