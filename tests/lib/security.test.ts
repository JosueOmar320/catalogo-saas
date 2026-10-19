import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { safeNextPath } from '@/lib/auth/redirect';
import { assertPublicHttpsUrl, isPrivateAddress, safeDownload, SafeFetchError } from '@/lib/net/safe-fetch';
import { isPathOwnedBy } from '@/lib/utils/storage';

describe('SSRF: isPrivateAddress', () => {
  const blocked = [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.18.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fd00::1', 'fe80::1', 'fe80::1%eth0', 'ff02::1', '2001:db8::1',
    // Regresión: IPv4 escondida dentro de IPv6 (el parser de URL la normaliza a hex).
    '::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '::7f00:1', '2002:7f00:1::', '64:ff9b::a9fe:a9fe',
    // Teredo esconde una IPv4: se bloquea entero.
    '2001:0:4136:e378::1',
    'no-es-una-ip',
  ];
  const allowed = ['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:808:808'];

  for (const address of blocked) it(`bloquea ${address}`, () => assert.equal(isPrivateAddress(address), true));
  for (const address of allowed) it(`permite ${address}`, () => assert.equal(isPrivateAddress(address), false));
});

describe('SSRF: assertPublicHttpsUrl', () => {
  it('acepta https público', () => {
    assert.equal(assertPublicHttpsUrl('https://images.unsplash.com/photo.jpg').hostname, 'images.unsplash.com');
  });

  for (const url of [
    'http://example.com/a.jpg',
    'ftp://example.com/a.jpg',
    'https://user:pass@example.com/a.jpg',
    'https://example.com:8443/a.jpg',
    'https://localhost/a.jpg',
    'https://db.internal/a.jpg',
    'https://printer.local/a.jpg',
    'https://127.1/',
    'https://0x7f000001/',
    'https://2130706433/',
    'https://[::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::ffff:a9fe:a9fe]/',
    'no es una url',
  ]) {
    it(`rechaza ${url}`, () => assert.throws(() => assertPublicHttpsUrl(url), SafeFetchError));
  }

  it('re-verifica cada redirección (no sigue a una IP privada)', async () => {
    const fakeFetch = (async () => new Response(null, { status: 302, headers: { location: 'https://[::ffff:7f00:1]/secret' } })) as typeof fetch;
    await assert.rejects(safeDownload('https://example.com/a.jpg', fakeFetch), SafeFetchError);
  });
});

describe('Open redirect: safeNextPath', () => {
  for (const next of ['/dashboard', '/dashboard?tab=media', '/admin/usuarios#lista', '/dashboard/%5Cfoo']) {
    it(`acepta ${next}`, () => assert.equal(safeNextPath(next), next));
  }
  for (const next of ['//evil.com', '/\\evil.com', '/\\/evil.com', '/\t/evil.com', '/\n/evil.com', 'https://evil.com', 'javascript:alert(1)', 'dashboard', '', null, undefined]) {
    it(`rechaza ${JSON.stringify(next)}`, () => assert.equal(safeNextPath(next), null));
  }
});

describe('Storage: isPathOwnedBy', () => {
  const biz = '11111111-1111-4111-8111-111111111111';
  it('acepta rutas del negocio en carpetas conocidas', () => {
    assert.equal(isPathOwnedBy(`${biz}/media/foto.webp`, biz), true);
    assert.equal(isPathOwnedBy(`${biz}/logo/logo.png`, biz, 'logo'), true);
  });
  it('rechaza otro negocio, carpeta desconocida, sin archivo o con ..', () => {
    assert.equal(isPathOwnedBy(`22222222-2222-4222-8222-222222222222/media/foto.webp`, biz), false);
    assert.equal(isPathOwnedBy(`${biz}/secret/foto.webp`, biz), false);
    assert.equal(isPathOwnedBy(`${biz}/media`, biz), false);
    assert.equal(isPathOwnedBy(`${biz}/media/../../otro/foto.webp`, biz), false);
    assert.equal(isPathOwnedBy(`${biz}/media/foto.webp`, biz, 'logo'), false);
  });
});
