import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { publicStorageUrl } from '@/lib/utils/storage';

/**
 * Proveedor de almacenamiento de archivos. La aplicación sólo conoce
 * CLAVES (`{business}/media/{uuid}.jpg`); este adaptador decide dónde viven
 * los bytes y cuál es su URL pública. Para cambiar a R2/S3/Cloudinary se
 * implementa esta interfaz (y `publicStorageUrl`), sin tocar el contenido
 * guardado: las claves no cambian.
 */
export interface StorageProvider {
  readonly id: 'supabase';
  publicUrl(key: string): string | null;
  upload(key: string, data: Uint8Array | Blob, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  copy(from: string, to: string): Promise<void>;
}

export class StorageError extends Error {}

/** Supabase Storage (bucket público con políticas por negocio). Usa la sesión del usuario: aplica RLS de Storage. */
export function supabaseStorage(client: SupabaseClient): StorageProvider {
  const bucket = () => client.storage.from(env.storageBucket);
  return {
    id: 'supabase',
    publicUrl: (key) => publicStorageUrl(key),
    async upload(key, data, contentType) {
      const { error } = await bucket().upload(key, data, { contentType, cacheControl: '31536000', upsert: false });
      if (error) throw new StorageError('No se pudo guardar el archivo.');
    },
    async remove(keys) {
      if (keys.length === 0) return;
      const { error } = await bucket().remove(keys);
      if (error) console.error('storage.remove', error.message);
    },
    async copy(from, to) {
      const { error } = await bucket().copy(from, to);
      if (error) throw new StorageError('No se pudo copiar el archivo.');
    },
  };
}
