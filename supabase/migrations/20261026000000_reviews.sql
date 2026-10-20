-- =============================================================================
-- Reseñas de clientes: un visitante deja estrellas y un comentario (del negocio
-- o de un producto); el negocio las aprueba antes de que se publiquen.
--
-- Escritura del público: únicamente submit_review(), ejecutable sólo con la
-- service role. La llama /api/reviews después del límite de intentos por IP.
-- Valida en la base: negocio activo con catálogo publicado y reseñas activas;
-- el producto (si lo hay) debe ser visible y de ese catálogo. Entra pendiente.
-- Lectura pública: get_public_reviews() devuelve sólo las aprobadas (sin
-- datos internos). El negocio (sus miembros) lee, aprueba, rechaza y borra.
-- No se guarda nada del visitante más allá del nombre que escribió.
-- =============================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  item_id uuid,
  name text not null check (char_length(name) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 600),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (item_id, business_id) references public.catalog_items (id, business_id) on delete cascade
);
create index if not exists reviews_business_status_idx on public.reviews (business_id, status, created_at desc);
create index if not exists reviews_item_idx on public.reviews (item_id) where item_id is not null;

alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated;
grant select, delete on public.reviews to authenticated;
-- El negocio sólo cambia el estado (aprobar o rechazar), no lo que escribió el cliente.
grant update (status, reviewed_at) on public.reviews to authenticated;

create policy "reviews: members read" on public.reviews
  for select to authenticated using (public.is_business_member(business_id));
create policy "reviews: members moderate" on public.reviews
  for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "reviews: members delete" on public.reviews
  for delete to authenticated using (public.is_business_member(business_id));

-- Deja una reseña pendiente. Devuelve false (sin guardar nada) si no corresponde.
create or replace function public.submit_review(p_business_slug text, p_item_slug text, p_name text, p_rating integer, p_body text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_catalog uuid;
  v_enabled boolean;
  v_item uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_body text := btrim(coalesce(p_body, ''));
begin
  if p_business_slug is null or p_rating is null or p_rating not between 1 and 5
     or char_length(v_name) not between 1 and 60 or char_length(v_body) > 600 then
    return false;
  end if;

  select b.id, c.id, coalesce((c.settings -> 'reviews' ->> 'enabled')::boolean, false)
    into v_business, v_catalog, v_enabled
  from public.businesses b
  join public.catalogs c on c.business_id = b.id
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  limit 1;
  if v_business is null or not v_enabled then
    return false;
  end if;

  if p_item_slug is not null then
    select i.id into v_item
    from public.catalog_items i
    where i.business_id = v_business and i.catalog_id = v_catalog and i.slug = p_item_slug
      and i.is_visible and i.deleted_at is null
    limit 1;
    if v_item is null then
      return false;
    end if;
  end if;

  insert into public.reviews (business_id, item_id, name, rating, body)
  values (v_business, v_item, v_name, p_rating, v_body);
  return true;
end;
$$;

revoke execute on function public.submit_review(text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.submit_review(text, text, text, integer, text) to service_role;

-- Reseñas aprobadas de un sitio publicado (las más recientes primero).
create or replace function public.get_public_reviews(p_business_slug text)
returns table (id uuid, item_id uuid, name text, rating smallint, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.item_id, r.name, r.rating, r.body, r.created_at
  from public.reviews r
  join public.businesses b on b.id = r.business_id
  join public.catalogs c on c.business_id = b.id and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and r.status = 'approved'
    and coalesce((c.settings -> 'reviews' ->> 'enabled')::boolean, false)
    -- La de un producto oculto o eliminado no se muestra.
    and (r.item_id is null or exists (
      select 1 from public.catalog_items i where i.id = r.item_id and i.is_visible and i.deleted_at is null
    ))
  order by r.created_at desc
  limit 500;
$$;

revoke execute on function public.get_public_reviews(text) from public;
grant execute on function public.get_public_reviews(text) to anon, authenticated, service_role;
