import 'server-only';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

/** Horas que dura un negocio de prueba («Probar el panel»). */
export const DEMO_HOURS = 24;
/** Negocios de prueba vivos a la vez (tope de toda la plataforma). */
export const MAX_ACTIVE_DEMOS = 150;
/** Imágenes que un negocio de prueba puede tener en su biblioteca. */
export const DEMO_MEDIA_LIMIT = 60;

/** Necesita la service role (crea la cuenta); `DEMO_ACCOUNTS=off` la apaga. */
export const isDemoEnabled = () => isServiceRoleConfigured() && process.env.DEMO_ACCOUNTS !== 'off';
