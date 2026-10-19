-- =============================================================================
-- Visitas del sitio publicado: páginas vistas por día y fichas de producto
-- vistas. Igual que los pedidos, sólo contadores agregados por negocio y día
-- (UTC): no se guarda nada del visitante (ni IP, ni cookies, ni la página de
-- origen).
--
-- Escritura: únicamente record_view(), ejecutable sólo con la service role.
-- La llama /api/views después del límite de intentos por IP. La función
-- valida en la base: negocio activo con catálogo publicado; una ficha cuenta
-- sólo si el ítem es visible y de ese catálogo.
-- Lectura: los miembros del negocio (RLS). Sólo agrega tablas y una función.
-- =============================================================================

create table if not exists public.site_view_stats_daily (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (business_id, day)
);

create table if not exists public.item_view_stats_daily (
  business_id uuid not null,
  day date not null,
  item_id uuid not null,
  views integer not null default 0 check (views >= 0),
  primary key (business_id, day, item_id),
  foreign key (item_id, business_id) references public.catalog_items (id, business_id) on delete cascade
);
create index if not exists item_view_stats_daily_item_idx on public.item_view_stats_daily (item_id, business_id);

alter table public.site_view_stats_daily enable row level security;
alter table public.item_view_stats_daily enable row level security;
revoke all on public.site_view_stats_daily, public.item_view_stats_daily from public, anon, authenticated;
grant select on public.site_view_stats_daily, public.item_view_stats_daily to authenticated;

create policy "site view stats: members read" on public.site_view_stats_daily
  for select to authenticated using (public.is_business_member(business_id));
create policy "item view stats: members read" on public.item_view_stats_daily
  for select to authenticated using (public.is_business_member(business_id));

-- Registra una página vista. p_item_slug: la ficha de producto o servicio (o null).
-- Devuelve false (sin registrar nada) si el negocio no tiene un sitio publicado.
create or replace function public.record_view(p_business_slug text, p_item_slug text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_catalog uuid;
  v_item uuid;
  v_day date := (now() at time zone 'utc')::date;
begin
  if p_business_slug is null or length(p_business_slug) > 64
     or (p_item_slug is not null and length(p_item_slug) > 120) then
    return false;
  end if;

  -- Mismo criterio que el sitio público (get_public_catalog).
  select b.id, c.id into v_business, v_catalog
  from public.businesses b
  join public.catalogs c on c.business_id = b.id
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  limit 1;
  if v_business is null then
    return false;
  end if;

  insert into public.site_view_stats_daily (business_id, day, views)
  values (v_business, v_day, 1)
  on conflict (business_id, day) do update set views = public.site_view_stats_daily.views + 1;

  if p_item_slug is not null then
    select i.id into v_item
    from public.catalog_items i
    where i.business_id = v_business and i.catalog_id = v_catalog and i.slug = p_item_slug
      and i.is_visible and i.deleted_at is null
    limit 1;
    if v_item is not null then
      insert into public.item_view_stats_daily (business_id, day, item_id, views)
      values (v_business, v_day, v_item, 1)
      on conflict (business_id, day, item_id) do update set views = public.item_view_stats_daily.views + 1;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.record_view(text, text) from public, anon, authenticated;
grant execute on function public.record_view(text, text) to service_role;
