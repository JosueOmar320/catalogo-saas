/* eslint-disable jsx-a11y/alt-text -- <Image> de react-pdf no admite `alt`. */
import { Image, Text, View } from '@react-pdf/renderer';
import type { ComponentType } from 'react';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { resolveBackground, type Background } from '@/lib/design/background';
import type { PdfSettings, PdfTemplateId } from '@/lib/pdf/settings';
import { headingStyle, img, PdfBadges, PdfPicture, PdfPrice, type PdfContext } from './primitives';

/**
 * Plantillas de PDF. Cada una es una COMPOSICIÓN distinta (portada, títulos
 * de categoría y disposición de productos), no sólo otra paleta: todas usan
 * los colores, fuentes, logo y fondo del tema del sitio.
 * Agregar una plantilla = agregar su entrada en PDF_TEMPLATES y aquí.
 */
export type CoverData = {
  title: string;
  subtitle: string;
  description: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
  contactLine: string;
  background: Background;
  showLogo: boolean;
  showDescription: boolean;
  showContact: boolean;
};

export type ItemsProps = { ctx: PdfContext; items: CatalogItemView[]; settings: PdfSettings; categoryNames: Map<string, string> };
export type HeadingProps = { ctx: PdfContext; title: string; description?: string | null; index: number };
export type CoverProps = { ctx: PdfContext; cover: CoverData };

type PdfTemplate = {
  Cover: ComponentType<CoverProps>;
  Heading: ComponentType<HeadingProps>;
  Items: ComponentType<ItemsProps>;
  /** Fondo por defecto de la portada si el usuario no eligió uno. */
  coverBackground: (ctx: PdfContext) => Background;
};

const IMAGE_HEIGHT = { none: 0, sm: 70, md: 110, lg: 170 } as const;

function solid(color: string): Background {
  return resolveBackground({ ...resolveBackground(null), type: 'color', color } as Background);
}

/* ------------------------------------------------------------ Piezas compartidas */

function Logo({ ctx, url, size }: { ctx: PdfContext; url: string | null; size: number }) {
  const image = img(ctx, url);
  return image ? <Image src={image} style={{ width: size, height: size, objectFit: 'contain' }} /> : null;
}

function Meta({ ctx, item, settings, categoryNames, align }: { ctx: PdfContext; item: CatalogItemView; settings: PdfSettings; categoryNames: Map<string, string>; align?: 'center' }) {
  const parts = [
    settings.products.showCategory && item.categoryId ? categoryNames.get(item.categoryId) : null,
    settings.products.showSku && item.sku ? `Cód. ${item.sku}` : null,
    !item.isAvailable ? 'No disponible' : null,
  ].filter(Boolean);
  return parts.length ? <Text style={{ fontSize: ctx.t.size.tiny, color: ctx.t.colors.mutedText, marginTop: 2, textAlign: align }}>{parts.join(' · ')}</Text> : null;
}

function Desc({ ctx, item, settings, lines = 3, align }: { ctx: PdfContext; item: CatalogItemView; settings: PdfSettings; lines?: number; align?: 'center' }) {
  if (!settings.products.showDescription || !item.shortDescription) return null;
  return <Text style={{ fontSize: ctx.t.size.small, color: ctx.t.colors.mutedText, lineHeight: 1.4, marginTop: 2, maxLines: lines, textOverflow: 'ellipsis', textAlign: align }}>{item.shortDescription}</Text>;
}

/** Cuadrícula genérica de tarjetas; cada plantilla define la tarjeta. */
function Grid({ ctx, items, settings, children }: ItemsProps & { children: (item: CatalogItemView, width: number) => React.ReactNode }) {
  const columns = settings.products.columns;
  const gap = 12;
  const width = (ctx.t.contentWidth - gap * (columns - 1)) / columns;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((item) => (
        <View key={item.id} style={{ width }} wrap={false}>
          {children(item, width)}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------ Clásico */

const classic: PdfTemplate = {
  coverBackground: (ctx) => solid(ctx.t.colors.paper),
  Cover: ({ ctx, cover }) => {
    const { t } = ctx;
    const hasImage = Boolean(img(ctx, cover.imageUrl));
    return (
      <View style={{ flex: 1 }}>
        {hasImage && <PdfPicture ctx={ctx} url={cover.imageUrl} style={{ width: t.pageWidth, height: t.pageHeight * 0.5 }} />}
        <View style={{ paddingHorizontal: t.margin * 1.3, paddingTop: hasImage ? 28 : t.pageHeight * 0.28, flex: 1 }}>
          {cover.showLogo && <Logo ctx={ctx} url={cover.logoUrl} size={56} />}
          <Text style={{ ...headingStyle(ctx, t.size.h1 * 1.4), marginTop: 16 }}>{cover.title}</Text>
          {cover.subtitle && <Text style={{ fontSize: t.size.base * 1.3, color: t.colors.mutedText, marginTop: 8 }}>{cover.subtitle}</Text>}
          <View style={{ height: 2, width: 60, backgroundColor: t.colors.primary, marginVertical: 18 }} />
          {cover.showDescription && cover.description && <Text style={{ fontSize: t.size.base, color: t.colors.text, lineHeight: 1.5, maxWidth: 380 }}>{cover.description}</Text>}
        </View>
        {cover.showContact && cover.contactLine && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, paddingHorizontal: t.margin * 1.3, paddingBottom: t.margin }}>{cover.contactLine}</Text>}
      </View>
    );
  },
  Heading: ({ ctx, title, description }) => (
    <View style={{ marginBottom: 12, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: ctx.t.colors.primary }}>
      <Text style={headingStyle(ctx, ctx.t.size.h2)}>{title}</Text>
      {description && <Text style={{ fontSize: ctx.t.size.small, color: ctx.t.colors.mutedText, marginTop: 2 }}>{description}</Text>}
    </View>
  ),
  Items: (props) => {
    const { ctx, settings } = props;
    const h = IMAGE_HEIGHT[settings.products.imageSize];
    return (
      <Grid {...props}>
        {(item, width) => (
          <View style={{ backgroundColor: ctx.t.colors.surface, borderWidth: ctx.t.borderWidth, borderColor: ctx.t.colors.border, borderRadius: ctx.t.radius, overflow: 'hidden' }}>
            {h > 0 && <PdfPicture ctx={ctx} url={item.images[0]?.thumbUrl} style={{ width: '100%', height: Math.min(h, width * 0.95) }} />}
            <View style={{ padding: 8 }}>
              {settings.products.showBadges && <PdfBadges item={item} ctx={ctx} style={{ marginBottom: 4 }} />}
              <Text style={{ fontSize: ctx.t.size.base, fontWeight: 700, color: ctx.t.colors.heading }}>{item.name}</Text>
              <Desc {...props} item={item} />
              {settings.products.showPrice && <View style={{ marginTop: 4 }}><PdfPrice item={item} ctx={ctx} /></View>}
              <Meta {...props} item={item} />
            </View>
          </View>
        )}
      </Grid>
    );
  },
};

/* ------------------------------------------------------------ Moderno */

const modern: PdfTemplate = {
  coverBackground: (ctx) => solid(ctx.t.colors.primary),
  Cover: ({ ctx, cover }) => {
    const { t } = ctx;
    const ink = t.colors.onPrimary;
    const image = img(ctx, cover.imageUrl);
    return (
      <View style={{ flex: 1, padding: t.margin * 1.2, justifyContent: 'space-between' }}>
        {cover.showLogo ? <Logo ctx={ctx} url={cover.logoUrl} size={48} /> : <View />}
        {image && <Image src={image} style={{ width: '100%', height: t.pageHeight * 0.34, objectFit: 'cover', borderRadius: 18 }} />}
        <View>
          <Text style={{ fontSize: t.size.small, color: ink, opacity: 0.8, letterSpacing: 2, textTransform: 'uppercase' }}>Catálogo {new Date().getFullYear()}</Text>
          <Text style={{ ...headingStyle(ctx, t.size.h1 * 1.7, ink), marginTop: 8 }}>{cover.title}</Text>
          {cover.subtitle && <Text style={{ fontSize: t.size.base * 1.35, color: ink, opacity: 0.9, marginTop: 10, maxWidth: 400 }}>{cover.subtitle}</Text>}
          {cover.showContact && cover.contactLine && <Text style={{ fontSize: t.size.small, color: ink, opacity: 0.8, marginTop: 24 }}>{cover.contactLine}</Text>}
        </View>
      </View>
    );
  },
  Heading: ({ ctx, title, description }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ alignSelf: 'flex-start', fontSize: ctx.t.size.tiny, fontWeight: 700, color: ctx.t.colors.onAccent, backgroundColor: ctx.t.colors.accent, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Categoría</Text>
      <Text style={{ ...headingStyle(ctx, ctx.t.size.h2 * 1.15), marginTop: 6 }}>{title}</Text>
      {description && <Text style={{ fontSize: ctx.t.size.small, color: ctx.t.colors.mutedText, marginTop: 2 }}>{description}</Text>}
    </View>
  ),
  Items: (props) => {
    const { ctx, settings } = props;
    const h = IMAGE_HEIGHT[settings.products.imageSize];
    return (
      <Grid {...props}>
        {(item, width) => (
          <View style={{ backgroundColor: ctx.t.colors.surface, borderRadius: 12, padding: 6 }}>
            {h > 0 && <PdfPicture ctx={ctx} url={item.images[0]?.thumbUrl} style={{ width: '100%', height: Math.min(h, width * 0.9), borderRadius: 9 }} />}
            <View style={{ padding: 6 }}>
              {settings.products.showBadges && <PdfBadges item={item} ctx={ctx} style={{ marginBottom: 4 }} />}
              <Text style={{ ...headingStyle(ctx, ctx.t.size.base * 1.05), fontWeight: 700 }}>{item.name}</Text>
              <Desc {...props} item={item} lines={2} />
              {settings.products.showPrice && item.priceLabel && (
                <Text style={{ alignSelf: 'flex-start', marginTop: 6, fontFamily: ctx.t.fonts.price, fontWeight: 700, fontSize: ctx.t.size.base, color: ctx.t.colors.onAccent, backgroundColor: ctx.t.colors.accent, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 }}>{item.priceLabel}</Text>
              )}
              {settings.products.showPrice && !item.priceLabel && <PdfPrice item={item} ctx={ctx} />}
              <Meta {...props} item={item} />
            </View>
          </View>
        )}
      </Grid>
    );
  },
};

/* ------------------------------------------------------------ Editorial */

const editorial: PdfTemplate = {
  coverBackground: (ctx) => solid(ctx.t.colors.paper),
  Cover: ({ ctx, cover }) => {
    const { t } = ctx;
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <PdfPicture ctx={ctx} url={cover.imageUrl} style={{ width: t.pageWidth * 0.5, height: t.pageHeight }} />
        <View style={{ flex: 1, padding: t.margin, justifyContent: 'center' }}>
          {cover.showLogo && <Logo ctx={ctx} url={cover.logoUrl} size={40} />}
          <Text style={{ fontSize: t.size.tiny, letterSpacing: 3, color: t.colors.accent, marginTop: 20, textTransform: 'uppercase' }}>Edición {new Date().getFullYear()}</Text>
          <Text style={{ ...headingStyle(ctx, t.size.h1 * 1.3), marginTop: 10 }}>{cover.title}</Text>
          {cover.subtitle && <Text style={{ fontSize: t.size.base * 1.2, color: t.colors.mutedText, marginTop: 12, fontStyle: 'italic' }}>{cover.subtitle}</Text>}
          {cover.showDescription && cover.description && <Text style={{ fontSize: t.size.small, lineHeight: 1.6, color: t.colors.text, marginTop: 18 }}>{cover.description}</Text>}
          {cover.showContact && cover.contactLine && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, marginTop: 28, lineHeight: 1.6 }}>{cover.contactLine}</Text>}
        </View>
      </View>
    );
  },
  Heading: ({ ctx, title, description, index }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16, paddingBottom: 8, borderBottomWidth: 0.6, borderBottomColor: ctx.t.colors.border }}>
      <Text style={{ ...headingStyle(ctx, ctx.t.size.h1 * 1.3, ctx.t.colors.accent), lineHeight: 1 }}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={headingStyle(ctx, ctx.t.size.h2)}>{title}</Text>
        {description && <Text style={{ fontSize: ctx.t.size.small, color: ctx.t.colors.mutedText, marginTop: 2, fontStyle: 'italic' }}>{description}</Text>}
      </View>
    </View>
  ),
  Items: ({ ctx, items, settings, categoryNames }) => {
    const { t } = ctx;
    const h = Math.max(IMAGE_HEIGHT[settings.products.imageSize], 120);
    const twoUp = settings.products.columns >= 2;
    return (
      <View style={{ flexDirection: twoUp ? 'row' : 'column', flexWrap: 'wrap', gap: 16 }}>
        {items.map((item, i) => {
          // Filas alternadas (imagen izquierda/derecha) armadas en orden explícito: react-pdf no maneja bien row-reverse.
          const picture = settings.products.imageSize !== 'none' && (
            <PdfPicture key="img" ctx={ctx} url={item.images[0]?.thumbUrl} style={{ width: twoUp ? '100%' : t.contentWidth * 0.42, height: twoUp ? h * 0.9 : h }} />
          );
          const body = (
            <View key="body" style={{ flex: twoUp ? undefined : 1 }}>
              {settings.products.showBadges && <PdfBadges item={item} ctx={ctx} style={{ marginBottom: 4 }} />}
              <Text style={headingStyle(ctx, t.size.h3 * 1.1)}>{item.name}</Text>
              <Desc ctx={ctx} item={item} settings={settings} lines={5} />
              {settings.products.showPrice && <View style={{ marginTop: 6 }}><PdfPrice item={item} ctx={ctx} size={t.size.h3} /></View>}
              <Meta ctx={ctx} item={item} settings={settings} categoryNames={categoryNames} />
            </View>
          );
          return (
            <View key={item.id} wrap={false} style={{ flexDirection: twoUp ? 'column' : 'row', gap: 14, width: twoUp ? (t.contentWidth - 16) / 2 : '100%', alignItems: twoUp ? 'stretch' : 'center' }}>
              {twoUp || i % 2 === 0 ? [picture, body] : [body, picture]}
            </View>
          );
        })}
      </View>
    );
  },
};

/* ------------------------------------------------------------ Minimal */

const minimal: PdfTemplate = {
  coverBackground: (ctx) => solid(ctx.t.colors.paper),
  Cover: ({ ctx, cover }) => {
    const { t } = ctx;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.margin * 2 }}>
        {cover.showLogo && <Logo ctx={ctx} url={cover.logoUrl} size={52} />}
        <Text style={{ ...headingStyle(ctx, t.size.h1 * 1.2), marginTop: 22, textAlign: 'center' }}>{cover.title}</Text>
        <View style={{ height: 0.6, width: 80, backgroundColor: t.colors.border, marginVertical: 16 }} />
        {cover.subtitle && <Text style={{ fontSize: t.size.base, color: t.colors.mutedText, textAlign: 'center', letterSpacing: 1 }}>{cover.subtitle}</Text>}
        {cover.showContact && cover.contactLine && <Text style={{ position: 'absolute', bottom: t.margin, fontSize: t.size.tiny, color: t.colors.mutedText, textAlign: 'center' }}>{cover.contactLine}</Text>}
      </View>
    );
  },
  Heading: ({ ctx, title, description }) => (
    <View style={{ marginBottom: 8, marginTop: 4 }}>
      <Text style={{ fontSize: ctx.t.size.small, letterSpacing: 2.5, textTransform: 'uppercase', color: ctx.t.colors.heading, fontWeight: 700 }}>{title}</Text>
      {description && <Text style={{ fontSize: ctx.t.size.tiny, color: ctx.t.colors.mutedText, marginTop: 2 }}>{description}</Text>}
      <View style={{ height: 0.5, backgroundColor: ctx.t.colors.border, marginTop: 6 }} />
    </View>
  ),
  Items: ({ ctx, items, settings, categoryNames }) => {
    const { t } = ctx;
    const thumb = { none: 0, sm: 36, md: 52, lg: 72 }[settings.products.imageSize];
    return (
      <View>
        {items.map((item) => (
          <View key={item.id} wrap={false} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 0.4, borderBottomColor: t.colors.border, alignItems: 'center' }}>
            {thumb > 0 && <PdfPicture ctx={ctx} url={item.images[0]?.thumbUrl} style={{ width: thumb, height: thumb, borderRadius: t.radius * 0.6 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.size.base, color: t.colors.heading }}>{item.name}</Text>
              <Desc ctx={ctx} item={item} settings={settings} lines={2} />
              <Meta ctx={ctx} item={item} settings={settings} categoryNames={categoryNames} />
            </View>
            {settings.products.showPrice && <View style={{ width: 90 }}><PdfPrice item={item} ctx={ctx} align="right" size={t.size.base} /></View>}
          </View>
        ))}
      </View>
    );
  },
};

/* ------------------------------------------------------------ Lujo */

function Ornament({ ctx, width = 140 }: { ctx: PdfContext; width?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width, alignSelf: 'center' }}>
      <View style={{ flex: 1, height: 0.6, backgroundColor: ctx.t.colors.accent }} />
      <Text style={{ fontSize: 7, color: ctx.t.colors.accent }}>◆</Text>
      <View style={{ flex: 1, height: 0.6, backgroundColor: ctx.t.colors.accent }} />
    </View>
  );
}

const luxury: PdfTemplate = {
  coverBackground: (ctx) => solid(ctx.t.colors.paper),
  Cover: ({ ctx, cover }) => {
    const { t } = ctx;
    const inset = t.margin * 0.7;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {img(ctx, cover.imageUrl) && <PdfPicture ctx={ctx} url={cover.imageUrl} style={{ position: 'absolute', top: 0, left: 0, width: t.pageWidth, height: t.pageHeight, opacity: 0.25 }} />}
        <View style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, borderWidth: 0.8, borderColor: t.colors.accent }} />
        <View style={{ position: 'absolute', top: inset + 5, left: inset + 5, right: inset + 5, bottom: inset + 5, borderWidth: 0.4, borderColor: t.colors.accent }} />
        {cover.showLogo && <Logo ctx={ctx} url={cover.logoUrl} size={60} />}
        <Text style={{ ...headingStyle(ctx, t.size.h1 * 1.35, t.colors.heading), textAlign: 'center', textTransform: 'uppercase', letterSpacing: 4, marginTop: 20, maxWidth: t.pageWidth * 0.7 }}>{cover.title}</Text>
        <View style={{ marginVertical: 16 }}><Ornament ctx={ctx} /></View>
        {cover.subtitle && <Text style={{ fontSize: t.size.base, color: t.colors.accent, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' }}>{cover.subtitle}</Text>}
        {cover.showContact && cover.contactLine && <Text style={{ position: 'absolute', bottom: inset + 20, fontSize: t.size.tiny, color: t.colors.mutedText, letterSpacing: 1 }}>{cover.contactLine}</Text>}
      </View>
    );
  },
  Heading: ({ ctx, title, description }) => (
    <View style={{ alignItems: 'center', marginBottom: 16, marginTop: 6 }}>
      <Text style={{ ...headingStyle(ctx, ctx.t.size.h2), textTransform: 'uppercase', letterSpacing: 3, textAlign: 'center' }}>{title}</Text>
      <View style={{ marginTop: 6 }}><Ornament ctx={ctx} width={110} /></View>
      {description && <Text style={{ fontSize: ctx.t.size.small, color: ctx.t.colors.mutedText, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>{description}</Text>}
    </View>
  ),
  Items: (props) => {
    const { ctx, settings } = props;
    const h = IMAGE_HEIGHT[settings.products.imageSize];
    return (
      <Grid {...props}>
        {(item, width) => (
          <View style={{ borderWidth: 0.6, borderColor: ctx.t.colors.accent, padding: 8, alignItems: 'center' }}>
            {h > 0 && <PdfPicture ctx={ctx} url={item.images[0]?.thumbUrl} style={{ width: '100%', height: Math.min(h * 1.1, width) }} />}
            <Text style={{ ...headingStyle(ctx, ctx.t.size.base * 1.1), textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 8 }}>{item.name}</Text>
            <Desc {...props} item={item} lines={2} align="center" />
            {settings.products.showPrice && <View style={{ marginTop: 5 }}><PdfPrice item={item} ctx={ctx} color={ctx.t.colors.accent} align="center" /></View>}
            <Meta {...props} item={item} align="center" />
          </View>
        )}
      </Grid>
    );
  },
};

/* ------------------------------------------------------------ Menú */

const menu: PdfTemplate = {
  coverBackground: (ctx) => solid(ctx.t.colors.paper),
  Cover: ({ ctx, cover }) => {
    const { t } = ctx;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.margin * 1.4 }}>
        {cover.showLogo && <Logo ctx={ctx} url={cover.logoUrl} size={64} />}
        <View style={{ marginTop: 18 }}><Ornament ctx={ctx} width={180} /></View>
        <Text style={{ ...headingStyle(ctx, t.size.h1 * 1.5), textAlign: 'center', marginVertical: 12 }}>{cover.title}</Text>
        <Ornament ctx={ctx} width={180} />
        {cover.subtitle && <Text style={{ fontSize: t.size.base * 1.2, color: t.colors.mutedText, marginTop: 14, fontStyle: 'italic', textAlign: 'center' }}>{cover.subtitle}</Text>}
        {img(ctx, cover.imageUrl) && <PdfPicture ctx={ctx} url={cover.imageUrl} style={{ width: t.contentWidth * 0.8, height: t.pageHeight * 0.26, marginTop: 26, borderRadius: t.radius }} />}
        {cover.showContact && cover.contactLine && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 26, textAlign: 'center', lineHeight: 1.6 }}>{cover.contactLine}</Text>}
      </View>
    );
  },
  Heading: ({ ctx, title, description }) => (
    <View style={{ alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '80%' }}>
        <View style={{ flex: 1, height: 0.8, backgroundColor: ctx.t.colors.primary }} />
        <Text style={headingStyle(ctx, ctx.t.size.h2)}>{title}</Text>
        <View style={{ flex: 1, height: 0.8, backgroundColor: ctx.t.colors.primary }} />
      </View>
      {description && <Text style={{ fontSize: ctx.t.size.small, color: ctx.t.colors.mutedText, marginTop: 4, fontStyle: 'italic' }}>{description}</Text>}
    </View>
  ),
  Items: ({ ctx, items, settings }) => {
    const { t } = ctx;
    const columns = Math.min(settings.products.columns, 2);
    const gap = 24;
    const width = (t.contentWidth - gap * (columns - 1)) / columns;
    const thumb = { none: 0, sm: 32, md: 44, lg: 60 }[settings.products.imageSize];
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap: 10 }}>
        {items.map((item) => (
          <View key={item.id} wrap={false} style={{ width, flexDirection: 'row', gap: 8 }}>
            {thumb > 0 && <PdfPicture ctx={ctx} url={item.images[0]?.thumbUrl} style={{ width: thumb, height: thumb, borderRadius: thumb / 2 }} />}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base * 1.05, color: t.colors.heading }}>{item.name}</Text>
                <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: t.colors.border, borderStyle: 'dotted', marginBottom: 3 }} />
                {settings.products.showPrice && (
                  <Text style={{ fontFamily: t.fonts.price, fontWeight: 700, fontSize: t.size.base * 1.05, color: t.colors.price }}>{item.priceLabel ?? '—'}</Text>
                )}
              </View>
              {settings.products.showDescription && item.shortDescription && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, fontStyle: 'italic', marginTop: 1 }}>{item.shortDescription}</Text>}
              {settings.products.showBadges && <PdfBadges item={item} ctx={ctx} style={{ marginTop: 3 }} />}
            </View>
          </View>
        ))}
      </View>
    );
  },
};

export const PDF_TEMPLATE_COMPONENTS: Record<PdfTemplateId, PdfTemplate> = { classic, modern, editorial, minimal, luxury, menu };
