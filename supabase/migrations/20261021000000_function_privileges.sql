-- =============================================================================
-- Privilegios mínimos sobre funciones (Security Advisor de Supabase).
-- Postgres concede EXECUTE a PUBLIC por defecto y Supabase además a anon y
-- authenticated. Estas funciones no necesitan llamarse directamente por la API:
--
-- · Funciones de trigger: Postgres no verifica EXECUTE al dispararse un
--   trigger, así que revocarlo no cambia nada para los triggers.
-- · plan_limit y require_platform_admin: sólo las usan funciones SECURITY
--   DEFINER (corren como su dueño, que conserva el permiso).
-- · is_platform_admin / is_business_member / has_business_role: las políticas
--   RLS las evalúan para `authenticated`; `anon` no las necesita.
--
-- Se mantienen a propósito: get_public_catalog (catálogo público) y las RPC
-- de administración (verifican al administrador por dentro).
-- Sólo cambia permisos; no toca datos.
-- =============================================================================

revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.enforce_image_limit() from public, anon, authenticated;
revoke execute on function public.enforce_item_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.plan_limit(uuid, text) from public, anon, authenticated;
revoke execute on function public.require_platform_admin() from public, anon, authenticated;

revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.is_business_member(uuid) from public, anon;
revoke execute on function public.has_business_role(uuid, text[]) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, text[]) to authenticated;
