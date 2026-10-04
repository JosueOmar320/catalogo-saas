import { z } from 'zod';
import { assistantActionSchema, parseActions, type AssistantAction } from './actions';
import type { AssistantMode } from './context';
import { parsePdfActions, pdfActionSchema, type PdfAction } from './pdf-actions';

/**
 * Garfield trabaja en dos modos con catálogos de acciones distintos:
 * - site: editor del sitio (páginas, secciones, tema, menú, productos…)
 * - pdf: estudio de PDF (plantilla, portada, encabezado, pie, bloques…)
 * "Agrega un encabezado" significa cosas diferentes en cada uno.
 */
export type AnyAction = AssistantAction | PdfAction;

export function actionSchemaFor(mode: AssistantMode): z.ZodType {
  return mode === 'pdf' ? pdfActionSchema : assistantActionSchema;
}

export function responseSchemaFor(mode: AssistantMode) {
  return z.object({
    message: z.string().max(2000).describe('Respuesta breve y amable en español, en la voz de Garfield.'),
    actions: z.array(actionSchemaFor(mode)).max(40).describe('Acciones a ejecutar. Vacío si sólo conversas o necesitas preguntar algo.'),
    suggestions: z.array(z.string().max(60)).max(4).describe('Hasta 4 siguientes pasos cortos que el usuario podría pedir.'),
  });
}

export function parseModeActions(mode: AssistantMode, raw: unknown): { actions: AnyAction[]; errors: string[] } {
  return mode === 'pdf' ? parsePdfActions(raw) : parseActions(raw);
}
