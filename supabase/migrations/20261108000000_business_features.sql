-- =============================================================================
-- Funciones por negocio: el administrador de la plataforma puede apagar (o
-- encender) funciones concretas para un negocio y todos sus usuarios:
-- Garfield, catálogo PDF, bandeja de pedidos y clientes, estadísticas e
-- importación desde CSV.
--
-- · businesses.feature_overrides: { "<función>": true|false }. Sin la clave =
--   lo que diga el plan (y si el plan no dice nada, encendida).
-- · Los miembros no pueden cambiarlo (permisos por columna en businesses: no
--   se les concede update sobre esta columna).
-- · admin_set_business_features: sólo administradores; valida nombres y
--   valores. Queda en la auditoría como cualquier cambio del negocio.
-- =============================================================================

alter table public.businesses add column if not exists feature_overrides jsonb not null default '{}'::jsonb;
alter table public.businesses drop constraint if exists businesses_feature_overrides_object;
alter table public.businesses add constraint businesses_feature_overrides_object check (jsonb_typeof(feature_overrides) = 'object');
comment on column public.businesses.feature_overrides is 'Funciones decididas por el administrador para este negocio: {"assistant": false, …}. Sin clave = según el plan.';

create or replace function public.admin_set_business_features(p_business uuid, p_features jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  if p_features is null or jsonb_typeof(p_features) <> 'object' or exists (
    select 1 from jsonb_each(p_features) e
    where e.key not in ('assistant', 'pdf_export', 'orders', 'analytics', 'import') or jsonb_typeof(e.value) <> 'boolean'
  ) then
    raise exception 'invalid_features' using errcode = 'P0001';
  end if;
  update public.businesses set feature_overrides = p_features where id = p_business and deleted_at is null;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_set_business_features(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_business_features(uuid, jsonb) to authenticated;
