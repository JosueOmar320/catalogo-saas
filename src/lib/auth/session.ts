import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { customCodeEnabled, parseEntitlements, type Entitlements } from '@/lib/plans/entitlements';
import { activeDomain, catalogUrl } from '@/lib/catalog/view-model';
import { effectiveFeatures, parseFeatureOverrides, type BusinessFeature, type BusinessFeatures } from '@/lib/plans/features';
import { parseSiteKind, type SiteKind } from '@/lib/business/site-kind';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import type { MemberRole, Tables } from '@/types/database';

export const ACTIVE_BUSINESS_COOKIE = 'vitrina_business';

export const getUser = cache(async () => {
  // Sin Supabase (recién clonado, CI) no hay sesiones: igual que el proxy, nadie está autenticado.
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

export type Profile = Pick<Tables<'profiles'>, 'id' | 'username' | 'full_name' | 'email' | 'platform_role' | 'status'>;

/** Perfil del usuario con sesión (RLS: cada usuario lee el suyo). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id, username, full_name, email, platform_role, status').eq('id', user.id).single();
  return data ?? null;
});

export const isPlatformAdmin = (profile: Profile | null) => profile?.platform_role === 'admin' && profile.status === 'active';

export type BusinessContext = {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
  profile: Profile;
  isPlatformAdmin: boolean;
  role: MemberRole;
  business: Tables<'businesses'>;
  catalog: Tables<'catalogs'>;
  businesses: Pick<Tables<'businesses'>, 'id' | 'name' | 'slug'>[];
  entitlements: Entitlements;
  /** Código propio habilitado por el administrador (plan o negocio). */
  customCode: boolean;
  /** Negocio con catálogo o sitio web sin productos (lo decide el administrador). */
  siteKind: SiteKind;
  /** Funciones encendidas para este negocio (plan + decisión del administrador). */
  features: BusinessFeatures;
  /** Dominio propio activo (y con la función encendida), o null. */
  customDomain: string | null;
  /** Raíz pública del sitio: su dominio propio activo o /catalogo/<negocio>. */
  publicUrl: string;
};

/**
 * Resuelve en el SERVIDOR qué negocio puede operar el usuario: sus negocios
 * asignados (RLS ya excluye negocios suspendidos y usuarios desactivados).
 * La cookie sólo expresa una preferencia; un administrador puede abrir
 * cualquier negocio desde el panel de administración.
 */
export const getBusinessContext = cache(async (): Promise<BusinessContext | null> => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;
  // Perfil, membresías y cookie en paralelo (antes: uno tras otro, una ida y vuelta más por página).
  const [profile, { data: memberships }, cookieStore] = await Promise.all([
    getProfile(),
    supabase.from('business_members').select('business_id, role').eq('user_id', user.id),
    cookies(),
  ]);
  if (!profile || profile.status !== 'active') return null;
  const admin = isPlatformAdmin(profile);
  const preferred = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const ids = new Set((memberships ?? []).map((m) => m.business_id));
  if (admin && preferred && /^[0-9a-f-]{36}$/.test(preferred)) ids.add(preferred);
  if (ids.size === 0) return null;

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .in('id', [...ids])
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (!businesses || businesses.length === 0) return null;
  const business = businesses.find((b) => b.id === preferred) ?? businesses[0];
  const membership = memberships?.find((m) => m.business_id === business.id);
  // Un administrador que abre un negocio ajeno opera con permisos de dueño (RLS lo permite).
  const role: MemberRole | null = membership?.role ?? (admin ? 'owner' : null);
  if (!role) return null;

  const [plan, catalog] = await Promise.all([
    supabase.from('plans').select('*').eq('id', business.plan_id).single(),
    supabase.from('catalogs').select('*').eq('business_id', business.id).eq('is_default', true).is('deleted_at', null).single(),
  ]);
  if (!catalog.data) return null;
  const entitlements = parseEntitlements(plan.data ?? { id: business.plan_id, name: business.plan_id, limits: {}, features: {} });
  const features = effectiveFeatures(parseFeatureOverrides(business.feature_overrides), entitlements.features);
  // Como get_site_by_domain: con la función apagada, el dominio no sirve el sitio.
  const customDomain = features.custom_domain ? activeDomain(business) : null;

  return {
    supabase,
    userId: user.id,
    email: profile.email,
    profile,
    isPlatformAdmin: admin,
    role,
    business,
    catalog: catalog.data,
    businesses: businesses.map(({ id, name, slug }) => ({ id, name, slug })),
    entitlements,
    customCode: customCodeEnabled(business, entitlements.features),
    siteKind: parseSiteKind(business.site_kind),
    features,
    customDomain,
    publicUrl: catalogUrl(business.slug, customDomain),
  };
});

/** Para páginas y Server Actions del panel. Redirige si no hay sesión o negocio. */
export async function requireBusinessContext(): Promise<BusinessContext> {
  await requireUser();
  const ctx = await getBusinessContext();
  if (ctx) return ctx;
  const profile = await getProfile();
  if (!profile || profile.status !== 'active') redirect('/login?error=disabled');
  // Sin negocios asignados: el admin va a su panel; el usuario ve cómo pedir acceso.
  redirect(isPlatformAdmin(profile) ? '/admin' : '/sin-acceso');
}

/** Panel de administración. La base valida además cada operación (is_platform_admin). */
export async function requirePlatformAdmin(): Promise<{ supabase: ServerSupabase; profile: Profile; userId: string }> {
  const user = await requireUser();
  const profile = await getProfile();
  if (!isPlatformAdmin(profile)) redirect(profile?.status === 'active' ? '/dashboard' : '/login?error=disabled');
  return { supabase: await createClient(), profile: profile!, userId: user.id };
}

export function canManageCatalog(ctx: BusinessContext): boolean {
  return ctx.role === 'owner' || ctx.role === 'admin';
}

/** Páginas sólo de un negocio con catálogo: en un sitio web llevan al inicio del panel. */
export async function requireCatalogSite(): Promise<BusinessContext> {
  const ctx = await requireBusinessContext();
  if (ctx.siteKind !== 'catalog') redirect('/dashboard');
  return ctx;
}

/** Páginas de un negocio con catálogo y de una función que el administrador puede apagar: apagada, al inicio del panel con el aviso. */
export async function requireCatalogFeature(feature: BusinessFeature): Promise<BusinessContext> {
  const ctx = await requireCatalogSite();
  if (!ctx.features[feature]) redirect(`/dashboard?funcion=${feature}`);
  return ctx;
}
