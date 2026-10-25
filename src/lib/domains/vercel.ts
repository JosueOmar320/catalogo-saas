import 'server-only';
import { dnsRecordFor, relativeName, type DnsRecord } from './domain';

/**
 * API de Vercel para los dominios propios: agregarlos al proyecto, ver si ya
 * apuntan bien y quitarlos. Necesita VERCEL_API_TOKEN (un token con acceso al
 * proyecto, lo crea el dueño de la cuenta) y VERCEL_PROJECT_ID; VERCEL_TEAM_ID
 * sólo si el proyecto es de un equipo. Sin ellos la función no está disponible.
 */
const API = 'https://api.vercel.com';

type Config = { token: string; projectId: string; teamId: string };

function config(): Config | null {
  const token = process.env.VERCEL_API_TOKEN ?? '';
  const projectId = process.env.VERCEL_PROJECT_ID ?? '';
  return token && projectId ? { token, projectId, teamId: process.env.VERCEL_TEAM_ID ?? '' } : null;
}

export const isVercelConfigured = () => config() !== null;

export class VercelError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new VercelError('Vercel no está configurado', 'not_configured', 503);
  const url = `${API}${path.replace('{project}', encodeURIComponent(cfg.projectId))}${cfg.teamId ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(cfg.teamId)}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!response.ok) throw new VercelError(data.error?.message ?? `Vercel respondió ${response.status}`, data.error?.code ?? 'error', response.status);
  return data;
}

type ProjectDomain = { name: string; verified: boolean; verification?: { type: string; domain: string; value: string; reason?: string }[] };
type DomainConfig = { misconfigured: boolean; recommendedIPv4?: { rank: number; value: string[] }[]; recommendedCNAME?: { rank: number; value: string }[] };

/** Agrega el dominio al proyecto (o lo deja como está si ya era de este proyecto). `redirectTo`: la otra forma (www) redirige a la elegida. */
export async function addProjectDomain(name: string, redirectTo?: string): Promise<void> {
  try {
    await call('POST', '/v10/projects/{project}/domains', redirectTo ? { name, redirect: redirectTo, redirectStatusCode: 308 } : { name });
  } catch (error) {
    // Ya estaba en este proyecto: nada que hacer.
    if (error instanceof VercelError && error.status === 409) {
      const existing = await call<ProjectDomain>('GET', `/v9/projects/{project}/domains/${encodeURIComponent(name)}`).catch(() => null);
      if (existing) return;
    }
    throw error;
  }
}

export async function removeProjectDomain(name: string): Promise<void> {
  try {
    await call('DELETE', `/v9/projects/{project}/domains/${encodeURIComponent(name)}`);
  } catch (error) {
    if (error instanceof VercelError && error.status === 404) return;
    throw error;
  }
}

export type DomainCheck = {
  /** Vercel ya sabe que el dominio es de esta cuenta (si estaba en otra, pide un TXT). */
  verified: boolean;
  /** El DNS apunta a Vercel. */
  configured: boolean;
  /** Registros que faltan (el A/CNAME y, si hace falta, el TXT de verificación). */
  records: DnsRecord[];
};

/** Pide a Vercel verificar el dominio y revisa su DNS. */
export async function checkProjectDomain(name: string): Promise<DomainCheck> {
  let domain = await call<ProjectDomain>('GET', `/v9/projects/{project}/domains/${encodeURIComponent(name)}`);
  if (!domain.verified) domain = await call<ProjectDomain>('POST', `/v9/projects/{project}/domains/${encodeURIComponent(name)}/verify`).catch(() => domain);
  const cfg = await call<DomainConfig>('GET', `/v6/domains/${encodeURIComponent(name)}/config`).catch(() => ({ misconfigured: true }) as DomainConfig);
  const ip = cfg.recommendedIPv4?.sort((a, b) => a.rank - b.rank)[0]?.value[0];
  const cname = cfg.recommendedCNAME?.sort((a, b) => a.rank - b.rank)[0]?.value?.replace(/\.$/, '');
  const records: DnsRecord[] = [dnsRecordFor(name, { ip, cname })];
  for (const v of domain.verification ?? []) if (v.type === 'TXT') records.push({ type: 'TXT', name: relativeName(v.domain, name), value: v.value });
  return { verified: domain.verified, configured: !cfg.misconfigured, records };
}
