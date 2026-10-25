-- =============================================================================
-- Avisos de pedidos al instante (notificaciones push del navegador).
--
-- · push_subscriptions: un dispositivo (navegador) de un usuario que activó
--   los avisos. Cada usuario ve y borra sólo los suyos; se registran con
--   register_push_subscription (máximo 10 por usuario; si el dispositivo ya
--   estaba registrado por otra sesión, pasa al usuario actual).
-- · orders.push_notified_at: el aviso de cada pedido se manda una sola vez
--   (claim_order_push lo marca de forma atómica, aunque el sitio mande el
--   pedido dos veces).
-- · push_targets: a quién avisar de un pedido: los dispositivos de los
--   miembros activos del negocio. Sólo la service role (el servidor).
-- =============================================================================

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) between 20 and 200),
  auth            text not null check (char_length(auth) between 8 and 100),
  device          text check (char_length(device) <= 120),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failures        int not null default 0
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push: own read" on public.push_subscriptions;
create policy "push: own read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "push: own delete" on public.push_subscriptions;
create policy "push: own delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from public, anon, authenticated;
grant select (id, endpoint, device, created_at, last_success_at), delete on public.push_subscriptions to authenticated;

-- Registra (o reasigna) el dispositivo del usuario actual.
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Un dispositivo, un dueño: si otra sesión lo tenía, pasa a esta.
  delete from public.push_subscriptions where endpoint = p_endpoint;
  if (select count(*) from public.push_subscriptions where user_id = v_user) >= 10 then
    raise exception 'push_limit' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
  values (v_user, p_endpoint, p_p256dh, p_auth, nullif(left(btrim(coalesce(p_device, '')), 120), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

alter table public.orders add column if not exists push_notified_at timestamptz;

-- Marca el pedido como avisado y lo devuelve (una sola vez, sólo pedidos recientes).
create or replace function public.claim_order_push(p_business_slug text, p_reference text)
returns table (order_id uuid, business_id uuid, business_name text, reference text, customer_name text, items int, total numeric, currency text, partial boolean)
language sql
security definer
set search_path = ''
as $$
  update public.orders o
     set push_notified_at = now()
    from public.businesses b
   where b.slug = p_business_slug and b.deleted_at is null and b.status = 'active'
     and o.business_id = b.id
     and o.reference = p_reference
     and o.push_notified_at is null
     and o.created_at > now() - interval '10 minutes'
  returning o.id, b.id, b.name, o.reference, o.customer_name,
            (select coalesce(sum((l ->> 'qty')::int), 0)::int from jsonb_array_elements(o.lines) l),
            o.total, o.currency, o.partial;
$$;
revoke execute on function public.claim_order_push(text, text) from public, anon, authenticated;
grant execute on function public.claim_order_push(text, text) to service_role;

-- Dispositivos de los miembros activos del negocio, con el idioma de cada usuario.
create or replace function public.push_targets(p_business uuid)
returns table (id uuid, endpoint text, p256dh text, auth text, locale text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.endpoint, s.p256dh, s.auth, coalesce(p.locale, 'es')
  from public.push_subscriptions s
  join public.business_members m on m.user_id = s.user_id and m.business_id = p_business
  join public.profiles p on p.id = s.user_id and p.status = 'active'
  limit 200;
$$;
revoke execute on function public.push_targets(uuid) from public, anon, authenticated;
grant execute on function public.push_targets(uuid) to service_role;
