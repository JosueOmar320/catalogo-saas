'use client';

import { useCallback, useTransition } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { useToast } from '@/components/feedback/ToastProvider';
import { useT } from '@/i18n/client';
import type { ActionResult } from '@/lib/utils/result';

type RunOptions<T, F extends FieldValues> = {
  onSuccess?: (data: T) => void;
  /** Si se pasa, los errores por campo del servidor se muestran en el formulario. */
  setError?: UseFormSetError<F>;
  /** Mostrar toast de éxito (por defecto sí, si la acción devuelve mensaje). */
  successToast?: boolean;
};

/**
 * Ejecuta una Server Action con estado de carga y feedback consistente
 * (toast de éxito/error, errores por campo en el formulario).
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  // Las Server Actions devuelven mensajes en español (la clave del catálogo): se traducen al mostrarlos.
  const t = useT();

  const run = useCallback(
    <T, F extends FieldValues = FieldValues>(action: () => Promise<ActionResult<T>>, options: RunOptions<T, F> = {}) =>
      new Promise<ActionResult<T> | undefined>((resolve) => {
        startTransition(async () => {
          try {
            const result = await action();
            // Una acción que termina en redirect() puede no devolver resultado.
            if (!result) {
              resolve(undefined);
              return;
            }
            if (result.ok) {
              if (result.message && options.successToast !== false) toast.success(t(result.message));
              options.onSuccess?.(result.data);
            } else {
              toast.error(t(result.error));
              if (options.setError && result.fieldErrors) {
                for (const [field, messages] of Object.entries(result.fieldErrors)) {
                  if (messages?.[0]) options.setError(field as Path<F>, { message: messages[0] }); // se traduce en el campo
                }
              }
            }
            resolve(result);
          } catch (error) {
            // redirect() lanza una excepción controlada que Next.js debe manejar.
            if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) {
              throw error;
            }
            toast.error(t('Algo salió mal. Revisa tu conexión e intenta de nuevo.'));
            resolve(undefined);
          }
        });
      }),
    [t, toast],
  );

  return { run, pending };
}
