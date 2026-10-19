import { msg } from '@/i18n/translate';

/**
 * Identidad del asistente. Centralizada para poder renombrarlo en un solo
 * lugar (ver nota de marca en docs/GARFIELD-AI.md).
 */
export const ASSISTANT = {
  name: 'Garfield AI',
  shortName: 'Garfield',
  // Se muestran con t() (el panel los traduce).
  tagline: msg('Tu asistente para construir el sitio'),
  greeting: msg('¡Hola! Soy Garfield AI 🐾 Puedo crear páginas, agregar y acomodar secciones, cambiar el diseño y configurar cómo se ven tus productos. Dime qué quieres hacer.'),
} as const;
