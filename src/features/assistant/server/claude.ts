import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { assistantResponseSchema, parseActions, type AssistantResponse } from '@/lib/assistant/actions';
import { systemBlocks } from './prompt';
import { MAX_TOOL_ROUNDS, ProviderError, QuotaExceededError, userTurn, type AssistantModel, type ModelInput, type ModelResult } from './types';

const MAX_TOKENS = 8000;

// JSON Schema de la herramienta, generado del MISMO schema Zod que valida la respuesta.
const { $schema: _schema, ...RESPOND_SCHEMA } = z.toJSONSchema(assistantResponseSchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;

/** Claude con una herramienta forzada ("respond"): la salida siempre es estructurada. */
export class ClaudeModel implements AssistantModel {
  readonly mode = 'ai' as const;
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  }

  async respond({ messages, context }: ModelInput): Promise<ModelResult> {
    try {
      return await this.run({ messages, context });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        if (error.status === 429) throw new QuotaExceededError('Límite de uso de Claude alcanzado.');
        throw new ProviderError(error.status === 401 || error.status === 403 ? 'La clave de Anthropic no es válida.' : 'Claude no respondió.', error.status === 403 ? 401 : (error.status ?? 500));
      }
      throw error;
    }
  }

  private async run({ messages, context, tools }: ModelInput): Promise<ModelResult> {
    // Historial como texto; el contexto actual va sólo en el último mensaje del usuario.
    const history: Anthropic.MessageParam[] = messages.map((m, i) => ({
      role: m.role,
      content: i === messages.length - 1 && m.role === 'user' ? userTurn(m.content, context) : m.content,
    }));
    const serverTools: Anthropic.Tool[] = (tools?.specs ?? []).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool.InputSchema }));
    const request = (conversation: Anthropic.MessageParam[], mustRespond: boolean) =>
      this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: systemBlocks(),
        tools: [...serverTools, { name: 'respond', description: 'Respuesta FINAL al usuario con las acciones del editor.', input_schema: RESPOND_SCHEMA as Anthropic.Tool.InputSchema }],
        tool_choice: mustRespond || serverTools.length === 0 ? { type: 'tool', name: 'respond' } : { type: 'any' },
        messages: conversation,
      });

    // Bucle de herramientas: consultas del servidor hasta que el modelo llama a "respond".
    const conversation = [...history];
    let response = await request(conversation, false);
    for (let round = 1; round < MAX_TOOL_ROUNDS; round++) {
      const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (uses.some((u) => u.name === 'respond') || uses.length === 0 || !tools) break;
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of uses) {
        const outcome = await tools.run(use.name, use.input);
        results.push({ type: 'tool_result', tool_use_id: use.id, is_error: !outcome.ok, content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }).slice(0, 24_000) });
      }
      conversation.push({ role: 'assistant', content: response.content }, { role: 'user', content: results });
      response = await request(conversation, round === MAX_TOOL_ROUNDS - 1);
    }

    let parsed = read(response);
    // Una corrección: si alguna acción no pasó la validación, se lo explicamos al modelo.
    if (parsed.errors.length > 0) {
      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'respond');
      if (toolUse) {
        const retry = await request(
          [
            ...conversation,
            { role: 'assistant', content: response.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: `Estas acciones no son válidas y se descartaron:\n${parsed.errors.join('\n')}\nVuelve a llamar a "respond" con TODAS las acciones corregidas.` }] },
          ],
          true,
        );
        const second = read(retry);
        if (second.errors.length <= parsed.errors.length) parsed = second;
      }
    }
    return { ...parsed.result, mode: this.mode, provider: 'anthropic', model: this.model, warnings: parsed.errors };
  }
}

function read(response: Anthropic.Message): { result: AssistantResponse; errors: string[] } {
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'respond');
  const input = (toolUse?.input ?? {}) as { message?: unknown; actions?: unknown; suggestions?: unknown };
  const { actions, errors } = parseActions(input.actions);
  const message = typeof input.message === 'string' && input.message.trim() ? input.message.slice(0, 2000) : response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? 'Listo.';
  const suggestions = Array.isArray(input.suggestions) ? input.suggestions.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 60)).slice(0, 4) : [];
  if (response.stop_reason === 'max_tokens') errors.push('La respuesta fue demasiado larga y se cortó.');
  return { result: { message, actions, suggestions }, errors };
}
