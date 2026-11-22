import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSiteViewModel, type SiteInput } from '@/lib/site/view-model';
import { orderConfig } from '@/site-renderer/order/config';

/** Sitio mínimo con pedidos, bandeja y teléfono activados. */
const input = (): SiteInput => ({
  business: { name: 'Café', slug: 'cafe', description: null, slogan: null, logo_path: null, contact: { whatsapp: '+52 55 1234 5678' }, social_links: {} },
  catalog: { theme: {}, settings: { order: { enabled: true, inbox: true, askPhone: true } }, seo: {}, cover_path: null, favicon_path: null, published_at: null },
  categories: [],
  items: [],
  pages: [],
  removeBranding: false,
});

describe('Función «Pedidos y clientes» apagada por el administrador', () => {
  it('por defecto (o encendida) la bandeja y el teléfono siguen la configuración', () => {
    for (const site of [buildSiteViewModel(input(), { public: true }), buildSiteViewModel({ ...input(), ordersEnabled: true }, { public: true })]) {
      assert.equal(site.settings.order.enabled, true);
      assert.equal(site.settings.order.inbox, true);
      assert.equal(site.settings.order.askPhone, true);
      const config = orderConfig(site, { track: true });
      assert.equal(config?.inbox, true);
      assert.equal(config?.askPhone, true);
    }
  });

  it('apagada: los pedidos por WhatsApp siguen, pero sin copia en la bandeja ni teléfono', () => {
    const site = buildSiteViewModel({ ...input(), ordersEnabled: false }, { public: true });
    assert.equal(site.settings.order.enabled, true);
    assert.equal(site.settings.order.inbox, false);
    assert.equal(site.settings.order.askPhone, false);
    const config = orderConfig(site, { track: true });
    assert.notEqual(config, null);
    assert.equal(config?.inbox, false);
    assert.equal(config?.askPhone, false);
  });
});
