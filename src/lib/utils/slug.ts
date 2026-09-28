/** Convierte un texto en slug URL-safe: "Café & Té" → "cafe-te". */
export function slugify(input: string, maxLength = 48): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Versión para inputs: igual que slugify pero conserva un guion final para
 * que se pueda escribir "mi-negocio" letra por letra. Se limpia al guardar.
 */
export function slugifyLive(input: string, maxLength = 48): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, maxLength);
}

/** Agrega un sufijo corto aleatorio para resolver colisiones de slug. */
export function withRandomSuffix(slug: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug.slice(0, 43)}-${suffix}`;
}

export const BUSINESS_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$/;
