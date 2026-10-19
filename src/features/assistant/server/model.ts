import 'server-only';
import { msg } from '@/i18n/translate';
import { HybridModel, type Routing } from './router';
import { ClaudeModel } from './claude';
import { CLAUDE_DEFAULT_MODEL, GEMINI_BASE_URL, GEMINI_DEFAULT_MODELS, list, resolveProvider, type Env } from './config';
import { OpenAICompatibleModel } from './openai-compatible';
import { ProviderError, QuotaExceededError, type AssistantModel } from './types';

export type { ChatMessage, ModelInput, ModelResult } from './types';
export { resolveProvider } from './config';

/** Modelo de lenguaje configurado (o null: sólo intérprete local). */
function languageModel(env: Env): AssistantModel | null {
  const provider = resolveProvider(env);
  const models = list(env.ASSISTANT_MODEL);
  const reasoningEffort = env.ASSISTANT_REASONING_EFFORT?.trim() || undefined;
  switch (provider) {
    case 'gemini':
      return env.GEMINI_API_KEY ? new OpenAICompatibleModel({ provider: 'gemini', baseUrl: env.ASSISTANT_BASE_URL || GEMINI_BASE_URL, apiKey: env.GEMINI_API_KEY, models: models.length ? models : GEMINI_DEFAULT_MODELS, reasoningEffort }) : null;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY ? new ClaudeModel(env.ANTHROPIC_API_KEY, models[0] ?? CLAUDE_DEFAULT_MODEL) : null;
    case 'openai-compatible':
      // Ollama local (modelo local) no necesita clave.
      return env.ASSISTANT_BASE_URL && models.length ? new OpenAICompatibleModel({ provider: env.ASSISTANT_PROVIDER_NAME || 'openai-compatible', baseUrl: env.ASSISTANT_BASE_URL, apiKey: env.ASSISTANT_API_KEY || 'none', models, reasoningEffort }) : null;
    default:
      return null;
  }
}

const ROUTINGS: Routing[] = ['local-first', 'llm-first', 'local-only'];

/**
 * Garfield = router híbrido: intérprete local primero (pedidos simples, sin
 * costo) y el modelo de lenguaje para lo creativo o lo que no se entendió.
 * ASSISTANT_ROUTING=llm-first manda todo al modelo; local-only nunca lo usa.
 */
export function getAssistantModel(env: Env = process.env): AssistantModel {
  const routing = ROUTINGS.find((r) => r === env.ASSISTANT_ROUTING?.trim()) ?? 'local-first';
  return new HybridModel(languageModel(env), routing);
}

/** Mensaje en español (clave del catálogo) + datos: la ruta lo traduce con t(message, params). */
export function describeModelError(error: unknown): { status: number; message: string; params?: Record<string, string> } {
  if (error instanceof ProviderError) {
    if (error.status === 401) return { status: 502, message: msg('{detail} Revisa la configuración de Garfield en las variables de entorno.'), params: { detail: error.message } };
    return { status: 502, message: msg('El servicio de IA no respondió. Intenta de nuevo.') };
  }
  if (error instanceof QuotaExceededError) return { status: 429, message: msg('Garfield está atendiendo muchos pedidos. Intenta en unos segundos.') };
  return { status: 500, message: msg('Garfield se enredó con la madeja. Intenta de nuevo.') };
}
