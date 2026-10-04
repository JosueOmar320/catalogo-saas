import 'server-only';
import type { ServerSupabase } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
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

/** Agrupa filas por una clave en una sola pasada (en lugar de filtrar la lista completa por cada fila). */
function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

// Listas completas por páginas (PostgREST corta en 1000 filas).
const allProfiles = (supabase: ServerSupabase) => fetchAllRows((from, to) => supabase.from('profiles').select('*').order('created_at', { ascending: false }).order('id').range(from, to));
const allMembers = (supabase: ServerSupabase) => fetchAllRows((from, to) => supabase.from('business_members').select('business_id, user_id, role').order('business_id').order('user_id').range(from, to));
const allBusinessNames = (supabase: ServerSupabase) => fetchAllRows((from, to) => supabase.from('businesses').select('id, name').is('deleted_at', null).order('id').range(from, to));

function withBusinesses(profiles: Tables<'profiles'>[], members: { business_id: string; user_id: string; role: MemberRole }[], businesses: { id: string; name: string }[]): AdminUserRow[] {
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  const byUser = groupBy(members, (m) => m.user_id);
  return profiles.map((p) => ({
    ...p,
    businesses: (byUser.get(p.id) ?? []).filter((m) => names.has(m.business_id)).map((m) => ({ id: m.business_id, name: names.get(m.business_id)!, role: m.role })),
  }));
}

export async function listUsers(supabase: ServerSupabase): Promise<AdminUserRow[]> {
  const [profiles, members, businesses] = await Promise.all([allProfiles(supabase), allMembers(supabase), allBusinessNames(supabase)]);
  return withBusinesses(profiles, members, businesses);
}

/** Un usuario con sus negocios (antes se cargaban TODOS los usuarios para mostrar uno). */
export async function getUserDetail(supabase: ServerSupabase, id: string) {
  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('business_members').select('business_id, user_id, role').eq('user_id', id),
  ]);
  if (!profile) return null;
  const ids = (members ?? []).map((m) => m.business_id);
  const { data: businesses } = ids.length ? await supabase.from('businesses').select('id, name').in('id', ids).is('deleted_at', null) : { data: [] };
  return withBusinesses([profile], members ?? [], businesses ?? [])[0];
}

export async function listBusinesses(supabase: ServerSupabase): Promise<AdminBusinessRow[]> {
  const [businesses, members, profiles, catalogs] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('businesses').select('*').is('deleted_at', null).order('created_at', { ascending: false }).order('id').range(from, to)),
    allMembers(supabase),
    fetchAllRows((from, to) => supabase.from('profiles').select('id, username, full_name').order('id').range(from, to)),
    fetchAllRows((from, to) => supabase.from('catalogs').select('id, business_id, name, status, is_active, is_default').is('deleted_at', null).order('id').range(from, to)),
  ]);
  const people = new Map(profiles.map((p) => [p.id, p]));
  const teams = groupBy(members, (m) => m.business_id);
  const catalogsByBusiness = groupBy(catalogs, (c) => c.business_id);
  return businesses.map((b) => {
    const team = teams.get(b.id) ?? [];
    return {
      ...b,
      owners: team.filter((m) => m.role === 'owner' && people.has(m.user_id)).map((m) => ({ id: m.user_id, username: people.get(m.user_id)!.username, fullName: people.get(m.user_id)!.full_name })),
      members: team.length,
      catalogs: (catalogsByBusiness.get(b.id) ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status, isActive: c.is_active, isDefault: c.is_default })),
    };
  });
}

export async function getBusinessDetail(supabase: ServerSupabase, id: string) {
  const [{ data: business }, { data: members }, { data: catalogs }, { data: profiles }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_members').select('user_id, role, created_at').eq('business_id', id),
    supabase.from('catalogs').select('*').eq('business_id', id).is('deleted_at', null).order('created_at'),
    // El selector "agregar miembro" necesita a todos los usuarios: por páginas.
    fetchAllRows((from, to) => supabase.from('profiles').select('id, username, full_name, status').order('id').range(from, to)).then((data) => ({ data })),
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
  // Conteos en SQL (antes: se descargaban todas las páginas e ítems de la plataforma para contarlos).
  const [catalogs, businesses, { data: counts }] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('catalogs').select('id, business_id, name, slug, status, is_active, is_default, published_at, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }).order('id').range(from, to)),
    fetchAllRows((from, to) => supabase.from('businesses').select('id, name, slug, status').is('deleted_at', null).order('id').range(from, to)),
    supabase.rpc('admin_catalog_counts'),
  ]);
  const byBusiness = new Map(businesses.map((b) => [b.id, b]));
  // Sin la migración 20261005 (función inexistente): conteo anterior, en memoria.
  const totals = new Map((counts ?? (await legacyCatalogCounts(supabase))).map((c) => [c.catalog_id, c]));
  return catalogs.flatMap((c) => {
    const business = byBusiness.get(c.business_id);
    const total = totals.get(c.id);
    return business ? [{ ...c, business, pages: Number(total?.pages ?? 0), items: Number(total?.items ?? 0) }] : [];
  });
}

async function legacyCatalogCounts(supabase: ServerSupabase) {
  const [pages, items] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('catalog_pages').select('catalog_id').is('deleted_at', null).order('id').range(from, to)),
    fetchAllRows((from, to) => supabase.from('catalog_items').select('catalog_id').is('deleted_at', null).order('id').range(from, to)),
  ]);
  const count = new Map<string, { catalog_id: string; pages: number; items: number }>();
  const row = (id: string) => count.get(id) ?? count.set(id, { catalog_id: id, pages: 0, items: 0 }).get(id)!;
  for (const p of pages) row(p.catalog_id).pages += 1;
  for (const i of items) row(i.catalog_id).items += 1;
  return [...count.values()];
}

async function legacyStats(supabase: ServerSupabase) {
  const [u, b, c] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('profiles').select('status, platform_role, last_login_at').order('id').range(from, to)),
    fetchAllRows((from, to) => supabase.from('businesses').select('status').is('deleted_at', null).order('id').range(from, to)),
    fetchAllRows((from, to) => supabase.from('catalogs').select('status, is_active').is('deleted_at', null).order('id').range(from, to)),
  ]);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return {
    users: { total: u.length, active: u.filter((x) => x.status === 'active').length, admins: u.filter((x) => x.platform_role === 'admin').length, recent: u.filter((x) => x.last_login_at && Date.parse(x.last_login_at) > weekAgo).length },
    businesses: { total: b.length, active: b.filter((x) => x.status === 'active').length, suspended: b.filter((x) => x.status === 'suspended').length },
    catalogs: { total: c.length, published: c.filter((x) => x.status === 'published' && x.is_active).length, inactive: c.filter((x) => !x.is_active).length },
  };
}

export async function adminStats(supabase: ServerSupabase) {
  // Una sola consulta agregada en SQL (antes: todas las filas de perfiles, negocios y catálogos).
  const [{ data, error }, audit] = await Promise.all([supabase.rpc('admin_stats'), listAudit(supabase, { limit: 12 })]);
  // Sin la migración 20261005 (función inexistente): cálculo anterior.
  if (error) return { ...(await legacyStats(supabase)), audit: audit.rows };
  const stats = (data ?? {}) as Partial<Record<'users' | 'businesses' | 'catalogs', Record<string, number>>>;
  const n = (group: Record<string, number> | undefined, key: string) => Number(group?.[key] ?? 0);
  return {
    users: { total: n(stats.users, 'total'), active: n(stats.users, 'active'), admins: n(stats.users, 'admins'), recent: n(stats.users, 'recent') },
    businesses: { total: n(stats.businesses, 'total'), active: n(stats.businesses, 'active'), suspended: n(stats.businesses, 'suspended') },
    catalogs: { total: n(stats.catalogs, 'total'), published: n(stats.catalogs, 'published'), inactive: n(stats.catalogs, 'inactive') },
    audit: audit.rows,
  };
}

export type AuditRow = Tables<'audit_log'> & { actor: string | null; businessName: string | null };

export async function listAudit(supabase: ServerSupabase, { limit = 50, offset = 0, entity, action }: { limit?: number; offset?: number; entity?: string; action?: string } = {}) {
  let query = supabase.from('audit_log').select('*').order('id', { ascending: false }).range(offset, offset + limit);
  if (entity) query = query.eq('entity_type', entity);
  if (action) query = query.ilike('action', `%${action}%`);
  const { data: rows } = await query;
  // Nombres sólo de los actores y negocios de esta página (antes: todos los perfiles y negocios).
  const actorIds = [...new Set((rows ?? []).flatMap((r) => (r.actor_id ? [r.actor_id] : [])))];
  const businessIds = [...new Set((rows ?? []).flatMap((r) => (r.business_id ? [r.business_id] : [])))];
  const [{ data: profiles }, { data: businesses }] = await Promise.all([
    actorIds.length ? supabase.from('profiles').select('id, username').in('id', actorIds) : Promise.resolve({ data: [] as { id: string; username: string }[] }),
    businessIds.length ? supabase.from('businesses').select('id, name').in('id', businessIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
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
