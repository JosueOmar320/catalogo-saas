import { Text, View } from '@react-pdf/renderer';
import { resolveCollection } from '@/lib/catalog/collections';
import { presentation } from '@/lib/catalog/presentation';
import { resolveBackground } from '@/lib/design/background';
import { contrastRatio } from '@/lib/design/color';
import type { PdfBlock, PdfBlockOf } from '@/lib/pdf/settings';
import { mediaUrl } from '@/lib/utils/storage';
import { contactLine, socialHandle } from './chrome';
import type { PdfDoc } from './doc';
import { headingStyle, PdfBackground, PdfLogo, PdfPicture, PdfRichText } from './primitives';
import { productRows } from './products';

/**
 * Páginas "de diseño" del PDF: imagen, promocional y contraportada. Las que
 * ocupan una página entera se dibujan en su propia <Page> (fondo propio, sin
 * encabezado ni pie); la imagen a media página o un tercio va en el flujo.
 */

/** ¿El bloque es una página entera (con su propio fondo)? */
export function isStandalonePage(block: PdfBlock): boolean {
  return (block.type === 'image' && block.size === 'full') || block.type === 'promo' || block.type === 'backCover';
}

const lightInk = '#FFFFFF';

/* ------------------------------------------------------------ Imagen */

export function ImagePageBlock({ doc, block, standalone }: { doc: PdfDoc; block: PdfBlockOf<'image'>; standalone: boolean }) {
  const { t } = doc;
  const url = mediaUrl(block.imagePath);
  const width = standalone ? t.pageWidth : t.contentWidth;
  const height = standalone ? t.pageHeight : (t.pageHeight - t.margin * 2 - t.headerSpace - t.footerSpace) * (block.size === 'half' ? 0.5 : 0.34);
  const hasText = block.textPosition !== 'none' && Boolean(block.title || block.subtitle);
  const text = hasText && (
    <View style={{ position: 'absolute', left: standalone ? t.margin : 16, right: standalone ? t.margin : 16, ...(block.textPosition === 'top' ? { top: standalone ? t.margin * 1.4 : 16 } : block.textPosition === 'center' ? { top: height / 2 - 40 } : { bottom: standalone ? t.margin * 1.4 : 16 }), alignItems: block.textPosition === 'center' ? 'center' : 'flex-start' }}>
      {block.title && <Text style={{ ...headingStyle(doc, standalone ? t.size.h1 * 1.15 : t.size.h2, lightInk), textAlign: block.textPosition === 'center' ? 'center' : 'left' }}>{block.title}</Text>}
      {block.subtitle && <Text style={{ fontSize: t.size.base * 1.1, color: lightInk, marginTop: 6, opacity: 0.92, textAlign: block.textPosition === 'center' ? 'center' : 'left' }}>{block.subtitle}</Text>}
    </View>
  );
  return (
    <View wrap={false}>
      <View style={{ width, height, overflow: 'hidden', borderRadius: standalone ? 0 : t.radius, backgroundColor: t.colors.soft }}>
        <PdfPicture ctx={doc} url={url} style={{ position: 'absolute', top: 0, left: 0, width, height, objectFit: block.fit }} />
        {hasText && block.overlay > 0 && <View style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: '#000000', opacity: block.overlay / 100 }} />}
        {text}
      </View>
      {block.caption && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, marginTop: 5, textAlign: 'center' }}>{block.caption}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------ Promocional */

export function PromoPageBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'promo'> }) {
  const { t } = doc;
  const bg = doc.settings.inkSaver ? resolveBackground(null) : block.background.type === 'inherit' ? resolveBackground({ ...block.background, type: 'color', color: t.colors.soft }) : block.background;
  const base = bg.type === 'color' ? bg.color : bg.type === 'gradient' ? bg.gradient.from : t.colors.paper;
  const darkBg = bg.type === 'image' || contrastRatio(base, '#FFFFFF') > 4.5;
  const ink = darkBg ? lightInk : t.colors.heading;
  const muted = darkBg ? '#F2F2F2' : t.colors.mutedText;
  const url = mediaUrl(block.imagePath);
  const items = block.collection.limit > 0 ? resolveCollection(block.collection, doc.items).slice(0, block.collection.limit) : [];
  const inner = t.pageWidth - t.margin * 2;
  const split = block.layout === 'split' && url;
  const fullImage = block.layout === 'fullImage' && url;

  const copy = (
    <View style={{ flex: split ? 1 : undefined, alignItems: block.layout === 'centered' ? 'center' : 'flex-start', gap: 8 }}>
      {block.badge && (
        <Text style={{ alignSelf: block.layout === 'centered' ? 'center' : 'flex-start', fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.h2, color: t.colors.onAccent, backgroundColor: t.colors.accent, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 30 }}>{block.badge}</Text>
      )}
      {block.eyebrow && <Text style={{ fontSize: t.size.small, letterSpacing: 2.5, textTransform: 'uppercase', color: fullImage ? lightInk : t.colors.accent }}>{block.eyebrow}</Text>}
      {block.title && <Text style={{ ...headingStyle(doc, t.size.h1 * 1.25, fullImage ? lightInk : ink), textAlign: block.layout === 'centered' ? 'center' : 'left' }}>{block.title}</Text>}
      {block.subtitle && <Text style={{ fontSize: t.size.base * 1.2, color: fullImage ? lightInk : muted, lineHeight: 1.4, textAlign: block.layout === 'centered' ? 'center' : 'left' }}>{block.subtitle}</Text>}
      {block.body && <PdfRichText source={block.body} ctx={doc} color={fullImage ? lightInk : ink} />}
      {block.cta && (
        <Text style={{ marginTop: 6, fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base * 1.05, color: t.colors.buttonText, backgroundColor: t.colors.button, paddingVertical: 8, paddingHorizontal: 18, borderRadius: Math.max(4, t.radius) }}>{block.cta}</Text>
      )}
    </View>
  );

  return (
    <View style={{ width: t.pageWidth, height: t.pageHeight, padding: fullImage ? 0 : t.margin * 1.2, justifyContent: 'center' }}>
      <PdfBackground ctx={doc} background={bg} width={t.pageWidth} height={t.pageHeight} />
      {fullImage ? (
        <>
          <PdfPicture ctx={doc} url={url} style={{ position: 'absolute', top: 0, left: 0, width: t.pageWidth, height: t.pageHeight }} />
          <View style={{ position: 'absolute', top: 0, left: 0, width: t.pageWidth, height: t.pageHeight, backgroundColor: '#000000', opacity: 0.45 }} />
          <View style={{ padding: t.margin * 1.4 }}>{copy}</View>
        </>
      ) : split ? (
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
          {copy}
          <PdfPicture ctx={doc} url={url} style={{ width: inner * 0.46, height: inner * 0.6, borderRadius: t.radius * 1.5 }} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 18 }}>
          {url && <PdfPicture ctx={doc} url={url} style={{ width: inner * 0.7, height: inner * 0.45, borderRadius: t.radius * 1.5 }} />}
          {copy}
        </View>
      )}
      {items.length > 0 && !fullImage && <View style={{ marginTop: 26 }}>{productRows(doc, items, presentation({ layout: 'grid', columns: { desktop: 4, tablet: 3, mobile: 2, pdf: Math.min(4, items.length) }, fields: { discount: true, description: false } }), inner)}</View>}
    </View>
  );
}

/* ------------------------------------------------------------ Contraportada */

export function BackCoverBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'backCover'> }) {
  const { t, site } = doc;
  const bg = doc.settings.inkSaver ? resolveBackground(null) : block.background.type === 'inherit' ? resolveBackground({ ...block.background, type: 'color', color: t.colors.primary }) : block.background;
  const base = bg.type === 'color' ? bg.color : bg.type === 'gradient' ? bg.gradient.from : t.colors.paper;
  const ink = bg.type === 'image' || contrastRatio(base, '#FFFFFF') > 3 ? lightInk : t.colors.heading;
  const contact = contactLine(site);
  const handle = socialHandle(site);
  return (
    <View style={{ width: t.pageWidth, height: t.pageHeight, alignItems: 'center', justifyContent: 'center', padding: t.margin * 1.5, gap: 12 }}>
      <PdfBackground ctx={doc} background={bg} width={t.pageWidth} height={t.pageHeight} />
      {block.showLogo && <PdfLogo ctx={doc} url={site.business.logoUrl} size={70} />}
      <Text style={{ ...headingStyle(doc, t.size.h1, ink), textAlign: 'center' }}>{block.title}</Text>
      {block.message && <Text style={{ fontSize: t.size.base * 1.15, color: ink, opacity: 0.9, textAlign: 'center', maxWidth: t.pageWidth * 0.62, lineHeight: 1.45 }}>{block.message}</Text>}
      <View style={{ height: 1, width: 60, backgroundColor: ink, opacity: 0.5, marginVertical: 8 }} />
      <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.h3, color: ink }}>{site.business.name}</Text>
      {block.showContact && contact && <Text style={{ fontSize: t.size.small, color: ink, opacity: 0.88, textAlign: 'center' }}>{contact}</Text>}
      {block.showSocial && handle && <Text style={{ fontSize: t.size.small, color: ink, opacity: 0.88 }}>{handle}</Text>}
    </View>
  );
}
