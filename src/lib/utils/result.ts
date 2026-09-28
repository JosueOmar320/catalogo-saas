/**
 * Resultado estándar de las Server Actions. Nunca se lanzan errores al
 * cliente: se devuelven mensajes listos para mostrar.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

type PgError = { code?: string; message?: string } | null | undefined;

/** Traduce errores de Postgres/Supabase a mensajes para el usuario. */
export function dbErrorMessage(error: PgError, fallback = 'No se pudo guardar. Intenta de nuevo.'): string {
  if (!error) return fallback;
  const message = error.message ?? '';
  if (message.includes('plan_limit_reached:max_items')) {
    return 'Alcanzaste el límite de ítems de tu plan.';
  }
  if (message.includes('plan_limit_reached:max_images_per_item')) {
    return 'Alcanzaste el límite de imágenes por ítem de tu plan.';
  }
  if (message.includes('slug_unavailable')) return 'Esa dirección ya está en uso. Prueba con otra.';
  if (message.includes('business_limit_reached')) return 'Alcanzaste el máximo de negocios por cuenta.';
  if (error.code === '23505') return 'Ya existe un registro con ese identificador.';
  if (error.code === '42501') return 'No tienes permisos para realizar esta acción.';
  return fallback;
}
