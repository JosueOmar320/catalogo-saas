import { z } from 'zod';
import { buildBackgroundSchema } from './background';
import { mix } from './color';
import { FONT_IDS, type FontId } from './fonts';
import { fieldFactory, hexColor } from './schema-utils';
import { CARD_STYLES, FOOTER_STYLES, HEADER_STYLES } from './styles-registry';
import { TYPE_ROLES, type TypeRole } from './type-roles';

export { TYPE_ROLES, type TypeRole };
export const TYPE_ROLE_LABELS: Record<TypeRole, string> = { h1: 'Título H1', h2: 'Título H2', h3: 'Título H3', body: 'Texto', small: 'Pequeño', label: 'Etiqueta', button: 'Botón' };

function typeRole(f: ReturnType<typeof fieldFactory>) {
  return z
    .object({
      size: f(z.number().int().min(0).max(120), 0),
      mobileSize: f(z.number().int().min(0).max(96), 0),
      weight: f(z.enum(['auto', '300', '400', '500', '600', '700', '800']), 'auto'),
      lineHeight: f(z.number().min(0).max(2.5), 0),
      letterSpacing: f(z.number().min(-0.1).max(0.4).nullable(), null),
      transform: f(z.enum(['auto', 'none', 'uppercase', 'capitalize']), 'auto'),
      font: f(z.enum(['auto', 'heading', 'body']), 'auto'),
    })
    .prefault({});
}

/**
 * Sistema de diseño del sitio (columna catalogs.theme, versión 2).
 *
 * Reglas de extensión:
 * - Todo campo nuevo DEBE tener default (los sitios existentes lo heredan).
 * - Cambios incompatibles: subir `version` y migrar en `parseTheme`.
 */
function buildThemeSchema(lenient: boolean) {
  const f = fieldFactory(lenient);
  const bool = (fallback: boolean) => f(z.boolean(), fallback);
  const badge = (label: string, color: string) =>
    z.object({ label: f(z.string().trim().min(1).max(20), label), color: f(hexColor, color) }).prefault({});

  return z.object({
    version: z.literal(2).default(2).catch(2),
    preset: f(z.string().max(40), 'minimal'),
    colors: z
      .object({
        primary: f(hexColor, '#1A1A1A'),
        secondary: f(hexColor, '#6B7280'),
        accent: f(hexColor, '#2F54D6'),
        background: f(hexColor, '#FFFFFF'),
        surface: f(hexColor, '#FFFFFF'),
        text: f(hexColor, '#1A1A1A'),
        mutedText: f(hexColor, '#6B6B6B'),
        border: f(hexColor, '#E5E5E5'),
        heading: f(hexColor, '#111111'),
        button: f(hexColor, '#1A1A1A'),
        buttonText: f(hexColor, '#FFFFFF'),
        price: f(hexColor, '#1A1A1A'),
        success: f(hexColor, '#1F8A4C'),
        warning: f(hexColor, '#B45309'),
        error: f(hexColor, '#C62828'),
      })
      .prefault({}),
    typography: z
      .object({
        bodyFont: f(z.enum(FONT_IDS), 'inter'),
        headingFont: f(z.enum(FONT_IDS), 'inter'),
        priceFont: f(z.enum(FONT_IDS), 'inter'),
        baseSize: f(z.number().int().min(14).max(20), 16),
        headingScale: f(z.enum(['sm', 'md', 'lg', 'xl']), 'md'),
        headingWeight: f(z.enum(['400', '500', '600', '700', '800']), '700'),
        lineHeight: f(z.number().min(1.2).max(2), 1.55),
        headingLetterSpacing: f(z.number().min(-0.05).max(0.2), -0.01),
        headingCase: f(z.enum(['none', 'uppercase']), 'none'),
        /** Ajustes por rol tipográfico. 0 / "auto" = derivado de la escala y de las opciones generales. */
        roles: z
          .object(Object.fromEntries(TYPE_ROLES.map((role) => [role, typeRole(f)])) as Record<TypeRole, ReturnType<typeof typeRole>>)
          .prefault({}),
      })
      .prefault({}),
    spacing: z
      .object({
        sectionPadding: f(z.enum(['compact', 'normal', 'relaxed', 'spacious']), 'normal'),
        gap: f(z.enum(['tight', 'normal', 'loose']), 'normal'),
        maxWidth: f(z.enum(['narrow', 'normal', 'wide', 'full']), 'normal'),
        titleSpacing: f(z.enum(['sm', 'md', 'lg']), 'md'),
      })
      .prefault({}),
    shape: z
      .object({
        radius: f(z.number().int().min(0).max(28), 8),
        borderWidth: f(z.number().int().min(0).max(3), 1),
        shadow: f(z.enum(['none', 'soft', 'medium', 'strong']), 'none'),
      })
      .prefault({}),
    buttons: z
      .object({
        style: f(z.enum(['solid', 'outline', 'soft', 'ghost']), 'solid'),
        shape: f(z.enum(['square', 'rounded', 'pill']), 'rounded'),
        size: f(z.enum(['sm', 'md', 'lg']), 'md'),
        shadow: bool(false),
        hover: f(z.enum(['darken', 'lift', 'grow', 'none']), 'darken'),
        uppercase: bool(false),
      })
      .prefault({}),
    background: buildBackgroundSchema(lenient, { type: 'color', color: '#FFFFFF' }).prefault({ type: 'color', color: '#FFFFFF' }),
    header: z
      .object({
        style: f(z.enum(HEADER_STYLES), 'classic'),
        logoPosition: f(z.enum(['left', 'center']), 'left'),
        menuPosition: f(z.enum(['left', 'center', 'right']), 'right'),
        sticky: bool(true),
        height: f(z.enum(['compact', 'normal', 'tall']), 'normal'),
        showLogo: bool(true),
        showName: bool(true),
        showSocial: bool(false),
        cta: f(z.enum(['none', 'contact', 'whatsapp']), 'whatsapp'),
        ctaLabel: f(z.string().trim().max(30), 'Contáctanos'),
        background: buildBackgroundSchema(lenient).prefault({}),
      })
      .prefault({}),
    footer: z
      .object({
        style: f(z.enum(FOOTER_STYLES), 'columns'),
        showContact: bool(true),
        showHours: bool(true),
        showSocial: bool(true),
        showNav: bool(true),
        customText: f(z.string().max(500), ''),
        background: buildBackgroundSchema(lenient).prefault({}),
      })
      .prefault({}),
    cards: z
      .object({
        style: f(z.enum(CARD_STYLES), 'classic'),
        imagePosition: f(z.enum(['top', 'side', 'overlay', 'circle']), 'top'),
        imageRatio: f(z.enum(['square', 'portrait', 'landscape', 'wide']), 'square'),
        align: f(z.enum(['left', 'center']), 'left'),
        showPrice: bool(true),
        showDescription: bool(true),
        showCategory: bool(false),
        showBadges: bool(true),
        showAvailability: bool(true),
        showSku: bool(false),
        button: f(z.enum(['none', 'solid', 'link', 'icon']), 'solid'),
        hover: f(z.enum(['none', 'lift', 'zoom', 'shadow']), 'zoom'),
      })
      .prefault({}),
    badges: z
      .object({
        style: f(z.enum(['solid', 'soft', 'outline']), 'solid'),
        shape: f(z.enum(['pill', 'square']), 'pill'),
        position: f(z.enum(['top-left', 'top-right', 'bottom-left']), 'top-left'),
        autoFeatured: bool(false),
        autoSale: bool(true),
        autoSoldOut: bool(true),
        new: badge('Nuevo', '#2F54D6'),
        featured: badge('Destacado', '#B45309'),
        sale: badge('Oferta', '#DC2626'),
        popular: badge('Popular', '#7C3AED'),
        soldOut: badge('Agotado', '#52525B'),
      })
      .prefault({}),
  });
}

/** Estricto: formularios y Server Actions. */
export const themeSchema = buildThemeSchema(false);
/** Tolerante: renderizado (nunca falla). */
const lenientThemeSchema = buildThemeSchema(true);

export type ThemeConfig = z.output<typeof themeSchema>;
export type ThemeInput = z.input<typeof themeSchema>;

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === 'object' ? (value as Json) : {});
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const isHexStr = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

/** Convierte un tema v1 (8 colores, layouts de lista) a v2 sin perder decisiones del usuario. */
export function migrateThemeV1(raw: Json): ThemeInput {
  const colors = obj(raw.colors);
  const typography = obj(raw.typography);
  const layout = obj(raw.layout);
  const card = obj(raw.card);
  const header = obj(raw.header);
  const footer = obj(raw.footer);
  const text = isHexStr(colors.text) ? colors.text : '#1A1A1A';
  const background = isHexStr(colors.background) ? colors.background : '#FFFFFF';
  const radius = { square: 0, soft: 8, round: 16 }[str(layout.corners) ?? 'soft'] ?? 8;

  return {
    version: 2,
    preset: str(raw.preset) ?? 'minimal',
    colors: {
      primary: isHexStr(colors.primary) ? colors.primary : undefined,
      secondary: isHexStr(colors.secondary) ? colors.secondary : undefined,
      accent: isHexStr(colors.primary) ? colors.primary : undefined,
      background,
      surface: isHexStr(colors.surface) ? colors.surface : undefined,
      text,
      heading: text,
      mutedText: mix(text, background, 0.62),
      border: mix(text, background, 0.14),
      button: isHexStr(colors.button) ? colors.button : undefined,
      buttonText: isHexStr(colors.buttonText) ? colors.buttonText : undefined,
      price: isHexStr(colors.price) ? colors.price : undefined,
    },
    typography: {
      bodyFont: (str(typography.body) as FontId) ?? undefined,
      headingFont: (str(typography.heading) as FontId) ?? undefined,
      priceFont: (str(typography.body) as FontId) ?? undefined,
      baseSize: { sm: 15, md: 16, lg: 17 }[str(typography.scale) ?? 'md'] ?? 16,
    },
    shape: { radius },
    buttons: { shape: radius === 0 ? 'square' : radius >= 16 ? 'pill' : 'rounded' },
    background: { type: 'color', color: background },
    header: {
      style: header.style === 'compact' ? 'classic' : 'minimal',
      showLogo: header.showLogo as boolean | undefined,
      showName: header.showName as boolean | undefined,
      showSocial: header.showSocial as boolean | undefined,
      cta: header.showContactButton === false ? 'none' : 'whatsapp',
    },
    footer: {
      showContact: footer.showContact as boolean | undefined,
      showHours: footer.showHours as boolean | undefined,
      showSocial: footer.showSocial as boolean | undefined,
      customText: str(footer.customText),
    },
    cards: {
      style: layout.variant === 'showcase' ? 'borderless' : 'classic',
      imageRatio: (str(layout.imageRatio) as 'square' | 'portrait' | 'landscape') ?? 'square',
      showPrice: card.showPrice as boolean | undefined,
      showDescription: card.showDescription as boolean | undefined,
      showCategory: card.showCategory as boolean | undefined,
      showSku: card.showSku as boolean | undefined,
      showAvailability: card.showAvailability as boolean | undefined,
      button: card.showContactButton === false ? 'none' : 'solid',
    },
  };
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Json)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    );
  }
  return value;
}

/** Lee cualquier versión guardada y devuelve un tema v2 completo y válido. */
export function parseTheme(raw: unknown): ThemeConfig {
  const value = obj(raw);
  const input = value.version === 2 ? value : Object.keys(value).length ? migrateThemeV1(value) : {};
  return lenientThemeSchema.parse(stripUndefined(input));
}

export const DEFAULT_THEME: ThemeConfig = parseTheme({ version: 2 });
