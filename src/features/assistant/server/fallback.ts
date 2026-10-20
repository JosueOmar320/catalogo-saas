import 'server-only';
import { msg } from '@/i18n/translate';
import { ProviderError, QuotaExceededError, type TaskModel } from './types';

/**
 * Con IA si hay (y responde); si no, la versión sin IA. La cuota agotada o un
 * proveedor caído no son un error para el usuario: sigue sin IA y se le avisa.
 */
export async function withFallback<R>(model: TaskModel | null, withModel: (model: TaskModel) => Promise<R>, withoutModel: () => R): Promise<{ result: R; mode: 'ai' | 'basic'; notice: string | null }> {
  if (!model) return { result: withoutModel(), mode: 'basic', notice: null };
  try {
    return { result: await withModel(model), mode: 'ai', notice: null };
  } catch (error) {
    if (!(error instanceof QuotaExceededError || error instanceof ProviderError)) throw error;
    console.warn('[assistant] tarea sin IA:', (error as Error).message);
    return { result: withoutModel(), mode: 'basic', notice: error instanceof QuotaExceededError ? msg('Por hoy se agotó mi cuota de IA: te dejo una versión sin IA.') : msg('El servicio de IA no respondió: te dejo una versión sin IA.') };
  }
}
