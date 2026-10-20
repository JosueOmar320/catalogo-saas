/**
 * Nombre sugerido para un producto a partir del nombre de su foto:
 * "pastel-de-chocolate_2.jpg" → "Pastel de chocolate 2". Los nombres que
 * pone la cámara o WhatsApp ("IMG_1234", "WhatsApp Image 2026-…") no dicen
 * nada: devuelven "" para que el dueño escriba el nombre.
 */
const CAMERA = /^(img|dsc|dscn|pxl|mvimg|photo|foto|image|imagen|screenshot|captura|whatsapp image|wa\d|fb_img|signal-)[\s_-]*[\d\s_.:-]*(?:\s*\(\d+\))?$/i;

export function nameFromFile(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  if (!base || CAMERA.test(base) || /^(whats\s?app (image|imagen|video)|(imagen|video) de whats\s?app)\b/i.test(base) || /^[\d\s_.:-]+$/.test(base)) return '';
  const words = base
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const MAX_PHOTO_BATCH = 30;
