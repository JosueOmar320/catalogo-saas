-- =============================================================================
-- Plantillas de sección guardadas por el negocio ("Guardar como plantilla" en
-- el editor). Sólo las ven y usan los miembros del negocio. Máximo 50 por
-- negocio (también si se insertan directo por la API).
-- =============================================================================

create table if not exists public.section_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  section jsonb not null check (jsonb_typeof(section) = 'object' and pg_column_size(section) <= 200000),
  created_at timestamptz not null default now()
);
create index if not exists section_templates_business_idx on public.section_templates (business_id, created_at desc);

alter table public.section_templates enable row level security;
revoke all on public.section_templates from public, anon, authenticated;
grant select, insert, update, delete on public.section_templates to authenticated;

create policy "section templates: members all" on public.section_templates
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create or replace function public.enforce_section_template_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.section_templates where business_id = new.business_id) >= 50 then
    raise exception 'section_template_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_section_template_limit() from public, anon, authenticated;

drop trigger if exists section_templates_limit on public.section_templates;
create trigger section_templates_limit before insert on public.section_templates
  for each row execute function public.enforce_section_template_limit();
