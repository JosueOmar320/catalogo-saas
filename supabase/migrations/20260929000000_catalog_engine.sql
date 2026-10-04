-- =============================================================================
-- Vitrina · v3 "Constructor de catálogos comerciales"
-- - Atributos personalizados por catálogo (definiciones en JSONB). Los valores
--   viven en catalog_items.attributes.values (columna JSONB existente).
-- - La configuración de PDF v2 (bloques) y el formato de precio viven en
--   columnas JSONB existentes (catalogs.pdf y catalogs.settings): sin cambios.
-- - get_public_catalog no cambia: to_jsonb(catalog) ya incluye attribute_defs.
-- =============================================================================

alter table public.catalogs
  add column if not exists attribute_defs jsonb not null default '[]'::jsonb
  check (jsonb_typeof(attribute_defs) = 'array' and jsonb_array_length(attribute_defs) <= 40);
