/* Configuración de Garfield por variables de entorno (sin dependencias de servidor: testeable). */

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
/** Gemini: primero el Flash más capaz; cuando agota su cuota diaria gratuita, Flash-Lite (más cuota). */
export const GEMINI_DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-5-5';

export const list = (value: string | undefined) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export type Env = Record<string, string | undefined>;

export type AssistantProvider = 'gemini' | 'anthropic' | 'openai-compatible' | 'basic';

/**
 * ASSISTANT_PROVIDER elige el proveedor; si falta, se detecta por la clave
 * presente (GEMINI_API_KEY → ANTHROPIC_API_KEY → ASSISTANT_BASE_URL → básico).
 */
export function resolveProvider(env: Env = process.env): AssistantProvider {
  const explicit = env.ASSISTANT_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'anthropic' || explicit === 'openai-compatible' || explicit === 'basic') return explicit;
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.ASSISTANT_BASE_URL) return 'openai-compatible';
  return 'basic';
}
