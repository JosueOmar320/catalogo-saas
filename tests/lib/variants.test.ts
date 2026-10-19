import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyItemValues } from '@/features/items/defaults';
import { formVariants, itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { parseItemAttributes, type ItemVariants } from '@/lib/catalog/item-attributes';
import { variantPriceSummary } from '@/lib/catalog/variants';
import { mapItems, type ItemInput } from '@/lib/catalog/view-model';
import { buildSampleSite } from '@/lib/site/sample-site';
import { variantOrderItem } from '@/site-renderer/order/config';

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
