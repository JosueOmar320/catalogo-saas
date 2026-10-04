/** Número sólo con dígitos, para enlaces wa.me y tel:. */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');
}
