-- =============================================================================
-- Búsquedas sin resultados del sitio publicado: qué escribieron los visitantes
-- en el buscador del catálogo y no encontraron. Sólo el término (en
-- minúsculas) y cuántas veces por negocio y día (UTC); nada del visitante.
--
-- Escritura: únicamente record_search_miss(), ejecutable sólo con la service
-- role. La llama /api/search-misses después del límite de intentos por IP (y
-- de descartar términos que parecen datos personales). Valida en la base:
-- negocio activo con catálogo publicado; como mucho 200 términos distintos
-- por negocio y día.
-- Lectura: los miembros del negocio (RLS). Sólo agrega una tabla y una función.
-- =============================================================================

create table if not exists public.search_miss_stats_daily (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  term text not null check (char_length(term) between 2 and 60),
  searches integer not null default 0 check (searches >= 0),
  primary key (business_id, day, term)
);

alter table public.search_miss_stats_daily enable row level security;
revoke all on public.search_miss_stats_daily from public, anon, authenticated;
grant select on public.search_miss_stats_daily to authenticated;

create policy "search misses: members read" on public.search_miss_stats_daily
  for select to authenticated using (public.is_business_member(business_id));

-- Cuenta una búsqueda sin resultados. Devuelve false (sin guardar nada) si no corresponde.
create or replace function public.record_search_miss(p_business_slug text, p_term text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_day date := (now() at time zone 'utc')::date;
  v_term text := lower(regexp_replace(btrim(coalesce(p_term, '')), '\s+', ' ', 'g'));
begin
  if p_business_slug is null or length(p_business_slug) > 64 or char_length(v_term) not between 2 and 60 then
    return false;
  end if;

  -- Mismo criterio que el sitio público (get_public_catalog).
  select b.id into v_business
  from public.businesses b
  join public.catalogs c on c.business_id = b.id
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  limit 1;
  if v_business is null then
    return false;
  end if;

  -- Tope de términos distintos por negocio y día: nadie llena la tabla escribiendo basura.
  if not exists (select 1 from public.search_miss_stats_daily s where s.business_id = v_business and s.day = v_day and s.term = v_term)
     and (select count(*) from public.search_miss_stats_daily s where s.business_id = v_business and s.day = v_day) >= 200 then
    return false;
  end if;

  insert into public.search_miss_stats_daily (business_id, day, term, searches)
  values (v_business, v_day, v_term, 1)
  on conflict (business_id, day, term) do update set searches = public.search_miss_stats_daily.searches + 1;
  return true;
end;
$$;

revoke execute on function public.record_search_miss(text, text) from public, anon, authenticated;
grant execute on function public.record_search_miss(text, text) to service_role;
