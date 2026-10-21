/**
 * Constantes de los atributos del ítem SIN zod (las usan los componentes del
 * sitio público). Los esquemas viven en ./item-attributes.ts, que reexporta esto.
 */
export const MANUAL_BADGES = ['new', 'featured', 'popular'] as const;
export type ManualBadge = (typeof MANUAL_BADGES)[number];

export const MAX_VARIANT_OPTIONS = 20;
export const MAX_EXTRA_OPTIONS = 20;
/** Precios por mayoreo: escalones por ítem. */
export const MAX_PRICE_TIERS = 5;
/** Tope de unidades por línea del pedido (igual que el pedido y sus estadísticas). */
export const MAX_TIER_QTY = 99;
export const MAX_PAIRINGS = 4;

/** Etiquetas de dieta y alérgenos (se muestran en la ficha y se filtran en el catálogo). */
export const DIET_TAGS = ['vegan', 'vegetarian', 'gluten-free', 'lactose-free', 'sugar-free', 'spicy', 'organic'] as const;
export type DietTag = (typeof DIET_TAGS)[number];

/** Avisa "¡Quedan N!" desde estas existencias o menos. */
export const LOW_STOCK = 5;
