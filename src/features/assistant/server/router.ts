import type { AssistantContext } from '@/lib/assistant/context';
import { parseModeActions } from '@/lib/assistant/modes';
import { pdfRulesRespond } from './pdf-rules';
import { rulesRespond } from './rules';
import { ProviderError, QuotaExceededError, type AssistantModel, type ModelInput, type ModelResult } from './types';

/**
 * Router de Garfield: decide quién resuelve cada pedido.
 *
 *   pedido → cláusulas → intérprete local (determinista, por modo)
 *     ├─ todo entendido y nada "creativo" → responde LOCAL (gratis, instantáneo)
 *     ├─ creativo / no entendido + hay modelo → LLM (Gemini, Claude, Ollama…)
 *     └─ no hay modelo (o se agotó la cuota) → lo local + qué no se entendió
 *
 * "Cambia el color a azul" no necesita una IA enorme; "créame una página
 * completa para una empresa de arquitectura elegante" sí.
 */

export type Routing = 'local-first' | 'llm-first' | 'local-only';

export type LocalResult = { message: string; actions: Record<string, unknown>[]; suggestions: string[]; unmatched: string[]; creative: boolean };

const VERBS = 'agrega|añade|anade|pon|ponle|cambia|mueve|quita|elimina|borra|usa|crea|haz|duplica|busca|oculta|muestra|sube|baja|coloca|aplica|activa|desactiva|incluye';
const SPLIT = new RegExp(
  [
    '\\s*;\\s*',
    '\\.\\s+(?=\\S)',
    `,?\\s+(?:y\\s+)?(?:luego|despu[eé]s|tambi[eé]n|adem[aá]s)\\s*,?\\s+`,
    `,?\\s+y\\s+(?=(?:${VERBS})\\b)`,
    `,\\s+(?=(?:${VERBS})\\b)`,
  ].join('|'),
  'i',
);

/** "Agrega una galería, luego pon el título X y cambia el fondo a azul" → 3 cláusulas. */
export function splitClauses(raw: string): string[] {
  // Con imágenes adjuntas el pedido va entero (la referencia a la imagen está al final).
  if (raw.includes('[Imagen adjunta:')) return [raw.trim()];
  return raw
    .split(SPLIT)
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c && c.replace(/[.\s]/g, '').length > 1))
    .slice(0, 8);
}

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pedidos que piden redactar o diseñar algo nuevo: mejor con un modelo de lenguaje. */
export function isCreative(raw: string, actions: Record<string, unknown>[]): boolean {
  const text = norm(raw);
  if (actions.some((a) => a.action === 'create_page' && typeof a.topic === 'string')) return true;
  // Una plantilla se aplica igual sin IA, pero con IA además se reescriben los textos para el negocio.
  if (actions.some((a) => a.action === 'apply_site_template')) return true;
  if (/\b(escribe|escribeme|redacta|inventa|textos?|copy|eslogan|slogan|ideas|propon|sugiere|disena|creame|hazme|completa|completo|profesional)\b/.test(text)) return true;
  return text.split(/\s+/).length > 32;
}

/** Cambia los $alias de una cláusula para que no choquen con los de otra. */
function scopeAliases(actions: Record<string, unknown>[], index: number): Record<string, unknown>[] {
  if (index === 0) return actions;
  return JSON.parse(JSON.stringify(actions).replace(/"\$([a-zA-Z0-9_-]{1,24})"/g, `"$c${index}_$1"`)) as Record<string, unknown>[];
}

/** Las cláusulas siguientes se refieren a "esto" = lo último que se tocó. */
function selectedToLast(actions: Record<string, unknown>[]): Record<string, unknown>[] {
  return JSON.parse(JSON.stringify(actions).replace(/"selected"/g, '"last"')) as Record<string, unknown>[];
}

const TOUCHING = new Set(['create_section', 'update_section', 'duplicate_section', 'move_section', 'set_image', 'add_gallery_images']);

export function interpretLocally(raw: string, context: AssistantContext): LocalResult {
  const respond = context.mode === 'pdf' ? pdfRulesRespond : rulesRespond;
  const clauses = splitClauses(raw);
  if (clauses.length <= 1) {
    const result = respond(raw, context);
    const greeting = /^(hola|buenas|hey|ayuda|que puedes hacer)/.test(norm(raw).trim());
    return { ...result, unmatched: result.actions.length || greeting ? [] : [raw.trim()], creative: isCreative(raw, result.actions) };
  }

  const actions: Record<string, unknown>[] = [];
  const messages: string[] = [];
  const unmatched: string[] = [];
  let suggestions: string[] = [];
  let ctx = context;
  let touchedType: string | null = null;
  clauses.forEach((clause, index) => {
    const result = respond(clause, ctx);
    if (result.actions.length === 0) {
      unmatched.push(clause);
      return;
    }
    let clauseActions = scopeAliases(result.actions, index);
    if (index > 0 && touchedType) clauseActions = selectedToLast(clauseActions);
    actions.push(...clauseActions);
    messages.push(result.message);
    suggestions = result.suggestions;
    // La cláusula siguiente "ve" la sección recién creada o tocada como la seleccionada.
    const touching = [...clauseActions].reverse().find((a) => TOUCHING.has(String(a.action)));
    if (touching && context.mode !== 'pdf') {
      const section = touching.section as { type?: string } | string | undefined;
      touchedType = typeof section === 'object' && section?.type ? section.type : (ctx.pages.flatMap((p) => p.sections).find((s) => s.id === ctx.selectedSectionId)?.type ?? touchedType);
      if (touchedType) {
        const pages = ctx.pages.map((p) => (p.id === ctx.currentPageId ? { ...p, sections: [...p.sections, { id: '__last__', type: touchedType!, title: '', name: '', visible: true, details: '' }] } : p));
        ctx = { ...ctx, pages, selectedSectionId: '__last__' };
      }
    }
  });
  const message = [...messages, ...(unmatched.length ? [`No entendí: «${unmatched.join('», «')}». Dímelo de otra forma.`] : [])].join(' ');
  return { message: message || 'Mmm, no entendí ese pedido.', actions, suggestions, unmatched, creative: isCreative(raw, actions) };
}

/** Intérprete local con la misma interfaz que un modelo (para pruebas y modo sin IA). */
function localResult(local: LocalResult, context: AssistantContext, mode: ModelResult['mode'], extraWarnings: string[] = []): ModelResult {
  const { actions, errors } = parseModeActions(context.mode, local.actions);
  return { message: local.message, actions, suggestions: local.suggestions, mode, provider: 'local', routed: 'local', warnings: [...errors, ...extraWarnings] };
}

export class HybridModel implements AssistantModel {
  readonly mode: ModelResult['mode'];

  constructor(
    private llm: AssistantModel | null,
    private routing: Routing = 'local-first',
  ) {
    this.mode = llm ? 'ai' : 'basic';
  }

  async respond(input: ModelInput): Promise<ModelResult> {
    const last = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const local = interpretLocally(last, input.context);
    const simple = local.actions.length > 0 && local.unmatched.length === 0 && !local.creative;

    if (!this.llm || this.routing === 'local-only') return localResult(local, input.context, 'basic');
    // Hay IA configurada: el pedido se resolvió localmente porque era simple (mode sigue siendo 'ai').
    if (this.routing === 'local-first' && simple) return localResult(local, input.context, 'ai');

    try {
      const result = await this.llm.respond(input);
      return { ...result, routed: 'llm' };
    } catch (error) {
      const quota = error instanceof QuotaExceededError;
      const unavailable = error instanceof ProviderError && error.status >= 500;
      if (!quota && !unavailable) throw error;
      console.warn('[assistant] usando el intérprete local:', (error as Error).message);
      const notice = quota ? 'Por hoy se agotó mi cuota gratuita de IA, así que resuelvo lo que entiendo sin IA.' : 'El servicio de IA no respondió; mientras tanto resuelvo lo que entiendo sin IA.';
      const result = localResult(local, input.context, 'basic', [(error as Error).message]);
      return { ...result, message: `${notice}\n\n${result.message}` };
    }
  }
}
