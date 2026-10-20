import type { AssistantMode } from '@/lib/assistant/context';
import { parseModeActions, type AnyAction } from '@/lib/assistant/modes';
import { jsonSystemPrompt } from './prompt';
import { MAX_TOOL_ROUNDS, ProviderError, QuotaExceededError, userTurn, type AssistantModel, type ModelInput, type ModelResult, type TaskInput, type TaskModel } from './types';

/**
 * Proveedor para cualquier API compatible con OpenAI (chat/completions):
 * Google Gemini (plan gratuito), Ollama (local), Mistral, Groq, OpenRouter…
 *
 * Usa modo JSON en lugar de herramientas: es lo más portable entre
 * proveedores. La respuesta se valida con el MISMO schema Zod que la de
 * Claude, y si algo no es válido se le pide al modelo una corrección.
 *
 * Varios modelos = cadena de respaldo: si el primero agota su cuota (429),
 * se usa el siguiente (p. ej. Gemini Flash → Flash-Lite).
 */

type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type Completion = { choices?: { message?: { content?: string | { text?: string }[] | null }; finish_reason?: string }[] };

export type OpenAICompatibleOptions = {
  /** Nombre para mostrar y registrar ("gemini", "ollama"…). */
  provider: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  /** Esfuerzo de razonamiento (modelos que lo admiten, p. ej. Gemini 3): menos = más rápido. */
  reasoningEffort?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

const RETRYABLE_MODEL_ERRORS = new Set([404, 500, 502, 503, 504]);

export class OpenAICompatibleModel implements AssistantModel, TaskModel {
  readonly mode = 'ai' as const;
  private fetch: typeof fetch;

  constructor(private options: OpenAICompatibleOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  get provider() {
    return this.options.provider;
  }

  respond(input: ModelInput): Promise<ModelResult> {
    return this.withModels((model) => this.respondWith(model, input));
  }

  /** Tarea con respuesta JSON validada (una corrección si no cumple el schema). */
  generate<T>(task: TaskInput<T>): Promise<T> {
    return this.withModels(async (model) => {
      const conversation: Message[] = [
        { role: 'system', content: `${task.system}\n\nResponde SOLO con un objeto JSON válido.` },
        { role: 'user', content: task.prompt },
      ];
      const first = await this.complete(model, conversation, true, task.maxTokens);
      const parsed = task.schema.safeParse(extractJson(first.text));
      if (parsed.success) return parsed.data;
      const retry = await this.complete(
        model,
        [...conversation, { role: 'assistant', content: first.text.slice(0, 8000) }, { role: 'user', content: `La respuesta no cumple el formato: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}. Responde de nuevo SOLO con el objeto JSON corregido.` }],
        true,
        task.maxTokens,
      );
      const second = task.schema.safeParse(extractJson(retry.text));
      if (second.success) return second.data;
      throw new ProviderError(`${this.options.provider} no respondió en el formato esperado.`, 502);
    });
  }

  /** Cadena de respaldo: si un modelo agota su cuota o no está disponible, se usa el siguiente. */
  private async withModels<R>(run: (model: string) => Promise<R>): Promise<R> {
    let quotaHit = false;
    let lastError: unknown = null;
    for (const model of this.options.models) {
      try {
        return await run(model);
      } catch (error) {
        lastError = error;
        if (error instanceof QuotaExceededError) quotaHit = true;
        else if (!(error instanceof ProviderError && RETRYABLE_MODEL_ERRORS.has(error.status))) throw error;
        // Cuota agotada o modelo no disponible: probar el siguiente de la cadena.
      }
    }
    if (quotaHit) throw new QuotaExceededError(`Se agotó la cuota de ${this.options.provider}.`);
    throw lastError ?? new ProviderError('No hay modelos configurados.', 500);
  }

  private async respondWith(model: string, { messages, context, tools, locale }: ModelInput): Promise<ModelResult> {
    const conversation: Message[] = [
      { role: 'system', content: jsonSystemPrompt(tools?.specs, context.mode, locale) },
      ...messages.map((m, i) => ({ role: m.role, content: i === messages.length - 1 && m.role === 'user' ? userTurn(m.content, context) : m.content })),
    ];

    // Bucle de herramientas: el modelo puede consultar (productos, imágenes…) antes de responder.
    let completion = await this.complete(model, conversation);
    for (let round = 1; round < MAX_TOOL_ROUNDS && tools; round++) {
      const calls = toolCalls(completion.text);
      if (calls.length === 0) break;
      const results = [];
      for (const call of calls) results.push({ tool: call.tool, ...(await tools.run(call.tool, call.args)) });
      const last = round === MAX_TOOL_ROUNDS - 1;
      conversation.push(
        { role: 'assistant', content: completion.text.slice(0, 8000) },
        {
          role: 'user',
          content: `Resultados de herramientas:\n${JSON.stringify(results).slice(0, 24_000)}\n${last ? 'Responde AHORA con la respuesta final (message, actions, suggestions); ya no hay más herramientas.' : 'Continúa: llama más herramientas si hace falta o responde con la respuesta final.'}`,
        },
      );
      completion = await this.complete(model, conversation);
    }

    let parsed = parse(completion.text, context.mode);
    if (completion.truncated) parsed.errors.push('La respuesta fue demasiado larga y se cortó.');

    // Una corrección: JSON inválido o acciones que no pasaron la validación.
    if (parsed.errors.length > 0 && !completion.truncated) {
      const retry = await this.complete(model, [
        ...conversation,
        { role: 'assistant', content: completion.text.slice(0, 20_000) },
        {
          role: 'user',
          content: `Tu respuesta tuvo estos problemas y esas acciones se descartaron:\n${parsed.errors.join('\n')}\nResponde de nuevo SOLO con el objeto JSON final completo y corregido (message, actions, suggestions), sin tool_calls.`,
        },
      ]);
      const second = parse(retry.text, context.mode);
      if (second.errors.length < parsed.errors.length || (second.result.actions.length > parsed.result.actions.length && second.errors.length <= parsed.errors.length)) parsed = second;
    }
    return { ...parsed.result, mode: this.mode, provider: this.options.provider, model, warnings: parsed.errors };
  }

  private async complete(model: string, messages: Message[], jsonMode = true, maxTokens = 8192): Promise<{ text: string; truncated: boolean }> {
    const body: Record<string, unknown> = { model, messages, temperature: 0.4, max_tokens: maxTokens };
    if (jsonMode) body.response_format = { type: 'json_object' };
    if (this.options.reasoningEffort) body.reasoning_effort = this.options.reasoningEffort;

    let response: Response;
    try {
      response = await this.fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 60_000),
      });
    } catch (error) {
      throw new ProviderError(`${this.options.provider} no respondió (${(error as Error).name === 'TimeoutError' ? 'tiempo agotado' : 'sin conexión'}).`, 504);
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      // Algunos proveedores no admiten response_format: reintentar sin modo JSON (el prompt ya exige JSON).
      if (response.status === 400 && jsonMode && /response_format|json/i.test(detail)) return this.complete(model, messages, false, maxTokens);
      if (response.status === 429) throw new QuotaExceededError(`${this.options.provider}: límite de uso alcanzado (${model}).`);
      if (response.status === 401 || response.status === 403) throw new ProviderError(`La clave de ${this.options.provider} no es válida o no tiene acceso a ${model}.`, 401);
      throw new ProviderError(`${this.options.provider} respondió ${response.status} con ${model}: ${detail}`, response.status);
    }

    const data = (await response.json().catch(() => ({}))) as Completion;
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part) => part.text ?? '').join('') : '';
    return { text, truncated: choice?.finish_reason === 'length' };
  }
}

/** Objeto JSON de la respuesta (tolera ```json … ``` o texto alrededor). */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  try {
    const value = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Llamadas a herramientas pedidas por el modelo ({"tool_calls": [...]}), máximo 4 por ronda. */
export function toolCalls(text: string): { tool: string; args: unknown }[] {
  const raw = extractJson(text);
  if (!raw || !Array.isArray(raw.tool_calls) || Array.isArray(raw.actions)) return [];
  return raw.tool_calls
    .filter((c): c is { tool: string; args?: unknown } => typeof c === 'object' && c !== null && typeof (c as { tool?: unknown }).tool === 'string')
    .slice(0, 4)
    .map((c) => ({ tool: c.tool, args: c.args ?? {} }));
}

/** Valida la respuesta final. */
export function parse(text: string, mode: AssistantMode = 'site'): { result: { message: string; actions: AnyAction[]; suggestions: string[] }; errors: string[] } {
  const errors: string[] = [];
  const raw = extractJson(text) ?? {};
  if (!extractJson(text)) errors.push('La respuesta no fue un JSON válido.');
  const { actions, errors: actionErrors } = parseModeActions(mode, raw.actions);
  errors.push(...actionErrors);
  const message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.slice(0, 2000) : errors.length ? 'No pude armar bien la respuesta. ¿Puedes repetirlo con otras palabras?' : 'Listo.';
  const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 60)).slice(0, 4) : [];
  return { result: { message, actions, suggestions }, errors };
}
