import { z } from 'zod';
import { buildBackgroundSchema } from '@/lib/design/background';
import { fieldFactory } from '@/lib/design/schema-utils';
import { parseSections, sectionSchema, type Section } from './section-schemas';

export const PAGE_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/;
export const RESERVED_PAGE_SLUGS = ['p'];

export const PAGE_TEMPLATES = ['home', 'products', 'services', 'about', 'contact', 'gallery', 'promotions', 'custom'] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

function buildPageParts(lenient: boolean) {
  const f = fieldFactory(lenient);
  const style = z
    .object({
      background: buildBackgroundSchema(lenient).prefault({}),
    })
    .prefault({});
  const seo = z
    .object({
      title: f(z.string().trim().max(70), ''),
      description: f(z.string().trim().max(160), ''),
      ogImagePath: f(z.string().max(300).nullable(), null),
      noindex: f(z.boolean(), false),
    })
    .prefault({});
  return { style, seo };
}

const strictParts = buildPageParts(false);
const lenientParts = buildPageParts(true);

export const pageStyleSchema = strictParts.style;
export const pageSeoSchema = strictParts.seo;
export type PageStyle = z.output<typeof pageStyleSchema>;
export type PageSeo = z.output<typeof pageSeoSchema>;

/** Página tal como la edita el builder y la guarda save_site. */
export const pageSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, 'Escribe un nombre').max(80),
  slug: z
    .string()
    .regex(PAGE_SLUG_PATTERN, 'Usa letras minúsculas, números y guiones')
    .refine((s) => !RESERVED_PAGE_SLUGS.includes(s), 'Esa dirección está reservada'),
  template: z.enum(PAGE_TEMPLATES).default('custom'),
  isHome: z.boolean(),
  isPublished: z.boolean(),
  sections: z.array(sectionSchema).max(40),
  style: pageStyleSchema,
  seo: pageSeoSchema,
});

export type SitePage = z.output<typeof pageSchema>;

type PageRow = {
  id: string;
  title: string;
  slug: string;
  template: string;
  is_home: boolean;
  is_published: boolean;
  sections: unknown;
  style: unknown;
  seo: unknown;
};

/** Convierte una fila de la BD (o del RPC público) en página tolerante a datos viejos. */
export function pageFromRow(row: PageRow): SitePage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    template: (PAGE_TEMPLATES as readonly string[]).includes(row.template) ? (row.template as PageTemplate) : 'custom',
    isHome: row.is_home,
    isPublished: row.is_published,
    sections: parseSections(row.sections),
    style: lenientParts.style.parse(row.style ?? {}),
    seo: lenientParts.seo.parse(row.seo ?? {}),
  };
}

export function pageToRow(page: SitePage) {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    template: page.template,
    is_home: page.isHome,
    is_published: page.isPublished,
    sections: page.sections,
    style: page.style,
    seo: page.seo,
  };
}

export function findHome(pages: SitePage[]): SitePage | undefined {
  return pages.find((p) => p.isHome) ?? pages[0];
}

export function newPage(title: string, slug: string, sections: Section[], template: PageTemplate = 'custom', id: string = crypto.randomUUID()): SitePage {
  return {
    id,
    title,
    slug,
    template,
    isHome: false,
    isPublished: true,
    sections,
    style: pageStyleSchema.parse({}),
    seo: pageSeoSchema.parse({}),
  };
}
