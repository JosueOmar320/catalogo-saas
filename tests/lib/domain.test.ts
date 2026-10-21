import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { internalAuthEmail, usernameSchema } from '@/lib/auth/username';
import { fillTemplate, resolveContactActions, type ContactContext } from '@/lib/contact/actions';
import { catalogSettingsSchema, parseCatalogSettings } from '@/lib/catalog/settings';
import { isWithinLimit, parseEntitlements } from '@/lib/plans/entitlements';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { BUSINESS_SLUG_PATTERN, slugify, slugifyLive, withRandomSuffix } from '@/lib/utils/slug';
import { collectMediaPaths, mediaUrl } from '@/lib/utils/storage';
import { priceText, priceToNumber } from '@/lib/utils/validation';

describe('Slugs', () => {
  it('quita acentos y símbolos', () => {
    assert.equal(slugify('Café & Té'), 'cafe-te');
    assert.equal(slugify('  ¡Ñandú Rojo!  '), 'nandu-rojo');
    assert.equal(slugify('🍕'), '');
  });
  it('respeta el largo sin dejar guion final', () => {
    const slug = slugify(`${'a'.repeat(47)} b`);
    assert.ok(slug.length <= 48);
    assert.ok(!slug.endsWith('-'));
  });
  it('slugifyLive conserva el guion final mientras se escribe', () => {
    assert.equal(slugifyLive('mi negocio '), 'mi-negocio-');
  });
  it('withRandomSuffix siempre produce un slug válido (regresión: "--" y sufijos cortos)', (t) => {
    t.mock.method(Math, 'random', () => 0.5); // "0.i": antes daba un sufijo de 1 letra
    const base = `${'a'.repeat(42)}-xyz`; // el corte en 43 cae justo en el guion
    const slug = withRandomSuffix(base);
    assert.match(slug, BUSINESS_SLUG_PATTERN);
    assert.ok(!slug.includes('--'), slug);
    assert.equal(slug.split('-').at(-1)!.length, 4);
  });
});

describe('Precios', () => {
  it('acepta enteros, punto o coma con hasta 2 decimales, o vacío', () => {
    for (const v of ['', '120', '99.90', '99,9', ' 15 ']) assert.equal(priceText.safeParse(v).success, true, v);
  });
  it('rechaza más de 2 decimales, letras o negativos', () => {
    for (const v of ['1.999', 'abc', '-5', '1e3']) assert.equal(priceText.safeParse(v).success, false, v);
  });
  it('convierte a número (coma decimal) y vacío a null', () => {
    assert.equal(priceToNumber('99,90'), 99.9);
    assert.equal(priceToNumber('  '), null);
  });
});

describe('Usuarios', () => {
  it('normaliza a minúsculas y valida el patrón', () => {
    assert.equal(usernameSchema.parse('  Maria.Lopez '), 'maria.lopez');
    for (const bad of ['ab', '-maria', 'maría', 'a'.repeat(33), 'con espacio']) assert.equal(usernameSchema.safeParse(bad).success, false, bad);
  });
  it('email interno no entregable (dominio .invalid por defecto, sin "@" duplicado)', (t) => {
    const original = process.env.AUTH_USERNAME_DOMAIN;
    t.after(() => {
      if (original === undefined) delete process.env.AUTH_USERNAME_DOMAIN;
      else process.env.AUTH_USERNAME_DOMAIN = original;
    });
    delete process.env.AUTH_USERNAME_DOMAIN;
    assert.equal(internalAuthEmail('maria'), 'maria@usuarios.invalid');
    process.env.AUTH_USERNAME_DOMAIN = '@cuentas.invalid';
    assert.equal(internalAuthEmail('maria'), 'maria@cuentas.invalid');
  });
});

describe('Planes', () => {
  it('lee límites y usa valores por defecto si el JSON es inválido', () => {
    const ok = parseEntitlements({ id: 'pro', name: 'Pro', limits: { max_items: 500, max_catalogs: null }, features: { pdf_export: true } });
    assert.equal(ok.limits.max_items, 500);
    assert.equal(ok.limits.max_catalogs, null);
    const broken = parseEntitlements({ id: 'x', name: 'X', limits: { max_items: 'muchos' }, features: null });
    assert.equal(broken.limits.max_items, 50);
    assert.equal(broken.features.remove_branding, false);
  });
  it('null es ilimitado y el límite es exclusivo', () => {
    assert.equal(isWithinLimit(null, 10_000), true);
    assert.equal(isWithinLimit(50, 49), true);
    assert.equal(isWithinLimit(50, 50), false);
  });
});

describe('Acciones de contacto', () => {
  const base: ContactContext = {
    businessName: 'Café Aurora',
    contact: { whatsapp: '+52 55 1234 5678', phone: '', email: 'hola@aurora.mx' } as ContactContext['contact'],
    catalogUrl: 'https://vitrina.app/catalogo/aurora',
  };
  it('rellena variables, conserva las desconocidas y limpia paréntesis vacíos', () => {
    assert.equal(fillTemplate('Hola, quiero {producto} ({precio}) {otra}', base), 'Hola, quiero Café Aurora {otra}');
    const withItem = { ...base, item: { name: 'Latte', priceLabel: '$45', sku: 'L-1', url: 'https://x/p/latte' } };
    assert.equal(fillTemplate('{producto} ({precio}) {sku} {url}', withItem), 'Latte ($45) L-1 https://x/p/latte');
  });
  it('sólo devuelve acciones habilitadas con datos, y codifica el mensaje', () => {
    const config = catalogSettingsSchema.parse({}).contactActions;
    const actions = resolveContactActions(config, base);
    const whatsapp = actions.find((a) => a.type === 'whatsapp');
    assert.ok(whatsapp?.href.startsWith('https://wa.me/525512345678?text='));
    assert.ok(!whatsapp!.href.includes(' '));
    const noWhatsapp = resolveContactActions(config, { ...base, contact: { ...base.contact, whatsapp: '' } });
    assert.equal(noWhatsapp.some((a) => a.type === 'whatsapp'), false);
  });
});

describe('Configuración del catálogo', () => {
  it('un campo corrupto no borra el resto: cada sección (y cada campo de la sección) cae a su valor por defecto por separado', () => {
    const settings = parseCatalogSettings({
      currency: 'MXN',
      language: 'en',
      order: { enabled: true, paused: true, coupons: [{ code: 'x', value: 'abc' }] },
      pdf: { layout: 'list', paperSize: 'oficio' },
    });
    assert.equal(settings.currency, 'MXN');
    assert.equal(settings.language, 'en');
    assert.equal(settings.order.enabled, true, 'los pedidos siguen activos aunque un cupón esté mal guardado');
    assert.equal(settings.order.paused, true);
    assert.deepEqual(settings.order.coupons, []);
    assert.equal(settings.pdf.layout, 'list');
    assert.equal(settings.pdf.paperSize, 'A4');
    // Una sección entera corrupta vuelve a su valor por defecto sin afectar a las demás.
    const broken = parseCatalogSettings({ currency: 'EUR', order: 'no' });
    assert.equal(broken.currency, 'EUR');
    assert.equal(broken.order.enabled, false);
    assert.deepEqual(parseCatalogSettings(null), catalogSettingsSchema.parse({}));
    assert.deepEqual(parseCatalogSettings('basura'), catalogSettingsSchema.parse({}));
  });
});

describe('Medios', () => {
  it('encuentra rutas en JSON anidado (path, photo, imagePath, ogImagePath)', () => {
    const paths = collectMediaPaths({ hero: { image: { path: 'a/media/1.webp' } }, team: [{ photo: 'a/media/2.webp' }], seo: { ogImagePath: 'a/og/3.png' }, title: 'path' });
    assert.deepEqual(paths.sort(), ['a/media/1.webp', 'a/media/2.webp', 'a/og/3.png']);
  });
  it('mediaUrl deja pasar URLs externas tal cual', () => {
    assert.equal(mediaUrl('https://images.unsplash.com/x.jpg'), 'https://images.unsplash.com/x.jpg');
    assert.equal(mediaUrl(null), null);
  });
});

describe('Paginación (PostgREST corta en 1000 filas)', () => {
  it('pide páginas hasta recibir una incompleta', async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAllRows(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    });
    assert.equal(rows.length, 2500);
    assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('propaga el error de una página', async () => {
    await assert.rejects(fetchAllRows(async () => ({ data: null, error: new Error('boom') })), /boom/);
  });
});
