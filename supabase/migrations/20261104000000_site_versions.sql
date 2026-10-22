-- =============================================================================
-- Historial de versiones del sitio: cada guardado del editor deja una copia
-- del diseño (tema), la navegación y las páginas publicadas o no. El dueño
-- puede abrir una versión anterior en el editor (como borrador: se aplica al
-- guardar) o guardar una versión con nombre ("Antes del rediseño").
--
-- · Las versiones sólo se crean con record_site_version (SECURITY DEFINER):
--   lee el sitio tal como quedó guardado, así la copia siempre es real.
-- · Retención: las 30 más recientes, más la última de cada día durante 60
--   días; las que tienen nombre se conservan (máximo 20 por sitio).
-- · Productos, ajustes y contacto NO se versionan: sólo lo que edita el editor.
-- =============================================================================

create table if not exists public.site_versions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  catalog_id  uuid not null references public.catalogs (id) on delete cascade,
  label       text check (label is null or char_length(label) between 1 and 80),
  author_name text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  page_count  int not null default 0,
  bytes       int not null default 0,
  -- {"theme": {...}, "navigation": {...}, "pages": [{id, title, slug, template, is_home, is_published, sections, style, seo}]}
  snapshot    jsonb not null
);
create index if not exists site_versions_catalog_idx on public.site_versions (catalog_id, created_at desc);
create index if not exists site_versions_business_idx on public.site_versions (business_id);

alter table public.site_versions enable row level security;

-- El historial es del editor: lo ven y lo gestionan owner/admin (como las páginas).
drop policy if exists "site versions: admins read" on public.site_versions;
create policy "site versions: admins read" on public.site_versions
  for select to authenticated using (public.has_business_role(business_id, array['owner', 'admin']));
drop policy if exists "site versions: admins rename" on public.site_versions;
create policy "site versions: admins rename" on public.site_versions
  for update to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']))
  with check (public.has_business_role(business_id, array['owner', 'admin']));
drop policy if exists "site versions: admins delete" on public.site_versions;
create policy "site versions: admins delete" on public.site_versions
  for delete to authenticated using (public.has_business_role(business_id, array['owner', 'admin']));

-- Sin insert directo (sólo la función) y sólo se puede cambiar el nombre.
revoke all on public.site_versions from anon;
revoke insert, update on public.site_versions from authenticated;
grant select, delete on public.site_versions to authenticated;
grant update (label) on public.site_versions to authenticated;

-- Copia del sitio tal como está guardado (null si no tiene páginas).
create or replace function public.site_snapshot(p_catalog_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'theme', c.theme,
    'navigation', c.navigation,
    'pages', (
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'slug', p.slug, 'template', p.template, 'is_home', p.is_home,
        'is_published', p.is_published, 'sections', p.sections, 'style', p.style, 'seo', p.seo
      ) order by p.position, p.created_at)
      from public.catalog_pages p
      where p.catalog_id = c.id and p.deleted_at is null
    )
  )
  from public.catalogs c
  where c.id = p_catalog_id and c.deleted_at is null
    and exists (select 1 from public.catalog_pages p where p.catalog_id = c.id and p.deleted_at is null);
$$;
revoke execute on function public.site_snapshot(uuid) from public, anon, authenticated;

-- Retención: las 30 más recientes sin nombre + la última de cada día (60 días).
create or replace function public.prune_site_versions(p_catalog_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
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
$$;
revoke execute on function public.prune_site_versions(uuid) from public, anon, authenticated;

-- Registra la versión actual del sitio. Sin nombre: la llama el guardado del
-- editor (si nada cambió desde la última, no repite). Con nombre: "Guardar
-- versión". Devuelve el id (o null si el sitio no tiene páginas).
create or replace function public.record_site_version(p_catalog_id uuid, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_snapshot jsonb;
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_last_id uuid;
  v_last_snapshot jsonb;
  v_id uuid;
  v_bytes int;
begin
  select business_id into v_business from public.catalogs where id = p_catalog_id and deleted_at is null;
  if v_business is null or not public.has_business_role(v_business, array['owner', 'admin']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_label is not null and char_length(v_label) > 80 then
    raise exception 'label_too_long' using errcode = 'P0001';
  end if;

  -- Un registro a la vez por sitio (mismo candado que save_site).
  perform pg_advisory_xact_lock(hashtextextended('site:' || p_catalog_id::text, 0));

  v_snapshot := public.site_snapshot(p_catalog_id);
  if v_snapshot is null then
    return null;
  end if;
  v_bytes := octet_length(v_snapshot::text);
  -- Una copia enorme no se guarda (el sitio igual se guardó).
  if v_bytes > 5 * 1024 * 1024 then
    raise exception 'version_too_large' using errcode = 'P0001';
  end if;

  if v_label is null then
    select id, snapshot into v_last_id, v_last_snapshot from public.site_versions
    where catalog_id = p_catalog_id order by created_at desc limit 1;
    if v_last_id is not null and v_last_snapshot = v_snapshot then
      return v_last_id;
    end if;
  elsif (select count(*) from public.site_versions where catalog_id = p_catalog_id and label is not null) >= 20 then
    raise exception 'version_limit' using errcode = 'P0001';
  end if;

  insert into public.site_versions (business_id, catalog_id, label, author_name, created_by, page_count, bytes, snapshot)
  values (
    v_business, p_catalog_id, v_label,
    (select coalesce(nullif(p.full_name, ''), p.username) from public.profiles p where p.id = (select auth.uid())),
    (select auth.uid()),
    jsonb_array_length(v_snapshot -> 'pages'), v_bytes, v_snapshot
  )
  returning id into v_id;

  perform public.prune_site_versions(p_catalog_id);
  return v_id;
end;
$$;
revoke execute on function public.record_site_version(uuid, text) from public, anon;
grant execute on function public.record_site_version(uuid, text) to authenticated;

-- Punto de partida: el sitio de hoy de cada negocio queda como primera versión.
insert into public.site_versions (business_id, catalog_id, page_count, bytes, snapshot, created_at)
select c.business_id, c.id, jsonb_array_length(s.snapshot -> 'pages'), octet_length(s.snapshot::text), s.snapshot,
       coalesce(public.site_version(c.id), now())
from public.catalogs c
cross join lateral (select public.site_snapshot(c.id) as snapshot) s
where c.deleted_at is null
  and s.snapshot is not null
  and not exists (select 1 from public.site_versions v where v.catalog_id = c.id);
