import { msg, type Translator } from '@/i18n/translate';

/**
 * Kit para compartir el catálogo: mensajes listos para copiar y el armado de
 * texto de la imagen para historias. Puro (sin DOM): se prueba sin navegador.
 */
export const SHARE_MESSAGES = [
  { id: 'whatsapp', label: msg('Para WhatsApp'), text: msg('¡Hola! Ya puedes ver nuestro catálogo y hacer tu pedido aquí: {url}') },
  { id: 'status', label: msg('Para estados y redes'), text: msg('Conoce el catálogo de {negocio}: fotos, precios y pedidos por WhatsApp en {url}') },
  { id: 'bio', label: msg('Para la bio de Instagram o TikTok'), text: msg('Haz tu pedido aquí: {url}') },
] as const;

export function shareMessages(t: Translator, businessName: string, url: string) {
  return SHARE_MESSAGES.map((message) => ({ id: message.id, label: t(message.label), text: t(message.text, { url, negocio: businessName }) }));
}

/** El enlace sin "https://" (más corto en la imagen). */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Parte un texto en líneas que no pasen de `width` según `measure`; como máximo `maxLines` (la última con "…"). */
export function wrapText(text: string, width: number, measure: (value: string) => number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines && lines.every((l) => measure(l) <= width)) return lines;
  const kept = lines.slice(0, maxLines);
  const lastIndex = kept.length - 1;
  let last = kept[lastIndex];
  while (last && measure(`${last}…`) > width) last = last.slice(0, -1);
  kept[lastIndex] = `${last.trimEnd()}…`;
  return kept;
}

/** Texto legible sobre un color: blanco o casi negro según su luminancia. */
export function readableOn(hex: string): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}
