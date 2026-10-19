import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyItemValues } from '@/features/items/defaults';
import { itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { contactSchema, hoursText } from '@/lib/business/profile';
import { openingHoursSpecification, openStatus, scheduleRows, scheduleSchema, scheduleText, type Schedule } from '@/lib/business/schedule';
import { isSaleOver } from '@/lib/catalog/sale';
import { mapItems, type ItemInput } from '@/lib/catalog/view-model';

// Ciudad de México: UTC−6 todo el año. El 19 de octubre de 2026 es lunes.
const TZ = 'America/Mexico_City';
const at = (iso: string) => new Date(iso);
const range = (from: string, to: string) => ({ open: true, ranges: [{ from, to }] });
const closed = { open: false, ranges: [] };
const schedule = (days: Schedule['days']): Schedule => scheduleSchema.parse({ enabled: true, timezone: TZ, days });
const week = schedule([...Array.from({ length: 5 }, () => range('07:30', '20:00')), range('08:30', '18:00'), closed]);

describe('Horario por día', () => {
  it('viene apagado, con lunes a viernes 9–18, sábado 10–14 y domingo cerrado', () => {
    const value = contactSchema.parse({}).schedule;
    assert.equal(value.enabled, false);
    assert.equal(value.days.length, 7);
    assert.deepEqual(value.days[5], range('10:00', '14:00'));
    assert.equal(value.days[6].open, false);
    assert.equal(scheduleSchema.safeParse({ timezone: 'Luna/Base' }).success, false);
    assert.equal(scheduleSchema.safeParse({ days: [range('9:00', '18:00'), ...Array(6).fill(closed)] }).success, false);
  });

  it('abierto con la hora de cierre, o cerrado con cuándo abre (en la zona del negocio)', () => {
    assert.deepEqual(openStatus(week, at('2026-10-19T15:00:00Z')), { open: true, closesAt: '20:00' }); // lun 9:00
    assert.deepEqual(openStatus(week, at('2026-10-19T13:00:00Z')), { open: false, opensAt: { inDays: 0, day: 0, time: '07:30' } }); // lun 7:00
    assert.deepEqual(openStatus(week, at('2026-10-20T03:00:00Z')), { open: false, opensAt: { inDays: 1, day: 1, time: '07:30' } }); // lun 21:00
    // Sábado después de cerrar: el domingo no abre, así que abre el lunes (en 2 días).
    assert.deepEqual(openStatus(week, at('2026-10-25T01:00:00Z')), { open: false, opensAt: { inDays: 2, day: 0, time: '07:30' } });
  });

  it('turnos que cruzan la medianoche (también del domingo al lunes), 24/7 y sin días abiertos', () => {
    const night = schedule([closed, closed, closed, closed, range('18:00', '02:00'), closed, range('22:00', '03:00')]);
    assert.deepEqual(openStatus(night, at('2026-10-24T07:00:00Z')), { open: true, closesAt: '02:00' }); // sáb 1:00
    assert.deepEqual(openStatus(night, at('2026-10-19T07:00:00Z')), { open: true, closesAt: '03:00' }); // lun 1:00
    const always = schedule(Array.from({ length: 7 }, () => range('00:00', '00:00')));
    assert.deepEqual(openStatus(always, at('2026-10-21T12:00:00Z')), { open: true, closesAt: null });
    assert.deepEqual(openStatus(schedule(Array(7).fill(closed)), at('2026-10-21T12:00:00Z')), { open: false, opensAt: null });
  });

  it('agrupa días iguales para mostrarlos y genera los datos para buscadores', () => {
    assert.deepEqual(scheduleRows(week), [
      { from: 0, to: 4, ranges: ['7:30 – 20:00'] },
      { from: 5, to: 5, ranges: ['8:30 – 18:00'] },
      { from: 6, to: 6, ranges: [] },
    ]);
    const text = scheduleText(week, 'es-MX', 'Cerrado');
    assert.match(text, /^lun\.? – vie\.?: 7:30 – 20:00\nsáb\.?: 8:30 – 18:00\ndom\.?: Cerrado$/);
    assert.match(scheduleText(week, 'en-US', 'Closed'), /^Mon – Fri: 7:30 – 20:00/);
    const spec = openingHoursSpecification(week);
    assert.equal(spec.length, 6);
    assert.deepEqual(spec[0], { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '07:30', closes: '20:00' });

    const contact = contactSchema.parse({ hours: 'Festivos cerrado', schedule: week });
    assert.match(hoursText(contact, 'es-MX', 'Cerrado'), /dom\.?: Cerrado\nFestivos cerrado$/);
    assert.equal(hoursText({ ...contact, schedule: { ...week, enabled: false } }, 'es-MX', 'Cerrado'), 'Festivos cerrado');
  });
});

describe('Ofertas con fecha de fin', () => {
  const ends = { on: '2026-10-19', timeZone: TZ };

  it('la oferta dura hasta el final de ese día en la zona de quien la programó', () => {
    assert.equal(isSaleOver(null, at('2030-01-01T00:00:00Z')), false);
    assert.equal(isSaleOver(ends, at('2026-10-20T05:59:00Z')), false); // 19 oct, 23:59
    assert.equal(isSaleOver(ends, at('2026-10-20T06:00:00Z')), true); // 20 oct, 0:00
  });

  it('vencida, el sitio vuelve solo al precio normal; vigente, muestra hasta cuándo', () => {
    const row = { id: '11111111-1111-4111-8111-111111111111', slug: 'pan', type: 'product', name: 'Pan', short_description: null, description: null, price: 40, compare_at_price: 50, currency: 'MXN', price_note: null, sku: null, is_available: true, is_featured: false, is_visible: true, tags: [], category_id: null, position: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', attributes: { saleEnds: ends }, images: [] } as unknown as ItemInput;
    const [active] = mapItems([row], [], 'cafe', { locale: 'es-MX', now: at('2026-10-19T18:00:00Z') });
    assert.equal(active.compareAtPrice, 50);
    assert.equal(active.saleEndsOn, '2026-10-19');
    const [over] = mapItems([row], [], 'cafe', { locale: 'es-MX', now: at('2026-10-21T18:00:00Z') });
    assert.deepEqual([over.compareAtPrice, over.compareAtLabel, over.saleEndsOn, over.price], [null, null, null, 40]);
  });

  it('el formulario guarda la fecha sólo con precio anterior y una zona horaria válida', () => {
    const values = itemFormSchema.parse({ ...emptyItemValues('product', 'MXN'), name: 'Pan', price: '40', compareAtPrice: '50', saleEndsOn: '2026-10-31', saleTimeZone: TZ });
    assert.deepEqual(itemFormToAttributes(values).saleEnds, { on: '2026-10-31', timeZone: TZ });
    assert.equal(itemFormToAttributes({ ...values, compareAtPrice: '' }).saleEnds, null);
    assert.equal(itemFormToAttributes({ ...values, saleTimeZone: 'Luna/Base' }).saleEnds, null);
  });
});
