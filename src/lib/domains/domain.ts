/**
 * Dominios propios: normalizar lo que escribe el negocio, reconocer los hosts
 * de la plataforma y armar los registros DNS que debe crear. Sin zod ni
 * dependencias de servidor: lo usan el proxy, el panel y las pruebas.
 */

/** Mismo formato que valida la base (businesses_custom_domain_format). */
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Terminaciones de dos partes comunes en la región (mitienda.com.mx es la raíz, no un subdominio). */
const SECOND_LEVEL = new Set([
  'com.mx', 'org.mx', 'edu.mx', 'gob.mx', 'net.mx', 'com.ar', 'com.co', 'com.pe', 'com.ec', 'com.gt', 'com.uy', 'com.py', 'com.bo', 'com.ve',
  'com.sv', 'com.hn', 'com.ni', 'com.pa', 'com.do', 'com.cu', 'co.cr', 'fi.cr', 'com.br', 'com.es', 'co.uk', 'org.uk', 'com.au', 'co.nz',
]);

/** IP de Vercel para el dominio raíz y destino CNAME para subdominios (lo que recomienda Vercel). */
export const VERCEL_APEX_IP = '76.76.21.21';
export const VERCEL_CNAME = 'cname.vercel-dns.com';

/**
 * «https://www.MiTienda.com/menu» → «www.mitienda.com». null si no es un
 * dominio válido (IP, sin punto, caracteres raros) o si es de la plataforma.
 */
export function normalizeDomain(input: string, platformHosts: string[] = []): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z]+:\/\//, '');
  value = value.split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  let host: string;
  try {
    // Convierte acentos y eñes a punycode (xn--…), como los guarda el DNS.
    host = new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
  if (host.length < 4 || host.length > 253 || !DOMAIN_RE.test(host)) return null;
  if (isPlatformHost(host, platformHosts)) return null;
  return host;
}

/** Hosts donde vive la plataforma: nunca se tratan como dominio de un negocio. */
export function isPlatformHost(host: string, platformHosts: string[] = []): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h) ||
    h.startsWith('[') ||
    h.endsWith('.vercel.app') ||
    platformHosts.some((p) => p && (h === p || h === `www.${p}`))
  );
}

/** La raíz registrable: tienda.mitienda.com.mx → mitienda.com.mx. */
export function registrableDomain(domain: string): string {
  const labels = domain.split('.');
  const take = labels.length >= 3 && SECOND_LEVEL.has(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-take).join('.');
}

export const isApexDomain = (domain: string) => registrableDomain(domain) === domain;

/**
 * La otra forma del dominio (con o sin www), que redirige a la elegida: así
 * funcionan las dos. Sólo para la raíz y su www (no para otros subdominios).
 */
export function wwwCounterpart(domain: string): { name: string; redirectTo: string } | null {
  if (domain.startsWith('www.') && isApexDomain(domain.slice(4))) return { name: domain.slice(4), redirectTo: domain };
  if (isApexDomain(domain)) return { name: `www.${domain}`, redirectTo: domain };
  return null;
}

export type DnsRecord = { type: 'A' | 'CNAME' | 'TXT'; name: string; value: string };

/** El registro que el negocio crea en su proveedor de dominio (name relativo a la raíz: «@», «www», «tienda»). */
export function dnsRecordFor(domain: string, values: { ip?: string; cname?: string } = {}): DnsRecord {
  const root = registrableDomain(domain);
  if (root === domain) return { type: 'A', name: '@', value: values.ip ?? VERCEL_APEX_IP };
  return { type: 'CNAME', name: domain.slice(0, -(root.length + 1)), value: values.cname ?? VERCEL_CNAME };
}

/** Nombre relativo a la raíz de un registro absoluto (_vercel.mitienda.com → _vercel). */
export function relativeName(name: string, domain: string): string {
  const root = registrableDomain(domain);
  return name === root ? '@' : name.endsWith(`.${root}`) ? name.slice(0, -(root.length + 1)) : name;
}
