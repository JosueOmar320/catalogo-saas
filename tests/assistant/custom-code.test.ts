import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planAssistantActions } from '@/features/assistant/executor';
import { OpenAICompatibleModel } from '@/features/assistant/server/openai-compatible';
import { HTML_GUIDE, jsonSystemPrompt, PERSONA } from '@/features/assistant/server/prompt';
import { resolveMediaQueries } from '@/features/assistant/server/resolve-media';
import type { BuilderState } from '@/features/builder/reducer';
import type { MediaRecord } from '@/features/media/schema';
import { parseActions, type AssistantAction } from '@/lib/assistant/actions';
import { buildAssistantContext } from '@/lib/assistant/context';
import { measurePages, pageCritique } from '@/lib/assistant/critique';
import { cleanCustomHtmlSource } from '@/lib/site/custom-code';
import { pageSchema } from '@/lib/site/pages';
import { buildSampleSite } from '@/lib/site/sample-site';

const BIZ = '11111111-2222-4333-8444-555555555555';
const site = buildSampleSite();

function state(selectedSectionId: string | null = null): BuilderState {
  const home = site.pages.find((p) => p.isHome)!;
  return { theme: site.theme, navigation: site.navigation, pages: site.pages, persistedPageIds: site.pages.map((p) => p.id), deletedPageIds: [], selectedPageId: home.id, selectedSectionId, editingPageSettings: false, panel: 'pages', dirty: { theme: false, navigation: false, pages: false } };
}
const actions = (list: unknown[]): AssistantAction[] => {
  const { actions: parsed, errors } = parseActions(list);
  assert.deepEqual(errors, []);
  return parsed;
};
const html = '<div class="pl"><article class="pl-card fx-fade-up"><h3>Calidad</h3><p>Revisamos cada pieza.</p></article></div><style>.pl{display:grid}</style>';

describe('Garfield con código propio (sección HTML)', () => {
  it('puede proponer secciones html (no widgets con scripts)', () => {
    assert.equal(parseActions([{ action: 'create_section', section: { type: 'html', content: { html } } }]).errors.length, 0);
    assert.ok(parseActions([{ action: 'create_section', section: { type: 'embed', content: { code: '<script></script>' } } }]).errors.length > 0);
  });

  it('sólo con código propio habilitado; el HTML queda en el borrador y se limpia al guardar', () => {
    const list = actions([{ action: 'create_section', section: { type: 'html', content: { html: `${html}<script>alert(1)</script>` } } }]);
    const off = planAssistantActions(state(), list, { customCode: false });
    assert.equal(off.steps[0].status, 'error');
    assert.match(off.steps[0].error ?? '', /código propio no está habilitado/);

    const on = planAssistantActions(state(), list, { customCode: true });
    assert.equal(on.steps[0].status, 'ok');
    const created = on.next.pages.flatMap((p) => p.sections).find((s) => s.type === 'html')!;
    assert.ok(pageSchema.safeParse(on.next.pages.find((p) => p.sections.includes(created))).success);
    assert.doesNotMatch(cleanCustomHtmlSource((created.content as { html: string }).html), /script/);
  });

  it('el contexto dice si hay código propio y trae el HTML completo de la sección html seleccionada', () => {
    const withHtml = { ...site, customCode: true, pages: site.pages.map((p) => (p.isHome ? { ...p, sections: [...p.sections, { ...p.sections[0], id: 'html-1', type: 'html', content: { html } } as never] } : p)) };
    const context = buildAssistantContext({ site: withHtml, pages: withHtml.pages, theme: site.theme, navigation: site.navigation, panel: 'pages', currentPageId: site.pages[0].id, selectedSectionId: 'html-1', lastSectionIds: [] });
    assert.equal(context.customCode, true);
    assert.equal(context.selectedHtml, html);
    const plain = buildAssistantContext({ site, pages: site.pages, theme: site.theme, navigation: site.navigation, panel: 'pages', currentPageId: site.pages[0].id, selectedSectionId: null, lastSectionIds: [] });
    assert.equal(plain.customCode, false);
    assert.equal(plain.selectedHtml, undefined);
  });

  it('las imágenes del HTML se piden por descripción (media:…) y el servidor pone rutas reales; sin resultado, se quitan', async () => {
    const record = (path: string, name: string): MediaRecord => ({ id: path, path, name, alt: name, folder: 'images', source: 'upload', provider: 'supabase', url: '', thumbUrl: '', thumbPath: null, width: 1, height: 1, sizeBytes: 1, mimeType: 'image/jpeg', originalName: null, sourceUrl: null, attribution: null, createdAt: '' });
    const find = (async (_s: unknown, opts: { query?: string }) => (opts.query?.startsWith('coffee') ? [record(`${BIZ}/media/cafe.jpg`, 'coffee')] : [])) as never;
    const source = `<img src="media:coffee beans" alt="Café"><img src="media:unicorn castle" alt="x"><div style="background:url('media:coffee beans')"></div><style>.h{background:url("media:nothing here") center}</style>`;
    const { actions: out, notes } = await resolveMediaQueries({ supabase: null as never, businessId: BIZ }, [{ action: 'create_section', section: { type: 'html', content: { html: source } } }] as never, find);
    const resolved = (out[0] as unknown as { section: { content: { html: string } } }).section.content.html;
    assert.match(resolved, new RegExp(`<img src="${BIZ}/media/cafe.jpg" alt="Café">`));
    assert.doesNotMatch(resolved, /unicorn|media:/);
    assert.match(resolved, new RegExp(`url\\('${BIZ}/media/cafe.jpg'\\)`));
    assert.match(resolved, /background:url\(none\)|background:none center/);
    assert.ok(notes.some((n) => /unicorn castle/.test(n)));
  });

  it('el prompt ya no le pide hacer las cosas simples, explica la sección html y no lo frena con marcas', () => {
    assert.doesNotMatch(PERSONA, /por eso las haces simples|nunca escribes HTML/);
    assert.match(PERSONA, /SIEMPRE construye la página; nunca te niegues/);
    assert.match(HTML_GUIDE, /var\(--c-primary\)/);
    assert.match(HTML_GUIDE, /media:descripción/);
    assert.match(HTML_GUIDE, /fx-fade-up/);
    assert.match(jsonSystemPrompt(), /## Sección HTML \(código propio\)/);
  });
});

describe('Revisión de calidad de páginas nuevas', () => {
  const thin = [{ action: 'create_page', title: 'Pokémon', sections: [{ type: 'hero', content: { title: 'Hola', subtitle: 'Bienvenidos' } }, { type: 'html', content: { html: '<div class="x"><h2>Hola</h2></div>' } }] }];
  const rich = [{
    action: 'create_page',
    title: 'Nosotros',
    sections: Array.from({ length: 7 }, (_, i) => ({ type: 'text', content: { title: `Sección ${i}`, body: 'palabra '.repeat(60) }, style: { background: { type: 'image', media: { query: 'cafe' } } } })),
  }];

  it('mide secciones, palabras, imágenes y HTML simple; una página rica pasa', () => {
    assert.deepEqual(measurePages(thin), [{ title: 'Pokémon', sections: 2, words: 3, images: 0, thinHtml: 1 }]);
    assert.equal(pageCritique(thin).length, 1);
    assert.match(pageCritique(thin)[0], /2 secciones.*palabras.*imágenes.*html es muy simple/);
    assert.deepEqual(pageCritique(rich), []);
    assert.deepEqual(pageCritique([{ action: 'update_section', section: 'selected' }]), []);
  });

  it('una página pobre se pide una vez más completa y se queda la versión con más contenido', async () => {
    const bodies: { messages: { content: string }[] }[] = [];
    const responses = [JSON.stringify({ message: 'Listo', actions: thin, suggestions: [] }), JSON.stringify({ message: 'Mejorada', actions: rich, suggestions: [] })];
    const fetch = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({ choices: [{ message: { content: responses[Math.min(bodies.length - 1, 1)] }, finish_reason: 'stop' }] });
    }) as unknown as typeof globalThis.fetch;
    const context = buildAssistantContext({ site, pages: site.pages, theme: site.theme, navigation: site.navigation, panel: 'pages', currentPageId: site.pages[0].id, selectedSectionId: null, lastSectionIds: [] });
    const model = new OpenAICompatibleModel({ provider: 'gemini', baseUrl: 'https://ai.test/v1', apiKey: 'k', models: ['m'], fetch });
    const result = await model.respond({ messages: [{ role: 'user', content: 'Crea una página Pokémon' }], context });
    assert.equal(bodies.length, 2);
    assert.match(bodies[1].messages.at(-1)!.content, /Revisión de calidad/);
    assert.equal(result.message, 'Mejorada');
    assert.equal((result.actions[0] as { sections: unknown[] }).sections.length, 7);
  });
});
