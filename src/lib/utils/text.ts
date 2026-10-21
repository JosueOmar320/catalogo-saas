/** Texto comparable: sin acentos ni diacríticos y en minúsculas ("Café Ñandú" → "cafe nandu"). */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Escapa texto para meterlo en HTML generado a mano (carteles, etiquetas para imprimir). */
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
