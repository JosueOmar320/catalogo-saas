import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { themeSchema } from '@/lib/design/theme';
import { navigationSchema } from '@/lib/site/navigation';
import { pageSchema } from '@/lib/site/pages';

/** Páginas por sitio (el builder y Garfield lo respetan; el servidor lo exige). */
export const MAX_SITE_PAGES = 30;

/** Payload del guardado del sitio. Sólo se envían las partes modificadas. */
export const saveSiteSchema = z
  .object({
    theme: themeSchema.optional(),
    navigation: navigationSchema.optional(),
    pages: z.array(pageSchema).min(1, msg('El sitio necesita al menos una página')).max(MAX_SITE_PAGES).optional(),
    deletedPageIds: z.array(z.uuid()).max(MAX_SITE_PAGES).default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.pages) return;
    if (value.pages.filter((p) => p.isHome).length !== 1) {
      ctx.addIssue({ code: 'custom', path: ['pages'], message: msg('Elige una página de inicio.') });
    }
    // La página de inicio siempre se ve: sin ella el sitio no tendría portada.
    if (value.pages.some((p) => p.isHome && !p.isPublished)) {
      ctx.addIssue({ code: 'custom', path: ['pages'], message: msg('La página de inicio debe estar publicada.') });
    }
    const slugs = new Set<string>();
    for (const page of value.pages) {
      // La dirección va en params: la Server Action traduce el mensaje con ella.
      if (slugs.has(page.slug)) ctx.addIssue({ code: 'custom', path: ['pages'], message: msg('Hay dos páginas con la dirección "{slug}".'), params: { slug: page.slug } });
      slugs.add(page.slug);
    }
  });

export type SaveSiteInput = z.input<typeof saveSiteSchema>;
