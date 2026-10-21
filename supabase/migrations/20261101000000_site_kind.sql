-- =============================================================================
-- Tipo de sitio: "catalog" (negocio con productos, servicios y pedidos) o
-- "website" (sitio web sin catálogo: portafolio, organización, landing…).
-- Lo decide el administrador al crear la cuenta (y puede cambiarlo); el panel
-- y el editor ocultan lo que no aplica. Cambiarlo no borra datos.
-- Los miembros no pueden cambiarlo (permisos por columna en businesses).
-- =============================================================================

alter table public.businesses add column if not exists site_kind text not null default 'catalog';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'businesses_site_kind_check') then
    alter table public.businesses add constraint businesses_site_kind_check check (site_kind in ('catalog', 'website'));
  end if;
end;
$$;
comment on column public.businesses.site_kind is 'catalog = negocio con catálogo; website = sitio web sin productos ni pedidos (lo decide el administrador).';

create or replace function public.admin_set_site_kind(p_business uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  if p_kind not in ('catalog', 'website') then
    raise exception 'invalid_site_kind' using errcode = 'P0001';
  end if;
  update public.businesses set site_kind = p_kind where id = p_business and deleted_at is null;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_set_site_kind(uuid, text) from public, anon;
grant execute on function public.admin_set_site_kind(uuid, text) to authenticated;
