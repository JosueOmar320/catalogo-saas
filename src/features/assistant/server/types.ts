import type { AnyAction } from '@/lib/assistant/modes';
import type { AssistantContext } from '@/lib/assistant/context';
import type { Locale } from '@/i18n/config';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
/** Herramientas de servidor disponibles en esta conversación (consultas y media). */
export type ToolSpec = { name: string; description: string; inputSchema: Record<string, unknown>; signature: string };
export type ToolRunner = { specs: ToolSpec[]; run: (name: string, args: unknown) => Promise<{ ok: true; result: unknown } | { ok: false; error: string }> };
export type ModelInput = {
  messages: ChatMessage[];
  context: AssistantContext;
  tools?: ToolRunner;
  /** Idioma de la app del usuario: el modelo le responde en ese idioma (por defecto, español). */
  locale?: Locale;
};

/** Rondas máximas de herramientas antes de exigir la respuesta final. */
export const MAX_TOOL_ROUNDS = 5;
export type ModelResult = {
  message: string;
  actions: AnyAction[];
  suggestions: string[];
  /** ai = respondió un modelo de lenguaje · basic = intérprete local (sin IA). */
  mode: 'ai' | 'basic';
  /** Proveedor y modelo que respondieron (p. ej. "gemini" / "gemini-3.5-flash-lite"). */
  provider: string;
  model?: string;
  /** Quién resolvió el pedido: el intérprete local (sin costo) o el modelo de lenguaje. */
  routed?: 'local' | 'llm';
  warnings: string[];
};

/**
 * Proveedor del "cerebro" de Garfield. Cambiar de modelo o agregar otro
 * proveedor = implementar esta interfaz; el resto (acciones, validación,
 * ejecución, interfaz) no cambia.
 */
export interface AssistantModel {
  readonly mode: ModelResult['mode'];
  respond(input: ModelInput): Promise<ModelResult>;
}

/** Cuota o límite de uso agotado en el proveedor (plan gratuito): se puede seguir en modo básico. */
export class QuotaExceededError extends Error {}

/** El proveedor respondió con un error (clave inválida, caído, etc.). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Contexto del editor dentro del último mensaje del usuario. */
export function userTurn(text: string, context: AssistantContext) {
  return `<contexto_del_editor>\n${JSON.stringify(context)}\n</contexto_del_editor>\n\n${text}`;
}
