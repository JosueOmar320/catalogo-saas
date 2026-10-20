import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyItemValues } from '@/features/items/defaults';
import { itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { formatPickup, pickupSlots, scheduleSchema } from '@/lib/business/schedule';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { mapItems, type ItemInput } from '@/lib/catalog/view-model';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { buildSampleSite } from '@/lib/site/sample-site';
import { resolveBadges } from '@/lib/site/resolve';
import { EMPTY_FILTERS, filterItems } from '@/site-renderer/filter';
import { orderConfig } from '@/site-renderer/order/config';
import { buildOrderMessage, NO_CHOICES, NO_OPTIONS, summarizeOrder, type OrderOptions } from '@/site-renderer/order/message';
import { siteTranslator } from '@/site-renderer/site-i18n';

const TZ = 'America/Mexico_City'; // UTC−6; el 19 de octubre de 2026 es lunes
const week = scheduleSchema.parse({
  enabled: true,
  timezone: TZ,
  days: [...Array.from({ length: 5 }, () => ({ open: true, ranges: [{ from: '09:00', to: '12:00' }] })), { open: true, ranges: [{ from: '10:00', to: '11:00' }] }, { open: false, ranges: [] }],
});

describe('¿Para cuándo? (horarios para recoger o recibir)', () => {
  it('dentro del horario, cada `step` minutos y después del tiempo de preparación', () => {
    // Lunes 10:10 → con 60 min de preparación, el primero es 11:30 (en pasos de 30).
    const days = pickupSlots(week, new Date('2026-10-19T16:10:00Z'), { leadMinutes: 60, days: 3, step: 30 });
    assert.deepEqual(days[0], { date: '2026-10-19', day: 0, offset: 0, slots: ['11:30'] });
    assert.deepEqual(days[1].slots, ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
    assert.equal(days.length, 3);
  });

  it('salta los días cerrados y respeta cuántos días hacia adelante', () => {
    // Sábado 10:45: hoy ya no da tiempo (cierra 11:00), domingo cerrado → lunes.
    const days = pickupSlots(week, new Date('2026-10-24T16:45:00Z'), { leadMinutes: 30, days: 3, step: 30 });
    assert.deepEqual(days.map((d) => [d.date, d.offset]), [['2026-10-26', 2]]);
  });

  it('sin horario configurado usa 9:00–20:00 todos los días', () => {
    const days = pickupSlots(null, new Date('2026-10-19T12:00:00Z'), { leadMinutes: 0, days: 1, step: 60 });
    assert.equal(days[0].slots.at(-1), '19:00');
  });

  it('texto para el mensaje en el idioma del sitio', () => {
    assert.equal(formatPickup('2026-10-22', '09:30', 'es-MX'), 'jueves, 22 de octubre, 9:30');
    assert.equal(formatPickup('2026-10-22', '09:30', 'en-US'), 'Thursday, October 22, 9:30');
  });

  it('obligatorio bloquea hasta elegir; el mensaje dice para cuándo', () => {
    const options: OrderOptions = { ...NO_OPTIONS, scheduling: 'required' };
    const lines = [{ id: 'a', name: 'Pan', sku: null, price: 40, priceLabel: '$40', currency: 'MXN', url: '', image: null, qty: 1 }];
    const pricing = { currency: 'MXN', locale: 'es-MX', format: catalogSettingsSchema.parse({}).priceFormat };
    assert.equal(summarizeOrder(lines, pricing, options).blocker, 'when');
    const choices = { ...NO_CHOICES, when: { date: '2026-10-22', time: '09:30' } };
    assert.equal(summarizeOrder(lines, pricing, options, choices).blocker, null);
    const text = buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options, choices });
    assert.match(text, /Total: \$40\nPara: jueves, 22 de octubre, 9:30\n/);
    assert.equal(catalogSettingsSchema.parse({ order: { leadMinutes: '120', scheduleDays: '14' } }).order.leadMinutes, 120);
  });
});

describe('Existencias y dieta', () => {
  const row = (attributes: unknown): ItemInput =>
    ({ id: '11111111-1111-4111-8111-111111111111', slug: 'pan', type: 'product', name: 'Pan', short_description: null, description: null, price: 40, compare_at_price: null, currency: 'MXN', price_note: null, sku: null, is_available: true, is_featured: false, is_visible: true, tags: [], category_id: null, position: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', attributes, images: [] }) as unknown as ItemInput;

  it('en 0 queda agotado; con pocas, "¡Quedan N!" sólo en la web (no en el PDF)', () => {
    const [none] = mapItems([row({ stock: 0 })], [], 'cafe', { locale: 'es-MX' });
    assert.equal(none.isAvailable, false);
    const [few] = mapItems([row({ stock: 3, diet: ['vegan', 'nada'] })], [], 'cafe', { locale: 'es-MX' });
    assert.deepEqual([few.isAvailable, few.stock, few.diet], [true, 3, []]); // una etiqueta inválida descarta la lista
    assert.ok(resolveBadges(few, DEFAULT_THEME, { lowStock: true }).some((b) => b.key === 'lowStock' && b.params?.count === 3));
    assert.ok(!resolveBadges(few, DEFAULT_THEME).some((b) => b.key === 'lowStock'));
    const [many] = mapItems([row({ stock: 50 })], [], 'cafe', { locale: 'es-MX' });
    assert.ok(!resolveBadges(many, DEFAULT_THEME, { lowStock: true }).some((b) => b.key === 'lowStock'));
  });

  it('el pedido conoce las existencias; el catálogo filtra por dieta', () => {
    const site = buildSampleSite();
    const beans = site.items.find((i) => i.name === 'Café en grano 340 g')!;
    assert.equal(orderConfig(site)!.stock[beans.id], 3);
    assert.deepEqual(filterItems(site.items, { ...EMPTY_FILTERS, diet: 'vegan' }).map((i) => i.name), ['Latte de avena', 'Pan de masa madre']);
  });

  it('el formulario guarda existencias (sólo en productos) y dieta', () => {
    const values = itemFormSchema.parse({ ...emptyItemValues('product', 'MXN'), name: 'Pan', stock: '12', diet: ['vegan', 'organic'] });
    assert.deepEqual([itemFormToAttributes(values).stock, itemFormToAttributes(values).diet], [12, ['vegan', 'organic']]);
    assert.equal(itemFormToAttributes({ ...values, stock: '' }).stock, null);
    assert.equal(itemFormToAttributes({ ...values, type: 'service' }).stock, null);
    assert.equal(itemFormSchema.safeParse({ ...emptyItemValues('product', 'MXN'), name: 'Pan', stock: '-1' }).success, false);
  });
});
