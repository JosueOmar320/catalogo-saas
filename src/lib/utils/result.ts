import { msg } from '@/i18n/translate';

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
export function dbErrorMessage(error: PgError, fallback: string = msg('No se pudo guardar. Intenta de nuevo.')): string {
  if (!error) return fallback;
  const message = error.message ?? '';
  if (message.includes('plan_limit_reached:max_items')) {
    return msg('Alcanzaste el límite de ítems de tu plan.');
  }
  if (message.includes('plan_limit_reached:max_images_per_item')) {
    return msg('Alcanzaste el límite de imágenes por ítem de tu plan.');
  }
  if (message.includes('demo_cannot_publish')) return msg('En la cuenta de prueba el sitio no se publica. Usa «Vista previa» para verlo como tus clientes.');
  if (message.includes('slug_unavailable')) return msg('Esa dirección ya está en uso. Prueba con otra.');
  if (message.includes('business_limit_reached')) return msg('Ese usuario alcanzó su máximo de negocios asignados.');
  if (message.includes('cannot_demote_self')) return msg('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.');
  if (message.includes('last_admin')) return msg('Debe quedar al menos un administrador activo.');
  if (message.includes('user_not_found')) return msg('El usuario no existe.');
  if (message.includes('business_not_found')) return msg('El negocio no existe.');
  if (message.includes('catalog_not_found')) return msg('El catálogo no existe.');
  if (message.includes('plan_not_found')) return msg('El plan no existe.');
  if (message.includes('forbidden')) return msg('Esta acción es sólo para administradores.');
  if (error.code === '23505') return msg('Ya existe un registro con ese identificador.');
  if (error.code === '42501') return msg('No tienes permisos para realizar esta acción.');
  return fallback;
}
