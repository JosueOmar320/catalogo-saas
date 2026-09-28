const formatterCache = new Map<string, Intl.NumberFormat>();

/** Formatea un precio según moneda y locale del catálogo. */
export function formatPrice(value: number, currency: string, locale = 'es-419'): string {
  const key = `${locale}:${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currencyDisplay: 'narrowSymbol',
        currency,
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
      });
    } catch {
      formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    }
    formatterCache.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string, locale = 'es'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
