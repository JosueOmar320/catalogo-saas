'use server';

import { canManageCatalog, requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { afterCatalogChange } from '@/lib/catalog/cache';
import { normalizeDomain, registrableDomain, wwwCounterpart, type DnsRecord } from '@/lib/domains/domain';
import { addProjectDomain, checkProjectDomain, isVercelConfigured, removeProjectDomain, VercelError } from '@/lib/domains/vercel';
import { env } from '@/lib/env';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { msg } from '@/i18n/translate';

/**
 * Dominio propio del negocio. Las columnas las escribe sólo el servidor (los
 * miembros no tienen permiso), después de registrarlo en el proyecto de Vercel.
 */

export type DomainStatus = {
  domain: string | null;
  status: 'none' | 'pending' | 'active';
  /** Lo que el negocio debe crear en su proveedor de dominio (vacío si ya está activo). */
  records: DnsRecord[];
  /** La otra forma (www o sin www), que redirige a la elegida. */
  alias: string | null;
};

/** Cambios de dominio por negocio y hora (cada uno registra dominios en Vercel). */
const DOMAIN_CHANGES_PER_HOUR = 5;

const platformHost = () => {
  try {
    return [new URL(env.siteUrl).hostname];
  } catch {
    return [];
  }
};

function guard(ctx: BusinessContext): string | null {
  if (!canManageCatalog(ctx)) return msg('Sólo el dueño o un administrador puede cambiar esto.');
  if (!ctx.features.custom_domain) return msg('El dominio propio no está incluido en tu plan.');
  if (!isVercelConfigured() || !isServiceRoleConfigured()) return msg('El dominio propio todavía no está disponible en la plataforma.');
  return null;
}

function vercelMessage(error: unknown): string {
  if (error instanceof VercelError) {
    if (error.code === 'domain_already_in_use' || error.code === 'domain_taken' || error.status === 409) return msg('Ese dominio ya está conectado a otro sitio de Vercel. Quítalo de allá primero.');
    if (error.code === 'invalid_domain') return msg('Ese dominio no es válido.');
    if (error.code === 'forbidden' || error.status === 403) return msg('La plataforma no tiene permiso para conectar dominios. Avísale al administrador.');
  }
  return msg('No se pudo hablar con el servicio de dominios. Intenta de nuevo.');
}

async function save(ctx: BusinessContext, patch: { custom_domain: string | null; custom_domain_status: 'none' | 'pending' | 'active' }) {
  const { error } = await createAdminClient()
    .from('businesses')
    .update({ ...patch, custom_domain_checked_at: patch.custom_domain ? new Date().toISOString() : null })
    .eq('id', ctx.business.id);
  return error;
}

/**
 * ¿Otro negocio ya tiene este dominio, su otra forma (www ↔ raíz) o cualquier
 * dominio con la misma raíz registrable? La raíz (custom_domain_apex, migración
 * 20261123) es la regla; si la columna aún no existe, se revisa el par exacto.
 */
async function domainTaken(ctx: BusinessContext, domain: string, alias: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const byApex = await admin.from('businesses').select('id').eq('custom_domain_apex', registrableDomain(domain)).neq('id', ctx.business.id).limit(1);
  if (!byApex.error) return (byApex.data?.length ?? 0) > 0;
  const byPair = await admin.from('businesses').select('id').in('custom_domain', alias ? [domain, alias] : [domain]).neq('id', ctx.business.id).limit(1);
  return (byPair.data?.length ?? 0) > 0;
}

async function statusFor(domain: string): Promise<{ status: 'pending' | 'active'; records: DnsRecord[] }> {
  const check = await checkProjectDomain(domain);
  const active = check.verified && check.configured;
  return { status: active ? 'active' : 'pending', records: active ? [] : check.records };
}

/** Conecta (o cambia) el dominio: lo registra en Vercel con su www y queda pendiente hasta que el DNS apunte. */
export async function setCustomDomain(input: string): Promise<ActionResult<DomainStatus>> {
  const ctx = await requireBusinessContext();
  const blocked = guard(ctx);
  if (blocked) return fail(blocked);
  const domain = typeof input === 'string' ? normalizeDomain(input, platformHost()) : null;
  // Tampoco un subdominio de la plataforma (tienda.vitrina.app): la raíz registrable es de la plataforma.
  if (!domain || platformHost().some((host) => registrableDomain(host) === registrableDomain(domain))) return fail(msg('Escribe un dominio válido, como mitienda.com o tienda.mitienda.com.'), { domain: [msg('Dominio inválido')] });
  const previous = ctx.business.custom_domain;
  if (previous === domain) return checkCustomDomain();
  // Cada cambio registra dominios en Vercel: pocos por hora y por negocio (nadie «reserva» dominios a lo loco).
  if (!(await consumeRateLimit(`domain:${ctx.business.id}`, DOMAIN_CHANGES_PER_HOUR, 3600))) return fail(msg('Cambiaste el dominio varias veces en poco tiempo. Espera una hora e intenta de nuevo.'));

  const alias = wwwCounterpart(domain);
  if (await domainTaken(ctx, domain, alias?.name ?? null)) return fail(msg('Ese dominio ya lo usa otro negocio.'), { domain: [msg('Ya está en uso')] });

  try {
    await addProjectDomain(domain);
    if (alias) await addProjectDomain(alias.name, alias.redirectTo);
  } catch (error) {
    return fail(vercelMessage(error));
  }

  let state: { status: 'pending' | 'active'; records: DnsRecord[] };
  try {
    state = await statusFor(domain);
  } catch {
    state = { status: 'pending', records: [] };
  }
  const error = await save(ctx, { custom_domain: domain, custom_domain_status: state.status });
  if (error) {
    // Otro negocio lo guardó en medio: el dominio en Vercel ahora es suyo, no se toca.
    if (error.code === '23505') return fail(msg('Ese dominio ya lo usa otro negocio.'));
    await removeDomainAndAlias(domain).catch(() => undefined);
    return fail(msg('No se pudo guardar. Intenta de nuevo.'));
  }
  // Ya guardado el nuevo: el anterior deja de servir este sitio (antes del guardado, un fallo lo dejaba sin ninguno).
  if (previous) await removeDomainAndAlias(previous).catch(() => undefined);
  afterCatalogChange(ctx);
  return ok(
    { domain, status: state.status, records: state.records, alias: alias?.name ?? null },
    state.status === 'active' ? msg('Dominio conectado') : msg('Dominio agregado: falta configurar el DNS'),
  );
}

/** Revisa el DNS en Vercel y actualiza el estado (activo cuando ya apunta bien). */
export async function checkCustomDomain(): Promise<ActionResult<DomainStatus>> {
  const ctx = await requireBusinessContext();
  const blocked = guard(ctx);
  if (blocked) return fail(blocked);
  const domain = ctx.business.custom_domain;
  if (!domain) return ok({ domain: null, status: 'none', records: [], alias: null });
  let state: { status: 'pending' | 'active'; records: DnsRecord[] };
  try {
    state = await statusFor(domain);
  } catch (error) {
    // Lo quitaron del proyecto por fuera: se vuelve a agregar.
    if (error instanceof VercelError && error.status === 404) {
      try {
        await addProjectDomain(domain);
        state = await statusFor(domain);
      } catch (retry) {
        return fail(vercelMessage(retry));
      }
    } else {
      return fail(vercelMessage(error));
    }
  }
  if (state.status !== ctx.business.custom_domain_status || state.status === 'active') {
    const error = await save(ctx, { custom_domain: domain, custom_domain_status: state.status });
    if (error) return fail(msg('No se pudo guardar. Intenta de nuevo.'));
    if (state.status !== ctx.business.custom_domain_status) afterCatalogChange(ctx);
  }
  return ok(
    { domain, status: state.status, records: state.records, alias: wwwCounterpart(domain)?.name ?? null },
    state.status === 'active' ? msg('Dominio conectado') : msg('El DNS todavía no apunta a la plataforma. Puede tardar unas horas.'),
  );
}

async function removeDomainAndAlias(domain: string) {
  const alias = wwwCounterpart(domain);
  // Primero la redirección (Vercel no deja quitar un dominio al que otro redirige).
  if (alias) await removeProjectDomain(alias.name);
  await removeProjectDomain(domain);
}

/** Desconecta el dominio: el sitio sigue en la dirección de la plataforma. */
export async function removeCustomDomain(): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede cambiar esto.'));
  if (!isServiceRoleConfigured()) return fail(msg('El dominio propio todavía no está disponible en la plataforma.'));
  const domain = ctx.business.custom_domain;
  if (!domain) return ok(undefined);
  // Aunque el plan ya no lo incluya, el negocio siempre puede quitarlo.
  if (isVercelConfigured()) {
    try {
      await removeDomainAndAlias(domain);
    } catch (error) {
      return fail(vercelMessage(error));
    }
  }
  const error = await save(ctx, { custom_domain: null, custom_domain_status: 'none' });
  if (error) return fail(msg('No se pudo guardar. Intenta de nuevo.'));
  afterCatalogChange(ctx);
  return ok(undefined, msg('Dominio desconectado'));
}
