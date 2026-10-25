-- =============================================================================
-- Analítica de ventas: el recorrido de los visitantes del sitio publicado
-- (visitas → vieron un producto → agregaron al pedido → enviaron el pedido) y
-- de dónde llegaron (Instagram, QR, WhatsApp, Google…).
--
-- · Sólo contadores por día, origen y producto: no se guarda nada del
--   visitante (el sitio recuerda en su navegador, por sesión, de dónde llegó
--   y qué pasos ya contó).
-- · funnel_stats_daily: visitas (sesiones) y pasos por origen.
-- · item_cart_stats_daily: veces que cada producto se agregó a un pedido.
-- · record_funnel: lo llama el servidor (service role) desde /api/funnel y
--   /api/orders. Mismo criterio que record_view: sólo sitios publicados.
-- · Retención: 400 días, como las demás estadísticas (purge_analytics_data,
--   la llama el cron semanal).
-- =============================================================================

create table if not exists public.funnel_stats_daily (
  business_id    uuid not null references public.businesses (id) on delete cascade,
  day            date not null,
  source         text not null check (source in ('direct', 'instagram', 'facebook', 'whatsapp', 'tiktok', 'google', 'search', 'x', 'qr', 'reviews', 'email', 'referral', 'other')),
  sessions       integer not null default 0 check (sessions >= 0),
  viewed_product integer not null default 0 check (viewed_product >= 0),
  started_cart   integer not null default 0 check (started_cart >= 0),
  sent_order     integer not null default 0 check (sent_order >= 0),
  primary key (business_id, day, source)
);

create table if not exists public.item_cart_stats_daily (
  business_id uuid not null,
  day         date not null,
  item_id     uuid not null,
  adds        integer not null default 0 check (adds >= 0),
  primary key (business_id, day, item_id),
  foreign key (item_id, business_id) references public.catalog_items (id, business_id) on delete cascade
);
create index if not exists item_cart_stats_daily_item_idx on public.item_cart_stats_daily (item_id, business_id);

alter table public.funnel_stats_daily enable row level security;
alter table public.item_cart_stats_daily enable row level security;
revoke all on public.funnel_stats_daily, public.item_cart_stats_daily from public, anon, authenticated;
grant select on public.funnel_stats_daily, public.item_cart_stats_daily to authenticated;

drop policy if exists "funnel stats: members read" on public.funnel_stats_daily;
create policy "funnel stats: members read" on public.funnel_stats_daily
  for select to authenticated using (public.is_business_member(business_id));
drop policy if exists "item cart stats: members read" on public.item_cart_stats_daily;
create policy "item cart stats: members read" on public.item_cart_stats_daily
  for select to authenticated using (public.is_business_member(business_id));

-- p_event: session (llegó al sitio) · product (vio su primera ficha) ·
-- add (agregó un producto; p_cart_start = era el primero del pedido) · order (envió el pedido).
create or replace function public.record_funnel(p_business_slug text, p_event text, p_source text, p_item_id uuid default null, p_cart_start boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_catalog uuid;
  v_item uuid;
  v_day date := (now() at time zone 'utc')::date;
  v_source text := case when p_source in ('direct', 'instagram', 'facebook', 'whatsapp', 'tiktok', 'google', 'search', 'x', 'qr', 'reviews', 'email', 'referral') then p_source else 'other' end;
begin
  if p_business_slug is null or length(p_business_slug) > 64 or p_event not in ('session', 'product', 'add', 'order') then
    return false;
  end if;

  -- Mismo criterio que el sitio público (get_public_catalog).
  select b.id, c.id into v_business, v_catalog
  from public.businesses b
  join public.catalogs c on c.business_id = b.id
  where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
    and c.is_default and c.is_active and c.status = 'published' and c.deleted_at is null
  limit 1;
  if v_business is null then
    return false;
  end if;

  if p_event = 'add' and p_item_id is not null then
    select i.id into v_item
    from public.catalog_items i
    where i.id = p_item_id and i.business_id = v_business and i.catalog_id = v_catalog and i.is_visible and i.deleted_at is null;
    if v_item is not null then
      insert into public.item_cart_stats_daily (business_id, day, item_id, adds)
      values (v_business, v_day, v_item, 1)
      on conflict (business_id, day, item_id) do update set adds = public.item_cart_stats_daily.adds + 1;
    end if;
  end if;
  -- Un producto más en un pedido ya empezado no es un paso nuevo del recorrido.
  if p_event = 'add' and not coalesce(p_cart_start, false) then
    return true;
  end if;

  insert into public.funnel_stats_daily (business_id, day, source, sessions, viewed_product, started_cart, sent_order)
  values (v_business, v_day, v_source, (p_event = 'session')::int, (p_event = 'product')::int, (p_event = 'add')::int, (p_event = 'order')::int)
  on conflict (business_id, day, source) do update set
    sessions = public.funnel_stats_daily.sessions + excluded.sessions,
    viewed_product = public.funnel_stats_daily.viewed_product + excluded.viewed_product,
    started_cart = public.funnel_stats_daily.started_cart + excluded.started_cart,
    sent_order = public.funnel_stats_daily.sent_order + excluded.sent_order;
  return true;
end;
$$;
revoke execute on function public.record_funnel(text, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.record_funnel(text, text, text, uuid, boolean) to service_role;

-- Retención (la llama el cron semanal junto con purge_old_data).
create or replace function public.purge_analytics_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_funnel integer;
  v_cart integer;
begin
  delete from public.funnel_stats_daily where day < current_date - 400;
  get diagnostics v_funnel = row_count;
  delete from public.item_cart_stats_daily where day < current_date - 400;
  get diagnostics v_cart = row_count;
  return jsonb_build_object('funnel_stats', v_funnel, 'item_cart_stats', v_cart);
end;
$$;
revoke execute on function public.purge_analytics_data() from public, anon, authenticated;
grant execute on function public.purge_analytics_data() to service_role;
