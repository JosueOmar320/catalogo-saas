-- =============================================================================
-- Cuenta demo: «Probar el panel» crea, sin registro, un negocio de prueba
-- propio para cada visitante (con el café de ejemplo), que se borra solo.
--
-- · businesses.demo_expires_at: no nulo = negocio de prueba (y cuándo vence).
--   profiles.demo: la cuenta que lo usa. Ninguna de las dos la escribe un
--   miembro (no tienen permiso de columna); las fija create_demo_business.
-- · Plan «demo» (oculto): límites chicos, sin dominio propio ni código propio.
-- · create_demo_business / purge_demo_business: sólo la service role (el
--   servidor, después de crear o antes de borrar la cuenta de Auth).
-- · Un negocio de prueba no se publica (trigger en catalogs): se ve con la
--   vista previa. Así nada de lo que escriba un visitante queda público.
-- · La auditoría no registra los negocios ni las cuentas de prueba, y
--   admin_stats no los cuenta: el panel de administración sólo ve lo real.
-- =============================================================================

alter table public.businesses add column if not exists demo_expires_at timestamptz;
alter table public.profiles add column if not exists demo boolean not null default false;
create index if not exists businesses_demo_expires_idx on public.businesses (demo_expires_at) where demo_expires_at is not null;
comment on column public.businesses.demo_expires_at is 'Negocio de prueba de «Probar el panel»: cuándo se borra. Null = negocio real.';
comment on column public.profiles.demo is 'Cuenta de prueba de «Probar el panel» (se borra con su negocio).';

insert into public.plans (id, name, sort_order, limits, features, is_public)
values (
  'demo', 'Demo', 99,
  '{"max_catalogs": 1, "max_items": 40, "max_images_per_item": 3, "max_members": 1}',
  '{"pdf_export": true, "remove_branding": false, "custom_domain": false, "analytics": true, "custom_code": false}',
  false
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Auditoría: los negocios y las cuentas de prueba no dejan rastro.
-- (Igual que 20261102000000_hardening.sql, más los dos «return null» de prueba.)
-- -----------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_changed jsonb := '[]'::jsonb;
  v_business uuid;
  v_entity text;
begin
  -- Pasos transitorios (p. ej. el slug temporal de save_site): no son un cambio real.
  if coalesce(current_setting('vitrina.skip_audit', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key)
      and n.key not in ('updated_at', 'last_login_at');
    if jsonb_array_length(v_changed) = 0 then
      return null;
    end if;
  end if;

  v_business := case
    when tg_table_name = 'businesses' then (v_row ->> 'id')::uuid
    when v_row ? 'business_id' then (v_row ->> 'business_id')::uuid
    else null
  end;

  -- Cuenta demo: ni su negocio ni su perfil van a la auditoría.
  if tg_table_name = 'profiles' and coalesce((v_row ->> 'demo')::boolean, false) then
    return null;
  end if;
  if v_business is not null and (
    (tg_table_name = 'businesses' and v_row ->> 'demo_expires_at' is not null)
    or exists (select 1 from public.businesses b where b.id = v_business and b.demo_expires_at is not null)
  ) then
    return null;
  end if;

  v_entity := case
    when tg_table_name = 'business_members' then (v_row ->> 'business_id') || ':' || (v_row ->> 'user_id')
    else v_row ->> 'id'
  end;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, business_id, metadata)
  values (
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_entity,
    v_business,
    case
      when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed)
      when tg_table_name = 'business_members' then jsonb_build_object('role', v_row ->> 'role')
      when v_row ? 'name' then jsonb_build_object('name', v_row ->> 'name')
      when v_row ? 'title' then jsonb_build_object('title', v_row ->> 'title')
      when v_row ? 'username' then jsonb_build_object('username', v_row ->> 'username')
      else '{}'::jsonb
    end
  );
  return null;
end;
$$;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Un negocio de prueba no se publica.
-- -----------------------------------------------------------------------------
create or replace function public.block_demo_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published')
    and exists (select 1 from public.businesses b where b.id = new.business_id and b.demo_expires_at is not null)
  then
    raise exception 'demo_cannot_publish' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.block_demo_publish() from public, anon, authenticated;
drop trigger if exists catalogs_block_demo_publish on public.catalogs;
create trigger catalogs_block_demo_publish before insert or update of status on public.catalogs
  for each row execute function public.block_demo_publish();

-- -----------------------------------------------------------------------------
-- Alta: negocio, membresía de dueño y catálogo, ya con el contenido base.
-- La cuenta de Auth la crea antes el servidor (Admin API).
-- -----------------------------------------------------------------------------
create or replace function public.create_demo_business(
  p_owner uuid,
  p_name text,
  p_slug text,
  p_hours int default 24,
  p_slogan text default null,
  p_description text default null,
  p_contact jsonb default '{}'::jsonb,
  p_social_links jsonb default '[]'::jsonb,
  p_theme jsonb default '{}'::jsonb,
  p_settings jsonb default '{}'::jsonb,
  p_attribute_defs jsonb default '[]'::jsonb,
  p_navigation jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_catalog uuid;
begin
  if not exists (select 1 from public.profiles where id = p_owner) then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if not public.is_business_slug_available(p_slug) then
    raise exception 'slug_unavailable' using errcode = 'P0001';
  end if;

  -- Activa: Auth crea la cuenta y escribe su app_metadata en pasos separados, así que
  -- handle_new_user la ve sin «provisioned» (igual que el alta del admin, que la activa después).
  update public.profiles set demo = true, status = 'active' where id = p_owner;

  insert into public.businesses (name, slug, slogan, description, contact, social_links, plan_id, created_by, demo_expires_at)
  values (
    p_name, p_slug, p_slogan, p_description,
    coalesce(p_contact, '{}'::jsonb), coalesce(p_social_links, '[]'::jsonb),
    'demo', p_owner, now() + make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 72)))
  )
  returning id into v_business;

  insert into public.business_members (business_id, user_id, role) values (v_business, p_owner, 'owner');

  insert into public.catalogs (business_id, name, slug, is_default, theme, settings, attribute_defs, navigation)
  values (v_business, p_name, 'principal', true, coalesce(p_theme, '{}'::jsonb), coalesce(p_settings, '{}'::jsonb), coalesce(p_attribute_defs, '[]'::jsonb), coalesce(p_navigation, '{}'::jsonb))
  returning id into v_catalog;

  return jsonb_build_object('business_id', v_business, 'catalog_id', v_catalog);
end;
$$;
revoke execute on function public.create_demo_business(uuid, text, text, int, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_demo_business(uuid, text, text, int, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Baja: el negocio de prueba con todo su contenido (cascada), sus perfiles de
-- prueba y cualquier rastro en la auditoría. Devuelve las cuentas para que el
-- servidor las borre de Auth (y antes, sus archivos de Storage).
-- -----------------------------------------------------------------------------
create or replace function public.purge_demo_business(p_business uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
begin
  if not exists (select 1 from public.businesses where id = p_business and demo_expires_at is not null) then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;
  perform set_config('vitrina.skip_audit', 'on', true);
  select coalesce(array_agg(user_id), '{}') into v_users from public.business_members where business_id = p_business;
  delete from public.businesses where id = p_business;
  -- Sólo cuentas de prueba: una cuenta real nunca se borra por aquí.
  select coalesce(array_agg(id), '{}') into v_users from public.profiles where id = any(v_users) and demo;
  delete from public.profiles where id = any(v_users);
  delete from public.audit_log where business_id = p_business or actor_id = any(v_users);
  return v_users;
end;
$$;
revoke execute on function public.purge_demo_business(uuid) from public, anon, authenticated;
grant execute on function public.purge_demo_business(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Métricas del panel de administración: sin cuentas ni negocios de prueba.
-- (Igual que 20261005000000_performance.sql, con los filtros de prueba.)
-- -----------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when not public.is_platform_admin() then null else jsonb_build_object(
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'admins', count(*) filter (where platform_role = 'admin'),
        'recent', count(*) filter (where last_login_at > now() - interval '7 days')
      ) from public.profiles where not demo
    ),
    'businesses', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'suspended', count(*) filter (where status = 'suspended')
      ) from public.businesses where deleted_at is null and demo_expires_at is null
    ),
    'catalogs', (
      select jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where c.status = 'published' and c.is_active),
        'inactive', count(*) filter (where not c.is_active)
      ) from public.catalogs c
      join public.businesses b on b.id = c.business_id
      where c.deleted_at is null and b.demo_expires_at is null
    ),
    'demos', (select count(*) from public.businesses where demo_expires_at is not null)
  ) end;
$$;
