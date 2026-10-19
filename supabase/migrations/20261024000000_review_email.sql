-- =============================================================================
-- Aviso semanal por correo con los pendientes de "Revisa tu catálogo"
-- (productos sin foto, sin precio, sin categoría).
--
-- · profiles.notify_catalog_review: activado por defecto; cada usuario lo
--   apaga o lo vuelve a activar en "Mi cuenta" o con el enlace del correo.
-- · notification_log: registro de envíos para no repetir el aviso en la misma
--   semana. Sólo lo usa el servidor (service role): sin políticas ni grants.
-- Sólo agrega una columna y una tabla; no toca datos.
-- =============================================================================

alter table public.profiles
  add column if not exists notify_catalog_review boolean not null default true;

-- Cada usuario cambia su propia preferencia (la política "profiles: update own" ya existe).
grant update (notify_catalog_review) on public.profiles to authenticated;

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('catalog_review')),
  sent_at timestamptz not null default now()
);
create index if not exists notification_log_lookup_idx on public.notification_log (user_id, business_id, kind, sent_at desc);

alter table public.notification_log enable row level security;
revoke all on public.notification_log from public, anon, authenticated;
