-- =============================================================================
-- Respuestas a reseñas: el negocio contesta una reseña y la respuesta se
-- publica debajo de ella (si la reseña está aprobada). Sólo los miembros del
-- negocio escriben la respuesta (permiso por columna + la política de
-- moderación que ya existe); el texto del cliente sigue sin poder cambiarse.
-- get_public_reviews (la versión de 20261102000000_hardening) devuelve además
-- la respuesta: cambia sus columnas, por eso se vuelve a crear.
-- =============================================================================

alter table public.reviews add column if not exists reply text;
alter table public.reviews add column if not exists replied_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_reply_length') then
    alter table public.reviews add constraint reviews_reply_length check (reply is null or char_length(reply) between 1 and 1000);
  end if;
end;
$$;
grant update (reply, replied_at) on public.reviews to authenticated;

drop function if exists public.get_public_reviews(text);
create function public.get_public_reviews(p_business_slug text)
returns table (id uuid, item_id uuid, name text, rating smallint, body text, created_at timestamptz, reply text, replied_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.item_id, r.name, r.rating, r.body, r.created_at, r.reply, r.replied_at
  from public.reviews r
  join public.businesses b on b.id = r.business_id
  join public.catalogs c on c.business_id = b.id and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and r.status = 'approved'
    and coalesce((c.settings -> 'reviews' ->> 'enabled')::boolean, false)
    -- La de un producto oculto, eliminado o de otro catálogo del negocio no se muestra.
    and (r.item_id is null or exists (
      select 1 from public.catalog_items i where i.id = r.item_id and i.catalog_id = c.id and i.is_visible and i.deleted_at is null
    ))
  order by r.created_at desc
  limit 500;
$$;
revoke execute on function public.get_public_reviews(text) from public;
grant execute on function public.get_public_reviews(text) to anon, authenticated, service_role;
