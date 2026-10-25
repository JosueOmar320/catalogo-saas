import { ASSISTANT } from '@/lib/assistant/identity';
import type { BusinessFeatures } from '@/lib/plans/features';
import { areasFor, helpResultSchema, matchAreas, type HelpResult } from '@/lib/assistant/panel-guide';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/translate';
import { foldText } from '@/lib/utils/text';
import type { ChatMessage, TaskModel } from './types';

/** catalog = false: sitio web (la guía no incluye productos, pedidos, reseñas ni PDF). */
export type HelpContext = { messages: ChatMessage[]; path: string; admin: boolean; locale: Locale; businessName: string; catalog?: boolean; features?: BusinessFeatures };

export function helpPrompt(context: HelpContext): { system: string; prompt: string } {
  const guide = areasFor(context.admin, context.catalog ?? true, context.features)
    .map((area) => `- ${area.id} (${area.href}): ${area.summary}`)
    .join('\n');
  const system = `Eres ${ASSISTANT.name}, el asistente del PANEL de una plataforma de catálogos y sitios web para pequeños negocios (gato naranja simpático, práctico y breve). Respondes dudas sobre cómo usar el panel y llevas al usuario al lugar correcto.

Guía del panel (id, dirección y qué se hace ahí):
${guide}

Reglas:
- Responde en ${context.locale === 'en' ? 'English (natural and friendly)' : 'español neutro'}, en 1 a 4 frases o pasos cortos y concretos ("En Contacto y pedidos › Cupones de descuento, toca Agregar…").
- En "links" pon los ids de 1 a 3 áreas a donde conviene ir (la app muestra los botones; no escribas direcciones en el mensaje).
- Usa SOLO lo que dice la guía. Si algo no existe en el panel, dilo con honestidad y sugiere la alternativa más cercana.
- Para cambiar el sitio web o el PDF, explica dónde y recuerda que dentro del editor del sitio y del estudio de PDF puedes hacer los cambios por el usuario.
- No pidas ni repitas contraseñas, claves ni datos de pago.
- "suggestions": hasta 3 preguntas cortas que el usuario podría hacerte después.
- Respuesta: {"message": "…", "links": ["id"], "suggestions": ["…"]}.`;
  const transcript = context.messages
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Usuario' : ASSISTANT.name}: ${m.content}`)
    .join('\n');
  return { system, prompt: `Negocio: ${context.businessName}\nPantalla actual: ${context.path}\n\nConversación:\n${transcript}` };
}

export async function helpWithModel(model: TaskModel, context: HelpContext): Promise<HelpResult> {
  const { system, prompt } = helpPrompt(context);
  const result = await model.generate({ system, prompt, schema: helpResultSchema, maxTokens: 900 });
  // Sólo áreas que este usuario puede abrir.
  const allowed = new Set(areasFor(context.admin, context.catalog ?? true, context.features).map((area) => area.id));
  return { ...result, links: [...new Set(result.links)].filter((id) => allowed.has(id)) };
}

const GREETING = /^(hola|buenas|buenos dias|buenas tardes|hey|hi|hello|ayuda|help|que puedes hacer|what can you do)\b/;

/** Sin IA: el área que coincide con las palabras de la pregunta. */
export function helpWithoutModel(context: HelpContext, t: Translator): HelpResult {
  const question = [...context.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const suggestions = context.catalog === false ? [t('¿Cómo agrego una página?'), t('¿Cómo cambio los colores del sitio?'), t('¿Cómo publico mi sitio?')] : [t('¿Cómo creo un cupón de descuento?'), t('¿Dónde cambio mi horario?'), t('¿Cómo cambio los colores del sitio?')];
  if (GREETING.test(foldText(question).trim())) {
    return { message: t('¡Hola! Pregúntame dónde se hace algo en el panel («¿dónde cambio mi horario?») y te llevo. En el editor del sitio y en el estudio de PDF también hago los cambios por ti.'), links: [], suggestions };
  }
  const areas = matchAreas(question, context.admin, 3, context.catalog ?? true, context.features);
  if (areas.length === 0) return { message: t('No encontré eso en el panel. Prueba con otras palabras, por ejemplo «cupones», «horario» o «colores».'), links: [], suggestions };
  return { message: areas.length === 1 ? t('Eso lo encuentras aquí:') : t('Eso lo encuentras en alguno de estos lugares:'), links: areas.map((area) => area.id as HelpResult['links'][number]), suggestions: [] };
}
