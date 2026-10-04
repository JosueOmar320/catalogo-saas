-- =============================================================================
-- Rendimiento: conteos del panel de administración en SQL.
-- Antes el panel descargaba TODAS las páginas e ítems de la plataforma (y
-- todos los perfiles, negocios y catálogos) para contarlos en memoria; además
-- PostgREST corta en 1000 filas, así que los números eran incorrectos a escala.
-- SECURITY INVOKER: devuelven datos sólo a administradores (RLS + is_platform_admin()).
-- Sólo agrega funciones; no cambia datos.
-- =============================================================================

create or replace function public.admin_catalog_counts()
returns table (catalog_id uuid, pages bigint, items bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Cada subconsulta usa los índices parciales (catalog_id, position) where deleted_at is null.
  select
    c.id,
    (select count(*) from public.catalog_pages p where p.catalog_id = c.id and p.deleted_at is null),
    (select count(*) from public.catalog_items i where i.catalog_id = c.id and i.deleted_at is null)
  from public.catalogs c
  where c.deleted_at is null and public.is_platform_admin();
$$;

create or replace function public.admin_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when not public.is_platform_admin() then null else jsonb_build_object(
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'admins', count(*) filter (where platform_role = 'admin'),
        'recent', count(*) filter (where last_login_at > now() - interval '7 days')
      ) from public.profiles
    ),
    'businesses', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'suspended', count(*) filter (where status = 'suspended')
      ) from public.businesses where deleted_at is null
    ),
    'catalogs', (
      select jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where status = 'published' and is_active),
        'inactive', count(*) filter (where not is_active)
      ) from public.catalogs where deleted_at is null
    )
  ) end;
$$;

revoke execute on function public.admin_catalog_counts() from public, anon;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_catalog_counts() to authenticated;
grant execute on function public.admin_stats() to authenticated;
