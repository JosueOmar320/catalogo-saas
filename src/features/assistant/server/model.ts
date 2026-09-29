import 'server-only';
import { RulesModel, WithBasicFallback } from './basic';
import { ClaudeModel } from './claude';
import { CLAUDE_DEFAULT_MODEL, GEMINI_BASE_URL, GEMINI_DEFAULT_MODELS, list, resolveProvider, type Env } from './config';
import { OpenAICompatibleModel } from './openai-compatible';
import { ProviderError, QuotaExceededError, type AssistantModel } from './types';

export type { ChatMessage, ModelInput, ModelResult } from './types';
export { resolveProvider } from './config';

export function getAssistantModel(env: Env = process.env): AssistantModel {
  const provider = resolveProvider(env);
  const models = list(env.ASSISTANT_MODEL);
  const reasoningEffort = env.ASSISTANT_REASONING_EFFORT?.trim() || undefined;

  switch (provider) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) return new RulesModel();
      return new WithBasicFallback(
        new OpenAICompatibleModel({ provider: 'gemini', baseUrl: env.ASSISTANT_BASE_URL || GEMINI_BASE_URL, apiKey: env.GEMINI_API_KEY, models: models.length ? models : GEMINI_DEFAULT_MODELS, reasoningEffort }),
      );
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) return new RulesModel();
      return new WithBasicFallback(new ClaudeModel(env.ANTHROPIC_API_KEY, models[0] ?? CLAUDE_DEFAULT_MODEL));
    case 'openai-compatible':
      if (!env.ASSISTANT_BASE_URL || models.length === 0) return new RulesModel();
      return new WithBasicFallback(
        // Ollama local no necesita clave.
        new OpenAICompatibleModel({ provider: env.ASSISTANT_PROVIDER_NAME || 'openai-compatible', baseUrl: env.ASSISTANT_BASE_URL, apiKey: env.ASSISTANT_API_KEY || 'none', models, reasoningEffort }),
      );
    default:
      return new RulesModel();
  }
}

export function describeModelError(error: unknown): { status: number; message: string } {
  if (error instanceof ProviderError) {
    if (error.status === 401) return { status: 502, message: `${error.message} Revisa la configuración de Garfield en las variables de entorno.` };
    return { status: 502, message: 'El servicio de IA no respondió. Intenta de nuevo.' };
  }
  if (error instanceof QuotaExceededError) return { status: 429, message: 'Garfield está atendiendo muchos pedidos. Intenta en unos segundos.' };
  return { status: 500, message: 'Garfield se enredó con la madeja. Intenta de nuevo.' };
}
