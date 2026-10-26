import { applyPreset, getPreset } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { navigationFromPages } from '@/lib/site/navigation';
import { pageToRow } from '@/lib/site/pages';
import { buildSamplePages, SAMPLE_CATEGORIES, SAMPLE_ITEMS, SAMPLE_REVIEWS, samplePhotoUrl, sampleCatalogSettings } from '@/lib/site/sample-site';
import { slugify } from '@/lib/utils/slug';
import { collectMediaPaths } from '@/lib/utils/storage';
import type { Json, OrderLineRow, OrderStatus, TablesInsert } from '@/types/database';

/**
 * Contenido de un negocio de prueba («Probar el panel»): el café de ejemplo
 * del sitio /demo convertido en filas de la base, con ids nuevos, más
 * pedidos, reseñas y 30 días de estadísticas para que el panel tenga vida.
 * Puro: sin base ni red (las fotos ya copiadas llegan en `images`).
 */

/** Una foto del café de ejemplo ya copiada al Storage del negocio de prueba. */
export type DemoImage = { path: string; thumbPath: string | null; width: number | null; height: number | null; size: number | null; mime: 'image/jpeg' | 'image/png' | 'image/webp' };

export type DemoSeedInput = {
  businessId: string;
  catalogId: string;
  ownerId: string;
  now: Date;
  /** Fotos copiadas, por id de foto del ejemplo (las que falten quedan sin imagen). */
  images: Record<string, DemoImage>;
  uuid?: () => string;
  /** Aleatorio con semilla (las pruebas fijan el resultado). */
  seed?: number;
};

export type DemoSeed = {
  categories: TablesInsert<'categories'>[];
  items: TablesInsert<'catalog_items'>[];
  itemImages: TablesInsert<'catalog_item_images'>[];
  itemCosts: TablesInsert<'item_costs'>[];
  media: TablesInsert<'media_assets'>[];
  pages: TablesInsert<'catalog_pages'>[];
  navigation: Json;
  reviews: TablesInsert<'reviews'>[];
  orders: TablesInsert<'orders'>[];
  siteViews: TablesInsert<'site_view_stats_daily'>[];
  itemViews: TablesInsert<'item_view_stats_daily'>[];
  funnel: TablesInsert<'funnel_stats_daily'>[];
  itemCart: TablesInsert<'item_cart_stats_daily'>[];
  orderStats: TablesInsert<'order_stats_daily'>[];
  searchMisses: TablesInsert<'search_miss_stats_daily'>[];
};

/** Nombre, tema y ajustes del negocio de prueba (van en create_demo_business). */
export function demoCatalogBase() {
  return { theme: applyPreset(DEFAULT_THEME, getPreset('restaurant')), settings: sampleCatalogSettings() };
}

/** Fotos del ejemplo que se copian al negocio de prueba (productos y categorías). */
export function demoPhotoIds(): string[] {
  return [...new Set([...SAMPLE_ITEMS.flatMap((item) => (item.photo ? [item.photo] : [])), ...SAMPLE_CATEGORIES.map((c) => c.photo)])];
}

/** mulberry32: el mismo número de semilla da los mismos pedidos y estadísticas. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const day = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
/** Esa hora (UTC) de hace `daysAgo` días; hoy, nunca después de ahora (un pedido «dentro de 3 horas» no existe). */
const at = (now: Date, daysAgo: number, hour: number) => {
  const date = new Date(now.getTime() - daysAgo * 86_400_000);
  date.setUTCHours(hour, (daysAgo * 17) % 60, 0, 0);
  const latest = now.getTime() - (hour % 5 + 1) * 23 * 60_000;
  return new Date(Math.min(date.getTime(), latest)).toISOString();
};

/** Clientes de ejemplo (teléfonos ficticios, sin dueño real). */
const CUSTOMERS = [
  { name: 'Mariana González', phone: '+5255000001001' },
  { name: 'Luis Ramírez', phone: '+5255000001002' },
  { name: 'Sofía Pérez', phone: '+5255000001003' },
  { name: 'Oficina Roma Norte', phone: '+5255000001004' },
  { name: 'Andrea Ruiz', phone: '+5255000001005' },
];

/** Pedidos de ejemplo: [hace cuántos días, cliente, estado, entrega, líneas [índice, cantidad, opción]]. */
const ORDERS: [daysAgo: number, customer: number, status: OrderStatus, fulfillment: 'pickup' | 'delivery' | 'table', lines: [item: number, qty: number, variant?: number][]][] = [
  [0, 0, 'new', 'delivery', [[1, 2, 1], [4, 2]]],
  [0, 3, 'new', 'delivery', [[0, 6], [4, 12], [3, 1]]],
  [0, 4, 'confirmed', 'pickup', [[2, 1], [5, 1]]],
  [1, 1, 'ready', 'pickup', [[1, 1], [4, 1]]],
  [1, 2, 'delivered', 'table', [[0, 2], [6, 2]]],
  [2, 0, 'delivered', 'delivery', [[3, 2], [5, 1]]],
  [4, 3, 'delivered', 'delivery', [[0, 8], [4, 8]]],
  [6, 1, 'cancelled', 'pickup', [[2, 2]]],
  [9, 0, 'delivered', 'pickup', [[1, 1], [4, 2]]],
  [12, 4, 'delivered', 'delivery', [[3, 1], [2, 2]]],
];

const SOURCES = [
  ['instagram', 0.34],
  ['direct', 0.22],
  ['whatsapp', 0.16],
  ['google', 0.14],
  ['qr', 0.09],
  ['facebook', 0.05],
] as const;

const MISSED_SEARCHES = ['matcha', 'chai', 'sin gluten', 'bagel'];
/** Días de estadísticas sembrados. */
const DAYS = 60;

export function buildDemoSeed(input: DemoSeedInput): DemoSeed {
  const { businessId, catalogId, now } = input;
  const uuid = input.uuid ?? (() => crypto.randomUUID());
  const rand = random(input.seed ?? 20261110);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const settings = sampleCatalogSettings();
  const media: DemoSeed['media'] = [];

  // Fotos copiadas: una entrada en la biblioteca por foto (la usan productos y categorías).
  const registered = new Set<string>();
  const register = (photo: string, folder: 'products' | 'images', name: string) => {
    const image = input.images[photo];
    if (!image || registered.has(photo)) return image ?? null;
    registered.add(photo);
    media.push({ business_id: businessId, path: image.path, thumb_path: image.thumbPath, kind: 'media', folder, name, alt: name, mime_type: image.mime, width: image.width, height: image.height, size_bytes: image.size, source: 'stock', source_url: samplePhotoUrl(photo), attribution: 'Unsplash', storage_provider: 'supabase', created_by: input.ownerId });
    return image;
  };

  const categoryIds = SAMPLE_CATEGORIES.map(() => uuid());
  const categories: DemoSeed['categories'] = SAMPLE_CATEGORIES.map((category, index) => ({
    id: categoryIds[index],
    business_id: businessId,
    catalog_id: catalogId,
    name: category.name,
    description: category.description,
    image_path: register(category.photo, 'images', category.name)?.path ?? null,
    position: index,
  }));

  const itemIds = SAMPLE_ITEMS.map(() => uuid());
  const items: DemoSeed['items'] = [];
  const itemImages: DemoSeed['itemImages'] = [];
  SAMPLE_ITEMS.forEach((item, index) => {
    items.push({
      id: itemIds[index],
      business_id: businessId,
      catalog_id: catalogId,
      category_id: categoryIds[item.category],
      type: item.type ?? 'product',
      name: item.name,
      slug: slugify(item.name),
      short_description: item.short,
      description: null,
      price: item.price,
      compare_at_price: item.compareAt ?? null,
      currency: settings.currency,
      price_note: item.note ?? null,
      sku: item.sku ?? null,
      is_available: item.available ?? true,
      is_featured: item.featured ?? false,
      position: index,
      attributes: {
        badges: item.badges ?? [],
        variants: item.variants
          ? { label: item.variants.label, options: item.variants.options.map(([name, price], i) => ({ id: `v${i + 1}`, name, price, sku: null, available: true })) }
          : null,
        extras: item.extras
          ? { label: item.extras.label, max: item.extras.max, options: item.extras.options.map(([name, price], i) => ({ id: `x${i + 1}`, name, price, available: true })) }
          : null,
        orderHours: item.orderHours ?? null,
        stock: item.stock ?? null,
        diet: item.diet ?? [],
        tiers: (item.tiers ?? []).map(([minQty, price]) => ({ minQty, price })),
        pairings: (item.pairings ?? []).map((i) => itemIds[i]),
        values: item.attrs ?? {},
      } as Json,
    });
    const image = item.photo ? register(item.photo, 'products', item.name) : null;
    if (image) itemImages.push({ business_id: businessId, item_id: itemIds[index], storage_path: image.path, thumb_path: image.thumbPath, width: image.width, height: image.height, size_bytes: image.size, mime_type: image.mime, alt: item.name, position: 0 });
  });

  // Costos privados de algunos productos: el panel muestra el margen.
  const itemCosts: DemoSeed['itemCosts'] = SAMPLE_ITEMS.flatMap((item, index) =>
    item.price && (item.type ?? 'product') === 'product' ? [{ item_id: itemIds[index], business_id: businessId, cost: Math.round(item.price * 0.38) }] : [],
  );

  // Páginas con ids nuevos (los enlaces entre páginas los usan): se reemplazan en todo el contenido.
  const samplePages = buildSamplePages();
  let content = JSON.stringify(samplePages);
  for (const page of samplePages) content = content.replaceAll(page.id, uuid());
  const pagesWithIds = JSON.parse(content) as typeof samplePages;
  const pages: DemoSeed['pages'] = pagesWithIds.map((page, index) => ({ ...pageToRow(page), business_id: businessId, catalog_id: catalogId, position: index, sections: page.sections as unknown as Json, style: page.style as unknown as Json, seo: page.seo as unknown as Json }));
  const navigation = navigationFromPages(pagesWithIds.filter((page) => page.slug !== 'pedido-rapido')) as unknown as Json;
  // Fotos de las secciones: enlaces externos registrados en la biblioteca (como «Usar enlace externo»).
  for (const url of new Set(collectMediaPaths(pagesWithIds))) {
    if (!/^https:\/\//.test(url)) continue;
    media.push({ business_id: businessId, path: url, public_url: url, storage_provider: 'external', kind: 'media', folder: 'backgrounds', name: 'Foto de Unsplash', alt: '', source: 'stock', source_url: url, attribution: 'Unsplash', created_by: input.ownerId });
  }

  const reviews: DemoSeed['reviews'] = [
    ...SAMPLE_REVIEWS.map((review, index) => ({
      business_id: businessId,
      item_id: review.itemIndex === null ? null : itemIds[review.itemIndex],
      name: review.name,
      rating: review.rating,
      body: review.body,
      status: 'approved' as const,
      created_at: at(now, 3 + index * 4, 15),
      reviewed_at: at(now, 3 + index * 4, 18),
      reply: review.reply ?? null,
      replied_at: review.reply ? at(now, 3 + index * 4, 19) : null,
    })),
    // Una pendiente: el inicio del panel y la página Reseñas piden aprobarla.
    { business_id: businessId, item_id: itemIds[4], name: 'Daniela V.', rating: 5, body: 'El croissant estaba perfecto, crujiente por fuera y suave por dentro.', status: 'pending', created_at: at(now, 0, 13) },
  ];

  const references = new Set<string>();
  const orders: DemoSeed['orders'] = ORDERS.map(([daysAgo, customerIndex, status, fulfillment, lines]) => {
    const customer = CUSTOMERS[customerIndex];
    const orderLines: OrderLineRow[] = lines.map(([itemIndex, qty, variantIndex]) => {
      const item = SAMPLE_ITEMS[itemIndex];
      const variant = variantIndex === undefined ? null : item.variants?.options[variantIndex];
      // Mayoreo: el precio por pieza del escalón que alcanza la línea.
      const tier = [...(item.tiers ?? [])].reverse().find(([minQty]) => qty >= minQty);
      const unitPrice = variant ? (variant[1] ?? item.price) : tier ? tier[1] : item.price;
      return { itemId: itemIds[itemIndex], name: item.name, variant: variant ? variant[0] : '', qty, unitPrice, note: '' };
    });
    const subtotal = orderLines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
    const deliveryFee = fulfillment === 'delivery' && subtotal < 300 ? 35 : 0;
    let reference = '';
    while (!reference || references.has(reference)) reference = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[int(0, 31)]).join('');
    references.add(reference);
    const created = at(now, daysAgo, 13 + (customerIndex % 5));
    return {
      business_id: businessId,
      reference,
      status,
      customer_name: customer.name,
      customer_phone: customer.phone,
      fulfillment,
      address: fulfillment === 'delivery' ? 'Calle Orizaba 45, Roma Norte' : null,
      table_label: fulfillment === 'table' ? '4' : null,
      payment: fulfillment === 'table' ? 'card' : 'cash',
      note: customerIndex === 3 ? 'Para la junta de las 10:00' : null,
      lines: orderLines,
      currency: settings.currency,
      subtotal,
      discount: null,
      delivery_fee: deliveryFee || null,
      tip: null,
      total: subtotal + deliveryFee,
      created_at: created,
      status_changed_at: created,
    };
  });

  // 60 días de visitas, recorrido y pedidos (la página Estadísticas compara contra el periodo anterior),
  // con la forma de un negocio real: más los fines de semana y creciendo.
  const siteViews: DemoSeed['siteViews'] = [];
  const itemViews: DemoSeed['itemViews'] = [];
  const funnel: DemoSeed['funnel'] = [];
  const itemCart: DemoSeed['itemCart'] = [];
  const orderStats: DemoSeed['orderStats'] = [];
  const searchMisses: DemoSeed['searchMisses'] = [];
  const productIndexes = SAMPLE_ITEMS.flatMap((item, index) => (item.price ? [index] : []));
  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const date = day(now, daysAgo);
    const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
    const sessions = Math.round(int(28, 46) * (weekend ? 1.35 : 1) * (1 + (DAYS - 1 - daysAgo) / 90));
    let orders = 0;
    for (const [source, share] of SOURCES) {
      const s = Math.max(0, Math.round(sessions * share + int(-2, 2)));
      if (!s) continue;
      const viewed = Math.round(s * (0.55 + rand() * 0.15));
      const started = Math.round(viewed * (0.22 + rand() * 0.1));
      const sent = Math.round(started * (0.45 + rand() * 0.2));
      orders += sent;
      funnel.push({ business_id: businessId, day: date, source, sessions: s, viewed_product: viewed, started_cart: started, sent_order: sent });
    }
    siteViews.push({ business_id: businessId, day: date, views: Math.round(sessions * (2.4 + rand())) });
    let value = 0;
    let units = 0;
    for (const index of productIndexes) {
      const views = int(0, 9) + (SAMPLE_ITEMS[index].featured ? 6 : 0);
      if (views) itemViews.push({ business_id: businessId, day: date, item_id: itemIds[index], views });
      const adds = Math.max(0, Math.round(views * (0.2 + rand() * 0.2)) - (index === 2 ? 0 : 1));
      if (adds) itemCart.push({ business_id: businessId, day: date, item_id: itemIds[index], adds });
      const sold = Math.min(adds, Math.round(adds * 0.6));
      units += sold;
      value += sold * (SAMPLE_ITEMS[index].price ?? 0);
    }
    if (orders) orderStats.push({ business_id: businessId, day: date, orders, units: Math.max(units, orders), value });
    if (daysAgo % 6 === 0) searchMisses.push({ business_id: businessId, day: date, term: MISSED_SEARCHES[(daysAgo / 6) % MISSED_SEARCHES.length], searches: int(1, 4) });
  }

  return { categories, items, itemImages, itemCosts, media, pages, navigation, reviews, orders, siteViews, itemViews, funnel, itemCart, orderStats, searchMisses };
}
