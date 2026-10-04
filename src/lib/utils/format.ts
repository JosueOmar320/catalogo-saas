const formatterCache = new Map<string, Intl.NumberFormat>();

type PriceFormatOptions = {
  prefix?: string;
  currencyDisplay?: 'symbol' | 'code' | 'none';
  position?: 'before' | 'after';
  decimals?: 'auto' | '0' | '2';
};

function numberFormatter(locale: string, digits: number) {
  const key = `${locale}:${digits}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function currencySymbol(currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Formatea un precio según la moneda, el locale y el formato del catálogo:
 * "$45", "365 C$", "VALOR: 30 USD", "$1,200.00".
 */
export function formatPrice(value: number, currency: string, locale = 'es-419', format: PriceFormatOptions = {}): string {
  const digits = format.decimals === '2' ? 2 : format.decimals === '0' ? 0 : Number.isInteger(value) ? 0 : 2;
  const number = numberFormatter(locale, digits).format(value);
  const display = format.currencyDisplay ?? 'symbol';
  const unit = display === 'none' ? '' : display === 'code' ? currency : currencySymbol(currency, locale);
  const position = format.position ?? (display === 'code' ? 'after' : 'before');
  const amount = !unit ? number : position === 'after' ? `${number} ${unit}` : `${unit}${unit.length > 1 && display === 'code' ? ' ' : ''}${number}`;
  return format.prefix ? `${format.prefix} ${amount}` : amount;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string, locale = 'es'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
