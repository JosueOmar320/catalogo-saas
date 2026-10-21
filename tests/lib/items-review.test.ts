import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { itemToFormValues, storedTimeZone } from '@/features/items/defaults';
import { itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { itemHasPrice } from '@/features/items/review';

const TZ = 'America/Mexico_City';
const option = (id: string, price: number | null) => ({ id, name: id, price, sku: null, available: true });

describe('"Sin precio": un solo criterio para el inicio, la lista y el aviso por correo', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  it('con precio base, o con precio en alguna opción, tiene precio; sin nada, no', () => {
    assert.equal(itemHasPrice({ price: 35, attributes: null }, now), true);
    assert.equal(itemHasPrice({ price: '35', attributes: {} }, now), true);
    assert.equal(itemHasPrice({ price: null, attributes: null }, now), false);
    // Sin precio base pero cada tamaño con el suyo (antes contaba como "sin precio").
    assert.equal(itemHasPrice({ price: null, attributes: { variants: { label: 'Tamaño', options: [option('ch', 40), option('gr', null)] } } }, now), true);
    assert.equal(itemHasPrice({ price: null, attributes: { variants: { label: 'Tamaño', options: [option('ch', null)] } } }, now), false);
  });
  it('un precio programado que ya empezó cuenta como precio', () => {
    assert.equal(itemHasPrice({ price: null, attributes: { nextPrice: { on: '2026-10-01', price: 50, timeZone: TZ } } }, now), true);
    assert.equal(itemHasPrice({ price: null, attributes: { nextPrice: { on: '2027-01-01', price: 50, timeZone: TZ } } }, now), false);
  });
});

describe('Formulario del ítem: zona horaria guardada', () => {
  const base = {
    id: 'i1', category_id: null, type: 'product' as const, name: 'Rosca', slug: 'rosca', short_description: null, description: null, price: 120, compare_at_price: null, currency: 'MXN',
    price_note: null, sku: null, is_available: true, is_featured: false, is_visible: true, position: 0, tags: [], created_at: '', updated_at: '', deleted_at: null, images: [],
  };

  it('toma la zona de la oferta, la temporada o el precio programado (regresión: sólo miraba la oferta)', () => {
    assert.equal(storedTimeZone({ saleEnds: null, season: { from: '2026-12-01', until: '2027-01-06', timeZone: TZ }, nextPrice: null }), TZ);
    assert.equal(storedTimeZone({ saleEnds: null, season: null, nextPrice: { on: '2027-01-01', price: 130, timeZone: 'Europe/Madrid' } }), 'Europe/Madrid');
    assert.equal(storedTimeZone({ saleEnds: { on: '2026-12-31', timeZone: 'UTC' }, season: { from: '2026-12-01', until: '', timeZone: TZ }, nextPrice: null }), 'UTC');
    assert.equal(storedTimeZone({ saleEnds: null, season: null, nextPrice: null }), '');
  });

  it('editar sin tocar nada (p. ej. desde Garfield) conserva temporada y precio programado', () => {
    const attributes = { season: { from: '2026-12-01', until: '2027-01-06', timeZone: TZ }, nextPrice: { on: '2027-02-01', price: 130, timeZone: TZ } };
    const values = itemToFormValues({ ...base, attributes }, 80);
    assert.equal(values.saleTimeZone, TZ);
    assert.equal(values.cost, '80');
    const saved = itemFormToAttributes(itemFormSchema.parse(values));
    assert.deepEqual(saved.season, attributes.season);
    assert.deepEqual(saved.nextPrice, attributes.nextPrice);
  });
});
