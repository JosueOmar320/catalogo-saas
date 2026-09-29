import 'server-only';
import type { ServerSupabase } from '@/lib/supabase/server';
import { publicStorageUrl } from '@/lib/utils/storage';
import type { MemberRole, Tables } from '@/types/database';

/**
 * Consultas del panel de administración con la SESIÓN del admin: RLS concede
 * lectura a los administradores (is_platform_admin), sin service role.
 */

export type AdminUserRow = Tables<'profiles'> & { businesses: { id: string; name: string; role: MemberRole }[] };
export type AdminBusinessRow = Tables<'businesses'> & {
  owners: { id: string; username: string; fullName: string | null }[];
  members: number;
  catalogs: { id: string; name: string; status: string; isActive: boolean; isDefault: boolean }[];
};

export async function listUsers(supabase: ServerSupabase): Promise<AdminUserRow[]> {
  const [{ data: profiles }, { data: members }, { data: businesses }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('business_members').select('business_id, user_id, role'),
    supabase.from('businesses').select('id, name').is('deleted_at', null),
  ]);
  const names = new Map((businesses ?? []).map((b) => [b.id, b.name]));
  return (profiles ?? []).map((p) => ({
    ...p,
    businesses: (members ?? []).filter((m) => m.user_id === p.id && names.has(m.business_id)).map((m) => ({ id: m.business_id, name: names.get(m.business_id)!, role: m.role })),
  }));
}

export async function getUserDetail(supabase: ServerSupabase, id: string) {
  const users = await listUsers(supabase);
  return users.find((u) => u.id === id) ?? null;
}

export async function listBusinesses(supabase: ServerSupabase): Promise<AdminBusinessRow[]> {
  const [{ data: businesses }, { data: members }, { data: profiles }, { data: catalogs }] = await Promise.all([
    supabase.from('businesses').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('business_members').select('business_id, user_id, role'),
    supabase.from('profiles').select('id, username, full_name'),
    supabase.from('catalogs').select('id, business_id, name, status, is_active, is_default').is('deleted_at', null),
  ]);
  const people = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (businesses ?? []).map((b) => {
    const team = (members ?? []).filter((m) => m.business_id === b.id);
    return {
      ...b,
      owners: team.filter((m) => m.role === 'owner' && people.has(m.user_id)).map((m) => ({ id: m.user_id, username: people.get(m.user_id)!.username, fullName: people.get(m.user_id)!.full_name })),
      members: team.length,
      catalogs: (catalogs ?? []).filter((c) => c.business_id === b.id).map((c) => ({ id: c.id, name: c.name, status: c.status, isActive: c.is_active, isDefault: c.is_default })),
    };
  });
}

export async function getBusinessDetail(supabase: ServerSupabase, id: string) {
  const [{ data: business }, { data: members }, { data: catalogs }, { data: profiles }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_members').select('user_id, role, created_at').eq('business_id', id),
    supabase.from('catalogs').select('*').eq('business_id', id).is('deleted_at', null).order('created_at'),
    supabase.from('profiles').select('id, username, full_name, status'),
  ]);
  if (!business) return null;
  const people = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    business,
    logoUrl: publicStorageUrl(business.logo_path),
    members: (members ?? []).flatMap((m) => {
      const p = people.get(m.user_id);
      return p ? [{ userId: m.user_id, username: p.username, fullName: p.full_name, status: p.status, role: m.role, since: m.created_at }] : [];
    }),
    catalogs: catalogs ?? [],
    users: (profiles ?? []).map((p) => ({ id: p.id, username: p.username, fullName: p.full_name, status: p.status })),
  };
}

export async function listCatalogs(supabase: ServerSupabase) {
  const [{ data: catalogs }, { data: businesses }, { data: pages }, { data: items }] = await Promise.all([
    supabase.from('catalogs').select('id, business_id, name, slug, status, is_active, is_default, published_at, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }),
    supabase.from('businesses').select('id, name, slug, status').is('deleted_at', null),
    supabase.from('catalog_pages').select('catalog_id').is('deleted_at', null),
    supabase.from('catalog_items').select('catalog_id').is('deleted_at', null),
  ]);
  const byBusiness = new Map((businesses ?? []).map((b) => [b.id, b]));
  const count = (list: { catalog_id: string }[] | null, id: string) => (list ?? []).filter((x) => x.catalog_id === id).length;
  return (catalogs ?? []).flatMap((c) => {
    const business = byBusiness.get(c.business_id);
    return business ? [{ ...c, business, pages: count(pages, c.id), items: count(items, c.id) }] : [];
  });
}

export async function adminStats(supabase: ServerSupabase) {
  const [users, businesses, catalogs, audit] = await Promise.all([
    supabase.from('profiles').select('status, platform_role, last_login_at'),
    supabase.from('businesses').select('status').is('deleted_at', null),
    supabase.from('catalogs').select('status, is_active').is('deleted_at', null),
    listAudit(supabase, { limit: 12 }),
  ]);
  const u = users.data ?? [];
  const b = businesses.data ?? [];
  const c = catalogs.data ?? [];
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return {
    users: { total: u.length, active: u.filter((x) => x.status === 'active').length, admins: u.filter((x) => x.platform_role === 'admin').length, recent: u.filter((x) => x.last_login_at && Date.parse(x.last_login_at) > weekAgo).length },
    businesses: { total: b.length, active: b.filter((x) => x.status === 'active').length, suspended: b.filter((x) => x.status === 'suspended').length },
    catalogs: { total: c.length, published: c.filter((x) => x.status === 'published' && x.is_active).length, inactive: c.filter((x) => !x.is_active).length },
    audit: audit.rows,
  };
}

export type AuditRow = Tables<'audit_log'> & { actor: string | null; businessName: string | null };

export async function listAudit(supabase: ServerSupabase, { limit = 50, offset = 0, entity, action }: { limit?: number; offset?: number; entity?: string; action?: string } = {}) {
  let query = supabase.from('audit_log').select('*').order('id', { ascending: false }).range(offset, offset + limit);
  if (entity) query = query.eq('entity_type', entity);
  if (action) query = query.ilike('action', `%${action}%`);
  const [{ data: rows }, { data: profiles }, { data: businesses }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, username'),
    supabase.from('businesses').select('id, name'),
  ]);
  const users = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const names = new Map((businesses ?? []).map((b) => [b.id, b.name]));
  const list = (rows ?? []).slice(0, limit).map((r) => ({ ...r, actor: r.actor_id ? (users.get(r.actor_id) ?? null) : null, businessName: r.business_id ? (names.get(r.business_id) ?? null) : null }));
  return { rows: list as AuditRow[], hasMore: (rows ?? []).length > limit };
}

export async function listMedia(supabase: ServerSupabase, { businessId, limit = 60 }: { businessId?: string; limit?: number } = {}) {
  let query = supabase.from('media_assets').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
  if (businessId) query = query.eq('business_id', businessId);
  const [{ data: assets }, { data: businesses }] = await Promise.all([query, supabase.from('businesses').select('id, name')]);
  const names = new Map((businesses ?? []).map((b) => [b.id, b.name]));
  return (assets ?? []).map((a) => ({ ...a, url: publicStorageUrl(a.thumb_path ?? a.path)!, businessName: names.get(a.business_id) ?? '—' }));
}

export async function listPlans(supabase: ServerSupabase) {
  const { data } = await supabase.from('plans').select('id, name, limits, features').order('sort_order');
  return data ?? [];
}
