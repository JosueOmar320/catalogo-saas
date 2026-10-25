import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dnsRecordFor, isApexDomain, isPlatformHost, normalizeDomain, registrableDomain, relativeName, wwwCounterpart } from '@/lib/domains/domain';
import { catalogUrl, itemUrl } from '@/lib/catalog/view-model';
import { catalogSitemapEntries } from '@/lib/catalog/sitemap';

const PLATFORM = ['catalogo-saas-nu.vercel.app', 'vitrina.app'];

describe('Dominio propio', () => {
  it('normaliza lo que escribe el negocio', () => {
    assert.equal(normalizeDomain('https://www.MiTienda.com/menu?x=1'), 'www.mitienda.com');
    assert.equal(normalizeDomain('  mitienda.com.mx.  '), 'mitienda.com.mx');
    assert.equal(normalizeDomain('tienda.mitienda.com:443'), 'tienda.mitienda.com');
    assert.equal(normalizeDomain('panadería.mx'), 'xn--panadera-i2a.mx');
  });

  it('rechaza lo que no es un dominio o es de la plataforma', () => {
    for (const bad of ['', 'mitienda', 'localhost', '192.168.0.1', 'mi tienda.com', 'a_b.com', '-x.com', 'x.c', 'demo.vercel.app', 'vitrina.app', 'www.vitrina.app']) {
      assert.equal(normalizeDomain(bad, PLATFORM), null, bad);
    }
  });

  it('reconoce los hosts de la plataforma', () => {
    for (const host of ['localhost', 'localhost:3000', 'app.localhost', '127.0.0.1', '[::1]', 'catalogo-saas-nu.vercel.app', 'rama-x.vercel.app', 'vitrina.app', 'WWW.vitrina.app']) {
      assert.ok(isPlatformHost(host, PLATFORM), host);
    }
    for (const host of ['mitienda.com', 'www.mitienda.com', 'vitrina.app.mitienda.com']) assert.ok(!isPlatformHost(host, PLATFORM), host);
  });

  it('distingue la raíz de un subdominio (también con terminaciones como .com.mx)', () => {
    assert.equal(registrableDomain('tienda.mitienda.com.mx'), 'mitienda.com.mx');
    assert.equal(registrableDomain('www.mitienda.com'), 'mitienda.com');
    assert.ok(isApexDomain('mitienda.com.mx'));
    assert.ok(!isApexDomain('www.mitienda.com'));
  });

  it('la otra forma (con o sin www) redirige a la elegida; otros subdominios no tienen', () => {
    assert.deepEqual(wwwCounterpart('mitienda.com'), { name: 'www.mitienda.com', redirectTo: 'mitienda.com' });
    assert.deepEqual(wwwCounterpart('www.mitienda.com.mx'), { name: 'mitienda.com.mx', redirectTo: 'www.mitienda.com.mx' });
    assert.equal(wwwCounterpart('tienda.mitienda.com'), null);
  });

  it('el registro DNS: A en la raíz, CNAME en un subdominio', () => {
    assert.deepEqual(dnsRecordFor('mitienda.com'), { type: 'A', name: '@', value: '76.76.21.21' });
    assert.deepEqual(dnsRecordFor('www.mitienda.com'), { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' });
    assert.deepEqual(dnsRecordFor('menu.tienda.mitienda.com.mx', { cname: 'x.vercel-dns-017.com' }), { type: 'CNAME', name: 'menu.tienda', value: 'x.vercel-dns-017.com' });
    assert.equal(relativeName('_vercel.mitienda.com', 'www.mitienda.com'), '_vercel');
    assert.equal(relativeName('mitienda.com', 'mitienda.com'), '@');
  });

  it('con dominio activo, los enlaces públicos y el sitemap lo usan', () => {
    assert.equal(catalogUrl('cafe', 'mitienda.com'), 'https://mitienda.com');
    assert.match(catalogUrl('cafe'), /\/catalogo\/cafe$/);
    assert.equal(itemUrl('cafe', 'latte', 'mitienda.com'), 'https://mitienda.com/p/latte');
    const urls = catalogSitemapEntries({
      businesses: [{ id: 'b1', slug: 'cafe', domain: 'mitienda.com' }, { id: 'b2', slug: 'pan' }],
      catalogs: [{ id: 'c1', business_id: 'b1', seo: {}, updated_at: '2026-10-01' }, { id: 'c2', business_id: 'b2', seo: {}, updated_at: '2026-10-01' }],
      pages: [{ catalog_id: 'c1', slug: 'menu', is_home: false, seo: {}, updated_at: '2026-10-01' }],
      items: [{ catalog_id: 'c1', slug: 'latte', updated_at: '2026-10-01' }],
    }).map((e) => e.url);
    assert.ok(urls.includes('https://mitienda.com') && urls.includes('https://mitienda.com/menu') && urls.includes('https://mitienda.com/p/latte'));
    assert.ok(urls.some((u) => u.endsWith('/catalogo/pan')));
    assert.ok(!urls.some((u) => u.includes('/catalogo/cafe')));
  });
});
