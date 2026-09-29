import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { imageSize, runTool, safeDownload, type ToolContext } from '@/features/assistant/server/tools';
import type { ServerSupabase } from '@/lib/supabase/server';

const BIZ = '11111111-2222-4333-8444-555555555555';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x08, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0xff, 0xd9]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x04, 0x00, 0, 0, 0x03, 0x00, 8, 2, 0, 0, 0]);

/** Supabase mínimo: registra subidas e inserciones. */
function fakeSupabase() {
  const uploads: string[] = [];
  const inserts: Record<string, unknown>[] = [];
  const supabase = {
    storage: { from: () => ({ upload: async (path: string) => (uploads.push(path), { error: null }), remove: async () => ({ error: null }) }) },
    from: () => ({ insert: async (row: Record<string, unknown>) => (inserts.push(row), { error: null }) }),
  } as unknown as ServerSupabase;
  return { supabase, uploads, inserts };
}

function context(overrides: Partial<ToolContext> = {}): ToolContext {
  return { supabase: fakeSupabase().supabase, businessId: BIZ, catalogId: 'c', userText: '', stock: new Map(), media: new Set(), ...overrides };
}

const imageResponse = (bytes: Uint8Array, headers: Record<string, string> = {}) => new Response(bytes.slice().buffer, { status: 200, headers: { 'content-type': 'image/jpeg', ...headers } });

describe('Garfield AI · herramientas de servidor', () => {
  it('lee ancho y alto de PNG y JPEG sin librerías', () => {
    assert.deepEqual(imageSize(PNG), { width: 1024, height: 768 });
    assert.deepEqual(imageSize(JPEG), { width: 800, height: 600 });
  });

  it('descarga segura: rechaza http, IPs privadas y archivos que no son imágenes', async () => {
    const fetchOk = (async () => imageResponse(JPEG)) as typeof fetch;
    await assert.rejects(safeDownload('http://93.184.216.34/a.jpg', fetchOk), /https/);
    await assert.rejects(safeDownload('https://127.0.0.1/a.jpg', fetchOk), /no está permitida/);
    await assert.rejects(safeDownload('https://10.1.2.3/a.jpg', fetchOk), /no está permitida/);
    await assert.rejects(safeDownload('https://[::1]/a.jpg', fetchOk), /no está permitida/);
    await assert.rejects(safeDownload('https://93.184.216.34/a.jpg', (async () => new Response('<html>', { status: 200 })) as typeof fetch), /no es una imagen/);
    await assert.rejects(safeDownload('https://93.184.216.34/a.jpg', (async () => imageResponse(JPEG, { 'content-length': String(9 * 1024 * 1024) })) as typeof fetch), /5 MB/);
    const ok = await safeDownload('https://93.184.216.34/a.jpg', fetchOk);
    assert.equal(ok.mime, 'image/jpeg');
  });

  it('descarga segura: una redirección hacia la red interna se bloquea', async () => {
    const redirect = (async () => new Response(null, { status: 302, headers: { location: 'https://192.168.1.10/secret.jpg' } })) as typeof fetch;
    await assert.rejects(safeDownload('https://93.184.216.34/a.jpg', redirect), /no está permitida/);
  });

  it('import_image sólo acepta URLs que el usuario escribió o refs de búsqueda', async () => {
    const r1 = await runTool('import_image', { url: 'https://93.184.216.34/x.jpg', alt: 'Foto' }, context({ userText: 'hola' }));
    assert.equal(r1.ok, false);
    assert.match(!r1.ok ? r1.error : '', /usuario escribió/);
    const r2 = await runTool('import_image', { ref: 'stock-inventado', alt: 'Foto' }, context());
    assert.equal(r2.ok, false);
    const r3 = await runTool('import_image', { alt: 'x' }, context());
    assert.equal(r3.ok, false);
  });

  it('valida parámetros y rechaza herramientas desconocidas', async () => {
    assert.equal((await runTool('drop_table', {}, context())).ok, false);
    assert.equal((await runTool('search_stock_images', { query: 'x' }, context())).ok, false);
  });

  it('buscar en el banco libre → importar a la biblioteca del negocio', async () => {
    const { supabase, uploads, inserts } = fakeSupabase();
    const calls: string[] = [];
    const fetchMock = (async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith('https://api.openverse.org/')) {
        return Response.json({
          results: [
            { id: 'abcdef123456789', title: 'Restaurant interior', url: 'https://cdn.stocksnap.io/img-thumbs/960w/ABC.jpg', filetype: 'jpg', license: 'cc0', provider: 'stocksnap', creator: 'Ana', width: 960, height: 640 },
            { id: 'zzz', title: 'Evil', url: 'https://evil.example.com/x.jpg', filetype: 'jpg', license: 'cc0', provider: 'x' },
          ],
        });
      }
      return imageResponse(JPEG);
    }) as typeof fetch;
    const ctx = context({ supabase, fetch: fetchMock });
    const search = await runTool('search_stock_images', { query: 'restaurant interior', orientation: 'landscape' }, ctx);
    assert.ok(search.ok);
    const results = (search.ok ? search.result : null) as { results: { ref: string }[] };
    assert.equal(results.results.length, 1, 'hosts fuera de la lista permitida se descartan');
    assert.match(calls[0], /license=cc0%2Cpdm/);

    // DNS del CDN simulado con una IP pública: se reemplaza la URL por una IP literal en el caché.
    const stock = ctx.stock.get(results.results[0].ref)!;
    ctx.stock.set(stock.ref, { ...stock, url: 'https://93.184.216.34/ABC.jpg' });
    const imported = await runTool('import_image', { ref: stock.ref, alt: 'Salón del restaurante', use: 'section' }, ctx);
    assert.ok(imported.ok, !imported.ok ? imported.error : '');
    const path = (imported.ok ? imported.result : null) as { path: string };
    assert.match(path.path, new RegExp(`^${BIZ}/site/[0-9a-f-]+\\.jpg$`));
    assert.deepEqual(uploads, [path.path]);
    assert.equal(inserts[0].source, 'stock');
    assert.equal(inserts[0].width, 800);
    assert.match(String(inserts[0].attribution), /CC0 vía stocksnap/);
    assert.ok(ctx.media.has(path.path));
  });
});
