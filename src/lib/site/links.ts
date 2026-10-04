import type { BusinessContact } from '@/lib/business/profile';
import { digitsOnly } from '@/lib/utils/phone';
import type { LinkTarget } from './section-schemas';
import type { SitePage } from './pages';

/**
 * Contexto para resolver enlaces. `basePath` es la raíz del sitio:
 *   público → "/catalogo/mi-negocio"   ·   vista previa → "/preview"
 */
export type LinkContext = {
  basePath: string;
  pages: Pick<SitePage, 'id' | 'slug' | 'isHome'>[];
  contact: BusinessContact;
  businessName: string;
};

export function pagePath(basePath: string, page: Pick<SitePage, 'slug' | 'isHome'>): string {
  return page.isHome ? basePath || '/' : `${basePath}/${page.slug}`;
}

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

/** Devuelve el href final de un destino, o null si no se puede resolver (p. ej. sin WhatsApp). */
export function resolveLink(target: LinkTarget, ctx: LinkContext): { href: string; external: boolean; pageId?: string } | null {
  switch (target.kind) {
    case 'page': {
      const page = ctx.pages.find((p) => p.id === target.pageId);
      return page ? { href: pagePath(ctx.basePath, page), external: false, pageId: page.id } : null;
    }
    case 'url': {
      const url = target.url.trim();
      if (!url || !SAFE_URL.test(url)) return null;
      return { href: url, external: target.newTab || /^https?:/i.test(url) };
    }
    case 'whatsapp': {
      const number = digitsOnly(ctx.contact.whatsapp).replace('+', '');
      if (!number) return null;
      const text = target.message.trim() || `Hola ${ctx.businessName}, quisiera más información.`;
      return { href: `https://wa.me/${number}?text=${encodeURIComponent(text)}`, external: true };
    }
    case 'phone': {
      const number = digitsOnly(ctx.contact.phone || ctx.contact.whatsapp);
      return number ? { href: `tel:${number}`, external: false } : null;
    }
    case 'email':
      return ctx.contact.email ? { href: `mailto:${ctx.contact.email}`, external: false } : null;
    default:
      return null;
  }
}
