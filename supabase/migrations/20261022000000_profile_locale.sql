-- =============================================================================
-- Idioma preferido de cada usuario (es | en). La app lo guarda en una cookie
-- y aquí, para recordarlo en otros dispositivos (se aplica al iniciar sesión).
-- NULL = sin preferencia (se usa el idioma del navegador). Sólo agrega columna.
-- =============================================================================

alter table public.profiles
  add column if not exists locale text check (locale is null or locale in ('es', 'en'));

-- Cada usuario puede cambiar su propio idioma (la política de update sobre su
-- fila ya existe: "profiles: update own"); el resto de columnas siguen protegidas.
grant update (locale) on public.profiles to authenticated;
