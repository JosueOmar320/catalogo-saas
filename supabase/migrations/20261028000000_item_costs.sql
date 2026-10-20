-- =============================================================================
-- Costo de cada producto: sólo lo ven los miembros del negocio (para su
-- margen). Va en su propia tabla y NO en catalog_items: el catálogo público
-- (get_public_catalog) publica la fila completa de cada ítem.
-- Sólo agrega una tabla (sin funciones ni cambios en lo existente).
-- =============================================================================

create table if not exists public.item_costs (
  item_id uuid primary key,
  business_id uuid not null,
  cost numeric(12, 2) not null check (cost >= 0 and cost <= 99999999),
  updated_at timestamptz not null default now(),
  foreign key (item_id, business_id) references public.catalog_items (id, business_id) on delete cascade
);
create index if not exists item_costs_business_idx on public.item_costs (business_id);

alter table public.item_costs enable row level security;
revoke all on public.item_costs from public, anon, authenticated;
grant select, insert, update, delete on public.item_costs to authenticated;

create policy "item costs: members all" on public.item_costs
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
