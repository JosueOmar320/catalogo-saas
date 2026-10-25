import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { areasFor, matchAreas } from '@/lib/assistant/panel-guide';
import { parseEntitlements } from '@/lib/plans/entitlements';
import { ALL_FEATURES, BUSINESS_FEATURES, effectiveFeatures, parseFeatureOverrides } from '@/lib/plans/features';

const free = parseEntitlements({ id: 'free', name: 'Gratis', limits: {}, features: { pdf_export: true } }).features;
const noPdf = parseEntitlements({ id: 'x', name: 'Sin PDF', limits: {}, features: { pdf_export: false } }).features;

describe('Funciones por negocio', () => {
  it('sin decisión del administrador, todo encendido (el PDF, según el plan)', () => {
    assert.deepEqual(effectiveFeatures({}, free), ALL_FEATURES);
    assert.equal(effectiveFeatures({}, noPdf).pdf_export, false);
  });

  it('lo decidido para el negocio gana sobre el plan, en los dos sentidos', () => {
    const off = effectiveFeatures({ assistant: false, orders: false }, free);
    assert.equal(off.assistant, false);
    assert.equal(off.orders, false);
    assert.equal(off.analytics, true);
    assert.equal(effectiveFeatures({ pdf_export: true }, noPdf).pdf_export, true);
  });

  it('sólo lee claves conocidas con valor sí/no', () => {
    assert.deepEqual(parseFeatureOverrides({ assistant: false, teleport: false, pdf_export: 'no', import: true }), { assistant: false, import: true });
    assert.deepEqual(parseFeatureOverrides(null), {});
    assert.deepEqual(parseFeatureOverrides([false]), {});
    assert.deepEqual([...BUSINESS_FEATURES], ['assistant', 'pdf_export', 'orders', 'analytics', 'import']);
  });

  it('la ayuda de Garfield no lleva a lo apagado (el menú lo prueba la E2E)', () => {
    const features = effectiveFeatures({ orders: false, analytics: false, pdf_export: false }, free);
    const ids = areasFor(false, true, features).map((a) => a.id);
    assert.ok(!ids.includes('pdf') && !ids.includes('orders') && !ids.includes('analytics') && !ids.includes('customers'));
    assert.ok(ids.includes('settings_orders'), 'la configuración de pedidos por WhatsApp sigue');
    assert.equal(matchAreas('¿cómo descargo el catálogo en pdf?', false, 3, true, features).some((a) => a.id === 'pdf'), false);
    assert.equal(matchAreas('¿cómo descargo el catálogo en pdf?')[0].id, 'pdf');
  });
});
