/**
 * Jerarquía tipográfica: cada rol puede ajustarse sin romper la escala del tema.
 * Sin zod: `tokens.ts` lo usa en el navegador. `theme.ts` lo re-exporta.
 */
export const TYPE_ROLES = ['h1', 'h2', 'h3', 'body', 'small', 'label', 'button'] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];
