import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isShortMapsUrl, mapEmbedSrc, mapsLocationFromUrl } from '@/lib/business/maps';
import { resolveMapsLocation } from '@/lib/business/maps-server';

const FULL = 'https://www.google.com/maps/place/Serrano+boutique/@12.12377,-86.2583,17z/data=!3m1!4b1!4m6!3m5!1s0x8f73ffbd7497c27f:0x1a02f8c8ac7d110b!8m2!3d12.12377!4d-86.2583!16s%2Fg%2F11y7jpm3x8?entry=tts';

describe('Mapa de Google (sin clave)', () => {
  it('lee el pin, la búsqueda, la vista o el nombre del lugar', () => {
    assert.equal(mapsLocationFromUrl(FULL), '12.12377,-86.2583');
    assert.equal(mapsLocationFromUrl('https://www.google.com/maps?q=Parque+Central,+Managua'), 'Parque Central, Managua');
    assert.equal(mapsLocationFromUrl('https://www.google.com/maps/@19.4326,-99.1332,15z'), '19.4326,-99.1332');
    assert.equal(mapsLocationFromUrl('https://www.google.com/maps/place/Caf%C3%A9+Aurora/'), 'Café Aurora');
    assert.equal(mapsLocationFromUrl('https://evil.example.com/maps/@1,2'), null);
    assert.ok(isShortMapsUrl('https://maps.app.goo.gl/Qn1kvpdze9KajhaJ8'));
  });

  it('el iframe usa la ubicación del enlace y, si no hay, la dirección', () => {
    assert.equal(mapEmbedSrc({ mapsLocation: '12.12377,-86.2583' }), 'https://www.google.com/maps?q=12.12377%2C-86.2583&z=16&output=embed');
    assert.match(mapEmbedSrc({ mapsUrl: 'https://maps.app.goo.gl/x', address: 'Calle 1', city: 'León' })!, /q=Calle%201%2C%20Le%C3%B3n/);
    assert.equal(mapEmbedSrc({}), null);
  });

  it('sigue el enlace corto sólo hacia Google', async () => {
    const redirect = (to: string) => (async () => new Response(null, { status: 302, headers: { location: to } })) as typeof fetch;
    assert.equal(await resolveMapsLocation('https://maps.app.goo.gl/Qn1kvpdze9KajhaJ8', redirect(FULL)), '12.12377,-86.2583');
    assert.equal(await resolveMapsLocation('https://maps.app.goo.gl/abc', redirect('http://169.254.169.254/latest')), null);
    assert.equal(await resolveMapsLocation('https://maps.app.goo.gl/abc', (async () => { throw new Error('offline'); }) as typeof fetch), null);
    assert.equal(await resolveMapsLocation(FULL, (async () => { throw new Error('no debe llamar'); }) as typeof fetch), '12.12377,-86.2583');
  });
});
