import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyItemValues } from '@/features/items/defaults';
import { formExtras, formVariants, itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { withinHours } from '@/lib/business/schedule';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { parseItemAttributes, type ItemVariants } from '@/lib/catalog/item-attributes';
import { variantPriceSummary } from '@/lib/catalog/variants';
import { mapItems, type ItemInput } from '@/lib/catalog/view-model';
import { buildSampleSite } from '@/lib/site/sample-site';
import { buildSiteViewModel } from '@/lib/site/view-model';
import { inSeason, seasonStatus } from '@/lib/catalog/season';
import { catalogSitemapEntries } from '@/lib/catalog/sitemap';
import { optionOrderItem, orderConfig, variantOrderItem } from '@/site-renderer/order/config';
import { buildOrderMessage, refreshLines } from '@/site-renderer/order/message';
import { siteTranslator } from '@/site-renderer/site-i18n';

const option = (id: string, price: number | null, available = true) => ({ id, name: id, price, sku: null, available });
const variants = (...options: ReturnType<typeof option>[]): ItemVariants => ({ label: 'Tamaño', options });

describe('Opciones del producto: precio', () => {
  it('sin opciones usa el precio del producto', () => {
    assert.deepEqual(variantPriceSummary(50, null), { price: 50, from: false });
  });

  it('muestra el menor precio y "desde" cuando varían; sin precio propio usa el del producto', () => {
    assert.deepEqual(variantPriceSummary(68, variants(option('12', null), option('16', 78))), { price: 68, from: true });
    assert.deepEqual(variantPriceSummary(100, variants(option('a', 80), option('b', 120))), { price: 80, from: true });
    assert.deepEqual(variantPriceSummary(40, variants(option('a', null), option('b', 40))), { price: 40, from: false });
  });

  it('ignora las agotadas si queda alguna disponible', () => {
    assert.deepEqual(variantPriceSummary(null, variants(option('a', 10, false), option('b', 30))), { price: 30, from: true });
    assert.deepEqual(variantPriceSummary(null, variants(option('a', 10, false), option('b', 30, false))), { price: 10, from: true });
  });

  it('sin ningún precio queda "a consultar"', () => {
    assert.deepEqual(variantPriceSummary(null, variants(option('a', null))), { price: null, from: false });
  });
});

describe('Opciones del producto: guardado', () => {
  it('lee atributos viejos sin opciones y descarta opciones inválidas', () => {
    assert.equal(parseItemAttributes({ badges: [] }).variants, null);
    assert.equal(parseItemAttributes({ variants: { label: 'x', options: 'no' } }).variants, null);
  });

  it('el formulario pide etiqueta y al menos una opción con nombre', () => {
    const base = { ...emptyItemValues('product', 'MXN'), name: 'Café' };
    const enabled = { ...base, variantsEnabled: true, variantsLabel: '', variants: [{ id: 'a', name: ' ', price: '', sku: '', available: true }] };
    const result = itemFormSchema.safeParse(enabled);
    assert.equal(result.success, false);
    const paths = result.error!.issues.map((i) => i.path.join('.'));
    assert.ok(paths.includes('variantsLabel') && paths.includes('variants'));
    // Apagadas, las filas a medio llenar no estorban.
    assert.equal(itemFormSchema.safeParse({ ...enabled, variantsEnabled: false }).success, true);
  });

  it('formVariants limpia nombres vacíos, convierte precios y sólo aplica a productos', () => {
    const values = itemFormSchema.parse({
      ...emptyItemValues('product', 'MXN'),
      name: 'Playera',
      variantsEnabled: true,
      variantsLabel: ' Talla ',
      variants: [
        { id: 'm', name: ' M ', price: '', sku: '', available: true },
        { id: 'x', name: '', price: '99', sku: '', available: true },
        { id: 'l', name: 'L', price: '1250.50', sku: 'PL-L', available: false },
      ],
    });
    assert.deepEqual(formVariants(values), {
      label: 'Talla',
      options: [
        { id: 'm', name: 'M', price: null, sku: null, available: true },
        { id: 'l', name: 'L', price: 1250.5, sku: 'PL-L', available: false },
      ],
    });
    assert.equal(itemFormToAttributes({ ...values, type: 'service' }).variants, null);
  });
});

describe('Opciones del producto: catálogo y pedido', () => {
  const row = (attributes: unknown, overrides: Partial<ItemInput> = {}): ItemInput =>
    ({
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'latte',
      type: 'product',
      name: 'Latte',
      short_description: null,
      description: null,
      price: 68,
      compare_at_price: 90,
      currency: 'MXN',
      price_note: null,
      sku: 'LAT',
      is_available: true,
      is_featured: false,
      is_visible: true,
      tags: [],
      category_id: null,
      position: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      attributes,
      images: [],
      ...overrides,
    }) as unknown as ItemInput;

  it('la vista usa el menor precio, "desde", oculta el precio anterior y se agota si se agotan todas', () => {
    const [item] = mapItems([row({ variants: variants(option('12', null), option('16', 78)) })], [], 'cafe', { locale: 'es-MX' });
    assert.equal(item.price, 68);
    assert.equal(item.priceNote, 'desde');
    assert.equal(item.compareAtLabel, null);
    assert.deepEqual(
      item.variants?.options.map((o) => [o.name, o.price]),
      [['12', 68], ['16', 78]],
    );
    assert.ok(item.variants?.options[1].priceLabel?.includes('78'));

    const [soldOut] = mapItems([row({ variants: variants(option('12', null, false)) })], [], 'cafe', { locale: 'es-MX' });
    assert.equal(soldOut.isAvailable, false);
  });

  it('cada opción es una línea distinta del pedido, contada como el mismo producto', () => {
    const latte = buildSampleSite().items.find((i) => i.name === 'Latte de avena')!;
    assert.equal(latte.priceNote, 'desde');
    const large = latte.variants!.options.find((o) => o.name === '16 oz')!;
    const line = variantOrderItem(latte, large);
    assert.equal(line.id, `${latte.id}:${large.id}`);
    assert.equal(line.itemId, latte.id);
    assert.equal(line.name, 'Latte de avena (16 oz)');
    assert.equal(line.price, 78);
    assert.notEqual(line.id, variantOrderItem(latte, latte.variants!.options[0]).id);
  });
});

describe('Extras, notas y horario del producto', () => {
  it('cada combinación de opción y extras es una línea con precio sumado (el orden de los extras no importa)', () => {
    const latte = buildSampleSite().items.find((i) => i.name === 'Latte de avena')!;
    const [shot, almond, cinnamon] = latte.extras!.options;
    const large = latte.variants!.options[1];
    const a = optionOrderItem(latte, large, [shot, almond]);
    const b = optionOrderItem(latte, large, [almond, shot]);
    assert.equal(a.id, b.id);
    assert.equal(a.id, `${latte.id}:v2+x1+x2`);
    // El nombre lleva los extras en el orden recibido (la ficha los pasa en el orden del producto).
    assert.equal(a.name, 'Latte de avena (16 oz) + Shot extra, Leche de almendra');
    assert.equal(a.price, 98); // 78 + 12 + 8
    assert.equal(a.itemId, latte.id);
    assert.equal(optionOrderItem(latte, large, [cinnamon]).price, 78); // gratis
    assert.equal(optionOrderItem(latte, large).id, `${latte.id}:v2`);
  });

  it('el pedido guardado con extras se actualiza; si un extra ya no está, la línea sale', () => {
    const site = buildSampleSite();
    const config = orderConfig(site)!;
    const latte = site.items.find((i) => i.name === 'Latte de avena')!;
    const line = { ...optionOrderItem(latte, latte.variants!.options[0], [latte.extras!.options[0]]), qty: 1 };
    assert.equal(config.catalog[`${latte.id}+x1`]?.[0], 12);
    assert.deepEqual(refreshLines([{ ...line, price: 1 }], config.catalog).lines.map((l) => l.price), [80]); // 68 + 12
    const gone = refreshLines([{ ...line, id: `${latte.id}:v1+x9` }], config.catalog);
    assert.deepEqual([gone.lines.length, gone.removed], [0, [line.name]]);
  });

  it('la nota de cada producto va en el mensaje, debajo de su línea', () => {
    const text = buildOrderMessage({
      lines: [{ id: 'a', name: 'Chilaquiles', sku: null, price: 90, priceLabel: '$90', currency: 'MXN', url: '', image: null, qty: 1, note: ' sin cebolla ' }],
      pricing: { currency: 'MXN', locale: 'es-MX', format: catalogSettingsSchema.parse({}).priceFormat },
      intro: 'Hola',
      businessName: 'Café',
      siteUrl: 'https://x.test',
      t: siteTranslator('es'),
    });
    assert.match(text, /• 1 × Chilaquiles — \$90\n {3}Nota: sin cebolla\n/);
  });

  it('horario del producto: dentro o fuera (también cruzando la medianoche), y no se sugiere', () => {
    const at = (iso: string) => new Date(iso);
    const tz = 'America/Mexico_City';
    assert.equal(withinHours({ from: '08:00', to: '13:00' }, tz, at('2026-10-19T15:00:00Z')), true); // 9:00
    assert.equal(withinHours({ from: '08:00', to: '13:00' }, tz, at('2026-10-19T19:00:00Z')), false); // 13:00
    assert.equal(withinHours({ from: '22:00', to: '02:00' }, tz, at('2026-10-20T07:00:00Z')), true); // 1:00
    const site = buildSampleSite();
    const config = orderConfig(site)!;
    const bread = site.items.find((i) => i.name === 'Pan de masa madre')!;
    assert.deepEqual(config.orderHours[bread.id], { from: '08:00', to: '13:00' });
    assert.equal(config.timeZone, tz);
    assert.ok(!config.suggestions.some((s) => s.id === bread.id));
  });

  it('el formulario guarda extras (sin precio = gratis, máximo acotado) y el horario sólo en productos', () => {
    const values = itemFormSchema.parse({
      ...emptyItemValues('product', 'MXN'),
      name: 'Latte',
      extrasEnabled: true,
      extrasLabel: ' Extras ',
      extrasMax: '9',
      extras: [
        { id: 'a', name: 'Shot', price: '12', available: true },
        { id: 'b', name: 'Canela', price: '', available: true },
        { id: 'c', name: ' ', price: '5', available: true },
      ],
      orderHoursEnabled: true,
      orderHoursFrom: '07:00',
      orderHoursTo: '12:00',
    });
    assert.deepEqual(formExtras(values), { label: 'Extras', max: 2, options: [{ id: 'a', name: 'Shot', price: 12, available: true }, { id: 'b', name: 'Canela', price: 0, available: true }] });
    assert.deepEqual(itemFormToAttributes(values).orderHours, { from: '07:00', to: '12:00' });
    assert.equal(itemFormToAttributes({ ...values, type: 'service' }).extras, null);
    assert.equal(itemFormSchema.safeParse({ ...emptyItemValues('product', 'MXN'), name: 'X', orderHoursEnabled: true, orderHoursFrom: '09:00', orderHoursTo: '09:00' }).success, false);
  });
});

describe('Precios por mayoreo', () => {
  const base = { ...emptyItemValues('product', 'MXN'), name: 'Galleta', price: '10' };

  it('el formulario guarda las filas completas, de menor a mayor; con opciones, ninguna', () => {
    const values = itemFormSchema.parse({ ...base, tiers: [{ minQty: '24', price: '7' }, { minQty: '', price: '' }, { minQty: '12', price: '8.50' }] });
    assert.deepEqual(itemFormToAttributes(values).tiers, [{ minQty: 12, price: 8.5 }, { minQty: 24, price: 7 }]);
    assert.deepEqual(itemFormToAttributes({ ...values, variantsEnabled: true }).tiers, []);
    assert.deepEqual(itemFormToAttributes({ ...values, type: 'service' }).tiers, []);
    assert.equal(itemFormSchema.safeParse({ ...base, tiers: [{ minQty: '1', price: '5' }] }).success, false);
    assert.equal(itemFormSchema.safeParse({ ...base, tiers: [{ minQty: '12', price: '' }] }).success, false);
    assert.equal(itemFormSchema.safeParse({ ...base, tiers: [{ minQty: '12', price: '8' }, { minQty: '12', price: '7' }] }).success, false);
  });

  it('se leen de los atributos (lo inválido se descarta sin perder lo demás) y llegan a la ficha y al pedido', () => {
    assert.deepEqual(parseItemAttributes({ tiers: [{ minQty: 6, price: 42 }] }).tiers, [{ minQty: 6, price: 42 }]);
    const broken = parseItemAttributes({ tiers: [{ minQty: 12, price: 5 }, { minQty: 6, price: 6 }], stock: 3 });
    assert.deepEqual([broken.tiers, broken.stock], [[], 3]);

    const site = buildSampleSite();
    const croissant = site.items.find((i) => i.name === 'Croissant de mantequilla')!;
    assert.deepEqual(croissant.tiers.map((tier) => [tier.minQty, tier.price]), [[6, 42], [12, 38]]);
    assert.match(croissant.tiers[0].priceLabel, /42/);
    assert.deepEqual(orderConfig(site)!.tiers[croissant.id], [[6, 42], [12, 38]]);
  });
});

describe('Temporada y «Combínalo con»', () => {
  const TZ = 'America/Mexico_City';
  const base = { ...emptyItemValues('product', 'MXN'), name: 'Pan de muerto', price: '45', saleTimeZone: TZ };

  it('la temporada decide si se ve hoy (en la zona de quien la programó)', () => {
    const season = { from: '2026-10-20', until: '2026-11-02', timeZone: TZ };
    assert.equal(seasonStatus(null, new Date('2026-10-19T18:00:00Z')), null);
    assert.equal(seasonStatus(season, new Date('2026-10-20T05:00:00Z')), 'upcoming'); // 19 oct, 23:00
    assert.equal(seasonStatus(season, new Date('2026-10-20T06:00:00Z')), 'active');
    assert.equal(seasonStatus(season, new Date('2026-11-03T05:59:00Z')), 'active'); // 2 nov, 23:59
    assert.equal(seasonStatus(season, new Date('2026-11-03T06:00:00Z')), 'ended');
    assert.equal(inSeason({ from: '', until: '2026-11-02', timeZone: TZ }, new Date('2026-01-01T12:00:00Z')), true);
  });

  it('el formulario guarda las fechas con la zona horaria; sin fechas, nada; al revés, error', () => {
    const values = itemFormSchema.parse({ ...base, seasonFrom: '2026-10-20', seasonUntil: '2026-11-02', pairings: ['00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000104'] });
    const attributes = itemFormToAttributes(values);
    assert.deepEqual(attributes.season, { from: '2026-10-20', until: '2026-11-02', timeZone: TZ });
    assert.deepEqual(attributes.pairings, ['00000000-0000-4000-8000-000000000104']);
    assert.equal(itemFormToAttributes(itemFormSchema.parse(base)).season, null);
    assert.equal(itemFormSchema.safeParse({ ...base, seasonFrom: '2026-11-02', seasonUntil: '2026-10-20' }).success, false);
    assert.deepEqual(parseItemAttributes({ season: { from: '2026-11-02', until: '2026-10-20', timeZone: TZ }, stock: 2 }).season, null);
  });

  it('el sitio publicado no trae lo que está fuera de temporada; el panel sí', () => {
    const row = (slug: string, season: unknown) =>
      ({ id: `11111111-1111-4111-8111-11111111111${slug.length}`, slug, type: 'product', name: slug, short_description: null, description: null, price: 40, compare_at_price: null, currency: 'MXN', price_note: null, sku: null, is_available: true, is_featured: false, is_visible: true, tags: [], category_id: null, position: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', attributes: { season }, images: [] }) as unknown as ItemInput;
    const input = {
      business: { name: 'Pan', slug: 'pan', description: null, logo_path: null, contact: {}, social_links: [] },
      catalog: { theme: null, settings: {}, seo: {}, cover_path: null, favicon_path: null, published_at: null },
      categories: [],
      items: [row('rosca', { from: '2027-01-01', until: '2027-01-06', timeZone: TZ }), row('pan', null)],
      pages: [],
      removeBranding: false,
    };
    const now = new Date('2026-10-19T18:00:00Z');
    assert.deepEqual(buildSiteViewModel(input, { public: true, now }).items.map((i) => i.slug), ['pan']);
    assert.deepEqual(buildSiteViewModel(input, { now }).items.map((i) => i.slug).sort(), ['pan', 'rosca']);
    const sitemap = catalogSitemapEntries({ businesses: [{ id: 'b', slug: 'pan' }], catalogs: [{ id: 'c', business_id: 'b', seo: {}, updated_at: '2026-10-01' }], pages: [], items: [{ catalog_id: 'c', slug: 'rosca', updated_at: '2026-10-01', attributes: { season: { from: '2027-01-01', until: '', timeZone: TZ } } }] }, 100, now);
    assert.deepEqual(sitemap.map((e) => e.url.replace(/^https?:\/\/[^/]+/, '')), ['/catalogo/pan']);
  });

  it('la demo sugiere en el latte lo elegido («Combínalo con»)', () => {
    const latte = buildSampleSite().items.find((i) => i.name === 'Latte de avena')!;
    assert.deepEqual(latte.pairings, ['00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105']);
  });
});
