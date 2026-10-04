import sharp, { type Metadata } from 'sharp';

/**
 * Procesamiento de imágenes en el SERVIDOR (importar desde URL, Garfield,
 * imágenes externas para el PDF). Las subidas del navegador ya llegan
 * comprimidas (canvas), así que esto sólo corre para archivos de terceros.
 *
 * Salida compatible con todo: JPEG (o PNG si hay transparencia). Next/Image
 * sirve AVIF/WebP a los visitantes; el PDF sólo acepta JPEG/PNG.
 */

export const MAIN_MAX_SIDE = 2000;
export const THUMB_MAX_SIDE = 480;

export type Encoded = { data: Uint8Array; mime: 'image/jpeg' | 'image/png'; extension: 'jpg' | 'png'; width: number; height: number };
export type ProcessedImage = { main: Encoded; thumb: Encoded | null };

async function encode(input: Uint8Array, maxSide: number, alpha: boolean): Promise<Encoded> {
  const pipeline = sharp(input, { failOn: 'error', limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  const { data, info } = alpha
    ? await pipeline.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer({ resolveWithObject: true })
    : await pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), mime: alpha ? 'image/png' : 'image/jpeg', extension: alpha ? 'png' : 'jpg', width: info.width, height: info.height };
}

/** Imagen principal (≤ 2000 px) + miniatura (480 px, sólo si la imagen es más grande). */
export async function processImage(input: Uint8Array, options: { thumb?: boolean } = {}): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new Error('No se pudo leer la imagen.');
  }
  const alpha = Boolean(meta.hasAlpha);
  const main = await encode(input, MAIN_MAX_SIDE, alpha);
  const wantsThumb = options.thumb !== false && Math.max(main.width, main.height) > THUMB_MAX_SIDE * 1.2;
  return { main, thumb: wantsThumb ? await encode(input, THUMB_MAX_SIDE, alpha) : null };
}

/** Para el PDF: cualquier formato (WebP, AVIF, GIF) → JPEG/PNG del tamaño pedido. */
export async function toPdfImage(input: Uint8Array, maxSide = MAIN_MAX_SIDE): Promise<Encoded | null> {
  try {
    const meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
    return await encode(input, maxSide, Boolean(meta.hasAlpha));
  } catch {
    return null;
  }
}
