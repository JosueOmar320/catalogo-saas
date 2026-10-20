import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyItemValues } from '@/features/items/defaults';
import { itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { contactSchema, hoursText } from '@/lib/business/profile';
import { openingHoursSpecification, openStatus, pickupSlots, scheduleRows, scheduleSchema, scheduleText, specialDaysText, specialOpeningHoursSpecification, type Schedule } from '@/lib/business/schedule';
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

describe('Días especiales del horario', () => {
  // Miércoles 21 cerrado por inventario; el domingo 25 (normalmente cerrado) abre de 10 a 14.
  const special = scheduleSchema.parse({
    ...week,
    special: [
      { date: '2026-10-25', open: true, ranges: [{ from: '10:00', to: '14:00' }], note: 'Feria del café' },
      { date: '2026-10-21', open: false, note: 'Inventario' },
    ],
  });

  it('reemplazan el horario de la semana en esa fecha: abierto, cerrado y cuándo abre', () => {
    assert.deepEqual(openStatus(special, at('2026-10-21T18:00:00Z')), { open: false, opensAt: { inDays: 1, day: 3, time: '07:30' } }); // mié 12:00
    assert.deepEqual(openStatus(special, at('2026-10-21T03:00:00Z')), { open: false, opensAt: { inDays: 2, day: 3, time: '07:30' } }); // mar 21:00
    assert.deepEqual(openStatus(special, at('2026-10-25T01:00:00Z')), { open: false, opensAt: { inDays: 1, day: 6, time: '10:00' } }); // sáb 19:00
    assert.deepEqual(openStatus(special, at('2026-10-25T17:00:00Z')), { open: true, closesAt: '14:00' }); // dom 11:00
    assert.deepEqual(openStatus(week, at('2026-10-21T18:00:00Z')), { open: true, closesAt: '20:00' }); // sin días especiales
  });

  it('los horarios para pedir respetan los días especiales', () => {
    const days = pickupSlots(special, at('2026-10-19T15:00:00Z'), { leadMinutes: 0, days: 7, step: 60 });
    assert.deepEqual(days.map((d) => d.date), ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    assert.deepEqual(days.at(-1)!.slots, ['10:00', '11:00', '12:00', '13:00']);
  });

  it('se muestran los próximos (no los pasados) y van a los datos para buscadores', () => {
    const lines = specialDaysText(special, 'es-MX', 'Cerrado', at('2026-10-19T15:00:00Z')).split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^mié\.?,? 21 (de )?oct\.?: Cerrado · Inventario$/);
    assert.match(lines[1], /^dom\.?,? 25 (de )?oct\.?: 10:00 – 14:00 · Feria del café$/);
    assert.equal(specialDaysText(special, 'es-MX', 'Cerrado', at('2026-10-23T15:00:00Z')).split('\n').length, 1);
    assert.equal(specialDaysText(week, 'es-MX', 'Cerrado', at('2026-10-19T15:00:00Z')), '');
    const contact = contactSchema.parse({ schedule: special });
    assert.match(hoursText(contact, 'es-MX', 'Cerrado', at('2026-10-19T15:00:00Z')), /dom\.?: Cerrado\nmié.*Inventario\ndom.*Feria del café$/);

    assert.deepEqual(specialOpeningHoursSpecification(special, at('2026-10-19T15:00:00Z')), [
      { '@type': 'OpeningHoursSpecification', opens: '00:00', closes: '00:00', validFrom: '2026-10-21', validThrough: '2026-10-21' },
      { '@type': 'OpeningHoursSpecification', opens: '10:00', closes: '14:00', validFrom: '2026-10-25', validThrough: '2026-10-25' },
    ]);
  });

  it('no acepta dos días especiales con la misma fecha ni fechas inválidas', () => {
    assert.equal(scheduleSchema.safeParse({ special: [{ date: '2026-12-24' }, { date: '2026-12-24', open: true }] }).success, false);
    assert.equal(scheduleSchema.safeParse({ special: [{ date: '24/12/2026' }] }).success, false);
    assert.deepEqual(scheduleSchema.parse({ special: [{ date: '2026-12-24' }] }).special, [{ date: '2026-12-24', open: false, ranges: [], note: '' }]);
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
