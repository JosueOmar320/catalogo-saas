import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { parseEntitlements, type Entitlements } from '@/lib/plans/entitlements';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import type { MemberRole, Tables } from '@/types/database';

export const ACTIVE_BUSINESS_COOKIE = 'vitrina_business';

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

export type BusinessContext = {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
  role: MemberRole;
  business: Tables<'businesses'>;
  catalog: Tables<'catalogs'>;
  businesses: Pick<Tables<'businesses'>, 'id' | 'name' | 'slug'>[];
  entitlements: Entitlements;
};

/**
 * Resuelve en el SERVIDOR qué negocio puede operar el usuario. La cookie sólo
 * expresa una preferencia: si apunta a un negocio ajeno, RLS no lo devuelve y
 * se usa el primero propio. Nunca se confía en un business_id del cliente.
 */
export const getBusinessContext = cache(async (): Promise<BusinessContext | null> => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (!businesses || businesses.length === 0) return null;

  const preferred = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  const business = businesses.find((b) => b.id === preferred) ?? businesses[0];

  const [membership, plan, catalog] = await Promise.all([
    supabase.from('business_members').select('role').eq('business_id', business.id).eq('user_id', user.id).single(),
    supabase.from('plans').select('*').eq('id', business.plan_id).single(),
    supabase
      .from('catalogs')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_default', true)
      .is('deleted_at', null)
      .single(),
  ]);
  if (!membership.data || !catalog.data) return null;

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    role: membership.data.role,
    business,
    catalog: catalog.data,
    businesses: businesses.map(({ id, name, slug }) => ({ id, name, slug })),
    entitlements: parseEntitlements(plan.data ?? { id: business.plan_id, name: business.plan_id, limits: {}, features: {} }),
  };
});

/** Para páginas y Server Actions del panel. Redirige si no hay sesión o negocio. */
export async function requireBusinessContext(): Promise<BusinessContext> {
  await requireUser();
  const ctx = await getBusinessContext();
  if (!ctx) redirect('/onboarding');
  return ctx;
}

export function canManageCatalog(ctx: BusinessContext): boolean {
  return ctx.role === 'owner' || ctx.role === 'admin';
}
