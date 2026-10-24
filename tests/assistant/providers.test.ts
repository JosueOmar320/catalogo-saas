import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { buildAssistantContext } from '@/lib/assistant/context';
import { resolveProvider } from '@/features/assistant/server/config';
import { withFallback } from '@/features/assistant/server/fallback';
import { OpenAICompatibleModel, parse } from '@/features/assistant/server/openai-compatible';
import { HybridModel } from '@/features/assistant/server/router';
import { ProviderError, QuotaExceededError, type ModelInput, type TaskModel } from '@/features/assistant/server/types';
import { buildSampleSite } from '@/lib/site/sample-site';

const site = buildSampleSite();
const input = (text: string): ModelInput => ({
  messages: [{ role: 'user', content: text }],
  context: buildAssistantContext({ site, pages: site.pages, theme: site.theme, navigation: site.navigation, panel: 'pages', currentPageId: site.pages[0].id, selectedSectionId: null, lastSectionIds: [] }),
});

type Call = { url: string; body: Record<string, unknown>; auth: string | null };

/** fetch simulado: responde en orden con las respuestas dadas (status + contenido del asistente). */
function fakeFetch(responses: { status?: number; content?: string; error?: string }[]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('Authorization') });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next.status && next.status >= 400) return new Response(next.error ?? 'error', { status: next.status });
    return Response.json({ choices: [{ message: { role: 'assistant', content: next.content }, finish_reason: 'stop' }] });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const gemini = (fetch: typeof globalThis.fetch, models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']) =>
  new OpenAICompatibleModel({ provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: 'test-key', models, fetch });

const valid = JSON.stringify({ message: 'Agregué la sección de contacto.', actions: [{ action: 'create_section', section: { type: 'contact' }, position: { place: 'end' } }], suggestions: ['Agrega un mapa'] });

describe('Garfield AI · proveedor compatible con OpenAI (Gemini)', () => {
  it('envía el pedido en modo JSON con el contexto y valida la respuesta', async () => {
    const { impl, calls } = fakeFetch([{ content: valid }]);
    const result = await gemini(impl).respond(input('Agrega contacto al final'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(calls[0].auth, 'Bearer test-key');
    assert.equal(calls[0].body.model, 'gemini-3.8-flash');
    assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
    const messages = calls[0].body.messages as { role: string; content: string }[];
    assert.match(messages[0].content, /Formato de respuesta/);
    assert.match(messages[1].content, /<contexto_del_editor>/);
    assert.equal(result.actions[0].action, 'create_section');
    assert.equal(result.provider, 'gemini');
    assert.equal(result.model, 'gemini-3.8-flash');
    assert.deepEqual(result.warnings, []);
  });

  it('tolera ```json … ``` y texto alrededor', () => {
    assert.equal(parse('Claro:\n```json\n' + valid + '\n```').result.actions.length, 1);
  });

  it('pide una corrección cuando una acción es inválida', async () => {
    const bad = JSON.stringify({ message: 'x', actions: [{ action: 'create_section', section: { type: 'newsletter' } }], suggestions: [] });
    const { impl, calls } = fakeFetch([{ content: bad }, { content: valid }]);
    const result = await gemini(impl).respond(input('Agrega un newsletter'));
    assert.equal(calls.length, 2);
    assert.match((calls[1].body.messages as { content: string }[]).at(-1)!.content, /problemas/);
    assert.equal(result.actions.length, 1);
    assert.deepEqual(result.warnings, []);
  });

  it('cuota agotada en Flash → usa Flash-Lite', async () => {
    const { impl, calls } = fakeFetch([{ status: 429 }, { content: valid }]);
    const result = await gemini(impl).respond(input('hola'));
    assert.deepEqual(calls.map((c) => c.body.model), ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    assert.equal(result.model, 'gemini-3.5-flash-lite');
  });

  it('cuota agotada en todos los modelos → QuotaExceededError', async () => {
    const { impl } = fakeFetch([{ status: 429 }]);
    await assert.rejects(gemini(impl).respond(input('hola')), QuotaExceededError);
  });

  it('clave inválida → error claro (no se oculta con el intérprete local)', async () => {
    const { impl } = fakeFetch([{ status: 401 }]);
    const model = new HybridModel(gemini(impl), 'llm-first');
    await assert.rejects(model.respond(input('hola')), (error) => error instanceof ProviderError && error.status === 401);
  });

  it('proveedor sin response_format → reintenta sin modo JSON', async () => {
    const { impl, calls } = fakeFetch([{ status: 400, error: 'Invalid value for response_format' }, { content: valid }]);
    const result = await gemini(impl, ['llama3']).respond(input('hola'));
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.response_format, undefined);
    assert.equal(result.actions.length, 1);
  });

  it('sin cuota: Garfield sigue con el intérprete local y lo avisa', async () => {
    const { impl } = fakeFetch([{ status: 429 }]);
    const result = await new HybridModel(gemini(impl), 'llm-first').respond(input('Agrega una sección de contacto al final'));
    assert.equal(result.mode, 'basic');
    assert.equal(result.routed, 'local');
    assert.match(result.message, /cuota gratuita/);
    assert.equal(result.actions[0].action, 'create_section');
    assert.equal(result.warnings.length, 1);
  });

  it('proveedor caído (5xx): el intérprete local responde y lo avisa', async () => {
    const { impl } = fakeFetch([{ status: 503, error: 'overloaded' }]);
    const result = await new HybridModel(gemini(impl), 'llm-first').respond(input('Agrega una sección de contacto al final'));
    assert.equal(result.mode, 'basic');
    assert.match(result.message, /no respondió/);
    assert.equal(result.actions[0].action, 'create_section');
  });

  it('modelo principal lento: dentro del tiempo total responde el de respaldo', async () => {
    const calls: string[] = [];
    // El primero no contesta (se queda esperando hasta que lo cortan); el segundo, al instante.
    const impl = (async (_url: string, init: RequestInit) => {
      const model = String(JSON.parse(String(init.body)).model);
      calls.push(model);
      if (model === 'gemini-3.8-flash') return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))));
      return Response.json({ choices: [{ message: { role: 'assistant', content: valid }, finish_reason: 'stop' }] });
    }) as unknown as typeof fetch;
    const model = new OpenAICompatibleModel({ provider: 'gemini', baseUrl: 'https://ai.test/v1', apiKey: 'k', models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], budgetMs: 4000, fetch: impl });
    const started = Date.now();
    const result = await model.respond(input('Agrega contacto al final'));
    const elapsed = Date.now() - started;
    assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    assert.equal(result.model, 'gemini-3.5-flash-lite');
    assert.ok(elapsed >= 2000 && elapsed < 3500, `el principal tuvo ~60 % del tiempo (${elapsed} ms)`);
  });

  it('sin tiempo para ningún modelo: el intérprete local responde y lo avisa (antes de que corten la función)', async () => {
    const impl = (async (_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))))) as unknown as typeof fetch;
    const model = new OpenAICompatibleModel({ provider: 'gemini', baseUrl: 'https://ai.test/v1', apiKey: 'k', models: ['m1', 'm2'], budgetMs: 3500, fetch: impl });
    const started = Date.now();
    const result = await new HybridModel(model, 'llm-first').respond(input('Agrega una sección de contacto al final'));
    assert.ok(Date.now() - started < 3700, 'respeta el tiempo total');
    assert.equal(result.mode, 'basic');
    assert.match(result.message, /no respondió/);
    assert.equal(result.actions[0].action, 'create_section');
  });

  it('tarea con tiempo total: si no alcanza, la versión sin IA', async () => {
    const impl = (async (_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))))) as unknown as typeof fetch;
    const model = new OpenAICompatibleModel({ provider: 'gemini', baseUrl: 'https://ai.test/v1', apiKey: 'k', models: ['m1'], budgetMs: 2000, fetch: impl });
    const outcome = await withFallback(model, (m) => m.generate({ system: 's', prompt: 'p', schema: z.object({ ok: z.boolean() }) }), () => ({ ok: false }));
    assert.deepEqual(outcome, { result: { ok: false }, mode: 'basic', notice: 'El servicio de IA no respondió: te dejo una versión sin IA.' });
  });

  it('el intérprete local funciona sin proveedor', async () => {
    const result = await new HybridModel(null).respond(input('Haz que el encabezado sea más elegante'));
    assert.equal(result.mode, 'basic');
    assert.equal(result.provider, 'local');
    assert.equal(result.actions[0].action, 'update_theme');
  });
});

describe('Garfield AI · tareas con respaldo sin IA (withFallback)', () => {
  const failing = (error: Error): TaskModel => ({ provider: 'test', generate: async () => { throw error; } });
  const task = (model: TaskModel) => model.generate({ system: 's', prompt: 'p', schema: z.string() });

  it('sin modelo: la versión sin IA, sin aviso', async () => {
    const out = await withFallback(null, async () => 'ia', () => 'local');
    assert.deepEqual(out, { result: 'local', mode: 'basic', notice: null });
  });

  it('cuota agotada → versión sin IA con aviso de cuota', async () => {
    const out = await withFallback(failing(new QuotaExceededError('cuota')), task, () => 'local');
    assert.equal(out.result, 'local');
    assert.equal(out.mode, 'basic');
    assert.match(out.notice ?? '', /cuota/);
  });

  it('proveedor caído (5xx) → versión sin IA con aviso', async () => {
    const out = await withFallback(failing(new ProviderError('caído', 503)), task, () => 'local');
    assert.equal(out.mode, 'basic');
    assert.match(out.notice ?? '', /no respondió/);
  });

  it('otro error no se oculta', async () => {
    await assert.rejects(withFallback(failing(new TypeError('bug')), task, () => 'local'), TypeError);
  });
});

describe('Garfield AI · selección de proveedor', () => {
  it('detecta el proveedor por la clave disponible', () => {
    assert.equal(resolveProvider({ GEMINI_API_KEY: 'x' }), 'gemini');
    assert.equal(resolveProvider({ ANTHROPIC_API_KEY: 'x' }), 'anthropic');
    assert.equal(resolveProvider({ GEMINI_API_KEY: 'x', ANTHROPIC_API_KEY: 'y', ASSISTANT_PROVIDER: 'anthropic' }), 'anthropic');
    assert.equal(resolveProvider({ ASSISTANT_BASE_URL: 'http://localhost:11434/v1' }), 'openai-compatible');
    assert.equal(resolveProvider({}), 'basic');
  });
});

describe('Garfield AI · bucle de herramientas', () => {
  it('consulta herramientas en varias rondas y luego responde con acciones', async () => {
    const IMG = '11111111-2222-4333-8444-555555555555/site/abc.jpg';
    const { impl, calls } = fakeFetch([
      { content: JSON.stringify({ tool_calls: [{ tool: 'search_stock_images', args: { query: 'restaurant' } }] }) },
      { content: JSON.stringify({ tool_calls: [{ tool: 'import_image', args: { ref: 'stock-1', alt: 'Salón' } }] }) },
      { content: JSON.stringify({ message: 'Listo, puse la foto en el hero.', actions: [{ action: 'set_image', section: 'type:hero', path: IMG }], suggestions: [] }) },
    ]);
    const ran: string[] = [];
    const tools = {
      specs: [{ name: 'search_stock_images', description: 'x', inputSchema: {}, signature: 'query: string' }],
      run: async (name: string) => {
        ran.push(name);
        return name === 'import_image' ? { ok: true as const, result: { path: IMG } } : { ok: true as const, result: { results: [{ ref: 'stock-1' }] } };
      },
    };
    const result = await gemini(impl).respond({ ...input('Pon una foto de restaurante en el hero'), tools });
    assert.deepEqual(ran, ['search_stock_images', 'import_image']);
    assert.equal(calls.length, 3);
    const secondRound = (calls[1].body.messages as { role: string; content: string }[]).at(-1)!.content;
    assert.match(secondRound, /Resultados de herramientas/);
    assert.match((calls[0].body.messages as { content: string }[])[0].content, /search_stock_images\(/);
    assert.equal(result.actions[0].action, 'set_image');
  });

  it('corta el bucle y exige la respuesta final', async () => {
    const loop = JSON.stringify({ tool_calls: [{ tool: 'search_media', args: {} }] });
    const { impl, calls } = fakeFetch([{ content: loop }, { content: loop }, { content: loop }, { content: loop }, { content: valid }]);
    const tools = { specs: [], run: async () => ({ ok: true as const, result: {} }) };
    const result = await gemini(impl).respond({ ...input('hola'), tools });
    assert.equal(calls.length, 5);
    assert.match((calls[4].body.messages as { content: string }[]).at(-1)!.content, /Responde AHORA/);
    assert.equal(result.actions.length, 1);
  });
});
