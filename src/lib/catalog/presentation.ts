import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';
import { CARD_STYLES } from '@/lib/design/styles-registry';
import { msg } from '@/i18n/translate';

/**
 * Presentación de productos: la decisión "¿cómo muestro mis productos?".
 * La comparten las secciones web (Productos, Servicios, Catálogo) y los
 * bloques del PDF. Cada destino la dibuja con su propio renderer.
 */
export const PRODUCT_LAYOUTS = ['grid', 'largeCards', 'compactList', 'editorial', 'imageFocus', 'priceList', 'zigzag', 'detail', 'magazine', 'compactGrid', 'minimal', 'comparison', 'serviceCards'] as const;
export type ProductLayout = (typeof PRODUCT_LAYOUTS)[number];

export const IMAGE_SHAPES = ['rect', 'rounded', 'circle', 'arch'] as const;

export const PRODUCT_LAYOUT_META: Record<ProductLayout, { label: string; description: string }> = {
  grid: { label: msg('Cuadrícula'), description: msg('Tarjetas en columnas. Uso general.') },
  largeCards: { label: msg('Tarjetas grandes'), description: msg('Pocas por fila, imagen grande y más texto.') },
  compactList: { label: msg('Lista compacta'), description: msg('Miniatura + texto + precio. Ideal para muchos ítems.') },
  editorial: { label: msg('Editorial'), description: msg('Un ítem grande junto a otros más pequeños.') },
  imageFocus: { label: msg('Imagen protagonista'), description: msg('La foto ocupa todo; el texto va encima.') },
  priceList: { label: msg('Lista de precios'), description: msg('Nombre ········ precio. Menús, servicios, repuestos.') },
  zigzag: { label: msg('Zigzag'), description: msg('Imagen y texto alternados. Ideal para servicios.') },
  detail: { label: msg('Ficha de detalle'), description: msg('Un ítem por bloque con galería y especificaciones.') },
  magazine: { label: msg('Revista'), description: msg('Un destacado grande + cuadrícula con el resto.') },
  compactGrid: { label: msg('Cuadrícula compacta'), description: msg('Muchas tarjetas pequeñas por fila. Catálogos grandes.') },
  minimal: { label: msg('Minimalista'), description: msg('Sólo foto, nombre y precio, sin tarjeta.') },
  comparison: { label: msg('Comparación'), description: msg('Tabla con precio y atributos lado a lado.') },
  serviceCards: { label: msg('Tarjetas de servicio'), description: msg('Cada servicio con lo que incluye en lista, su precio y botón. Ideal para servicios.') },
};

/** Qué opciones tienen sentido en cada layout (la interfaz sólo muestra éstas). */
export type PresentationOption = 'columns' | 'gap' | 'imageSize' | 'ratio' | 'shape' | 'imagePosition' | 'separators' | 'align' | 'cardStyle' | 'gallery';

export const LAYOUT_OPTIONS: Record<ProductLayout, PresentationOption[]> = {
  grid: ['columns', 'gap', 'ratio', 'shape', 'align', 'cardStyle'],
  largeCards: ['columns', 'gap', 'ratio', 'shape', 'align', 'cardStyle'],
  compactList: ['imageSize', 'shape', 'imagePosition', 'separators'],
  editorial: ['ratio', 'shape', 'gap'],
  imageFocus: ['columns', 'gap', 'ratio', 'shape'],
  priceList: ['imageSize', 'shape', 'separators', 'columns'],
  zigzag: ['imageSize', 'shape', 'imagePosition'],
  detail: ['imagePosition', 'shape', 'gallery'],
  magazine: ['columns', 'gap', 'ratio', 'shape', 'cardStyle'],
  compactGrid: ['columns', 'gap', 'ratio', 'shape', 'align', 'cardStyle'],
  minimal: ['columns', 'gap', 'ratio', 'shape', 'align'],
  comparison: ['imageSize', 'shape'],
  serviceCards: ['columns', 'gap', 'imageSize', 'shape', 'align', 'cardStyle'],
};

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const bool = (v: boolean) => f(z.boolean(), v);
  return z.object({
    layout: f(z.enum(PRODUCT_LAYOUTS), 'grid'),
    columns: z
      .object({
        desktop: f(z.number().int().min(1).max(6), 4),
        tablet: f(z.number().int().min(1).max(4), 3),
        mobile: f(z.number().int().min(1).max(2), 2),
        pdf: f(z.number().int().min(1).max(5), 3),
      })
      .prefault({}),
    gap: f(z.enum(['tight', 'normal', 'loose']), 'normal'),
    imageSize: f(z.enum(['sm', 'md', 'lg']), 'md'),
    ratio: f(z.enum(['square', 'portrait', 'landscape', 'wide']), 'square'),
    shape: f(z.enum(IMAGE_SHAPES), 'rounded'),
    frame: bool(false),
    imagePosition: f(z.enum(['left', 'right', 'alternate']), 'left'),
    separators: bool(true),
    align: f(z.enum(['left', 'center']), 'left'),
    cardStyle: f(z.union([z.literal('inherit'), z.enum(CARD_STYLES)]), 'inherit'),
    gallery: bool(true),
    arrangement: f(z.enum(['grid', 'carousel']), 'grid'),
    fields: z
      .object({
        image: bool(true),
        description: bool(true),
        price: bool(true),
        sku: bool(false),
        category: bool(false),
        badges: bool(true),
        attributes: f(z.enum(['none', 'card', 'all']), 'card'),
        button: bool(true),
        /** Precio anterior tachado (si el ítem tiene uno mayor al actual). */
        compareAt: bool(true),
        /** Porcentaje de descuento ("-20%") calculado del precio anterior. */
        discount: bool(false),
        /** Aviso "No disponible" en ítems agotados (el tema debe permitirlo). */
        availability: bool(true),
      })
      .prefault({}),
  });
}

export const presentationSchema = build(false);
export const lenientPresentationSchema = build(true);
export type Presentation = z.output<typeof presentationSchema>;

export function presentation(partial: Record<string, unknown> = {}): Presentation {
  return lenientPresentationSchema.parse(partial);
}

/** El layout usa esta opción (para mostrar u ocultar controles). */
export function layoutUses(layout: ProductLayout, option: PresentationOption): boolean {
  return LAYOUT_OPTIONS[layout].includes(option);
}
