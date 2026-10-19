/** Texto comparable: sin acentos ni diacríticos y en minúsculas ("Café Ñandú" → "cafe nandu"). */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
