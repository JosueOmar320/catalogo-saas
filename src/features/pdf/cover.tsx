import { Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { resolveBackground, type Background } from '@/lib/design/background';
import { mediaUrl } from '@/lib/utils/storage';
import { contactLine, PdfDecorations } from './chrome';
import type { PdfDoc } from './doc';
import { headingStyle, img, PdfBackground, PdfLogo, PdfOrnament, PdfPicture, PdfShapedPicture } from './primitives';

/**
 * Portada configurable: 7 composiciones × imagen, forma de imagen, fondo,
 * overlay, alineación, tamaño del título, colores, decoración y textos
 * (antetítulo, título, subtítulo, fecha, versión, texto adicional).
 */

function solid(color: string): Background {
  return resolveBackground({ ...resolveBackground(null), type: 'color', color } as Background);
}

export function PdfCover({ doc }: { doc: PdfDoc }) {
  const { t, settings, site } = doc;
  const c = settings.cover;
  const imageUrl = c.imageSource === 'none' ? null : c.imageSource === 'custom' ? mediaUrl(c.imagePath) : site.coverUrl;
  const hasImage = Boolean(img(doc, imageUrl));
  const layout = c.layout === 'fullImage' && !hasImage ? 'band' : c.layout;
  const W = t.pageWidth;
  const H = t.pageHeight;
  const center = c.align === 'center';

  // Fondo: el elegido, o uno según la composición.
  const background = settings.inkSaver ? resolveBackground(null) : c.background.type !== 'inherit' ? c.background : solid(t.colors.paper);
  const darkImage = layout === 'fullImage';
  const ink = c.textColor === 'light' ? '#FFFFFF' : c.textColor === 'dark' ? t.colors.heading : darkImage ? '#FFFFFF' : undefined;
  const muted = ink ? ink : t.colors.mutedText;

  const title = c.title || site.business.name;
  const subtitle = c.subtitle || site.business.slogan || '';
  const meta = [c.date, c.version].filter(Boolean).join('   ·   ');
  const contact = c.showContact ? contactLine(site) : '';
  const scale = { md: 1.1, lg: 1.45, xl: 1.8 }[c.titleSize];

  const texts = (color: string | undefined, mutedColor: string, opts: { center?: boolean; maxWidth?: number } = {}) => {
    const align: Style['textAlign'] = opts.center ?? center ? 'center' : 'left';
    return (
      <View style={{ alignItems: (opts.center ?? center) ? 'center' : 'flex-start', maxWidth: opts.maxWidth }}>
        {c.showLogo && layout !== 'centered' && layout !== 'framed' && <PdfLogo ctx={doc} url={site.business.logoUrl} size={48} />}
        {c.eyebrow && <Text style={{ fontSize: t.size.small, letterSpacing: 2.5, textTransform: 'uppercase', color: color ?? t.colors.accent, marginTop: 14, textAlign: align }}>{c.eyebrow}</Text>}
        <Text style={{ ...headingStyle(doc, t.size.h1 * scale, color), marginTop: c.eyebrow ? 6 : 14, textAlign: align }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: t.size.base * 1.3, color: mutedColor, marginTop: 8, textAlign: align, lineHeight: 1.35 }}>{subtitle}</Text>}
        {c.showDescription && site.business.description && <Text style={{ fontSize: t.size.base, color: color ?? t.colors.text, lineHeight: 1.5, marginTop: 14, maxWidth: 380, textAlign: align, opacity: color ? 0.9 : 1 }}>{site.business.description}</Text>}
        {c.extraText && <Text style={{ fontSize: t.size.small, color: mutedColor, lineHeight: 1.5, marginTop: 10, maxWidth: 380, textAlign: align }}>{c.extraText}</Text>}
        {meta && <Text style={{ fontSize: t.size.small, fontWeight: 700, color: color ?? t.colors.accent, marginTop: 14, letterSpacing: 1, textAlign: align }}>{meta}</Text>}
      </View>
    );
  };
  const contactText = (color: string, style: Style = {}) => (contact ? <Text style={{ fontSize: t.size.small, color, lineHeight: 1.5, textAlign: center ? 'center' : 'left', ...style }}>{contact}</Text> : null);

  let body;
  switch (layout) {
    case 'fullImage':
      body = (
        <View style={{ flex: 1 }}>
          <PdfPicture ctx={doc} url={imageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }} />
          <View style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, backgroundColor: c.background.overlay.opacity > 0 ? c.background.overlay.color : '#000000', opacity: c.background.overlay.opacity > 0 ? c.background.overlay.opacity / 100 : 0.45 }} />
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: t.margin * 1.3 }}>
            {texts(ink ?? '#FFFFFF', ink ?? '#FFFFFF')}
            {contactText(ink ?? '#FFFFFF', { marginTop: 22, opacity: 0.9 })}
          </View>
        </View>
      );
      break;
    case 'split':
      body = (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <PdfPicture ctx={doc} url={imageUrl} style={{ width: W * 0.5, height: H }} />
          <View style={{ flex: 1, padding: t.margin, justifyContent: 'center' }}>
            {texts(ink, muted)}
            {contactText(muted, { marginTop: 26 })}
          </View>
        </View>
      );
      break;
    case 'band': {
      const bandH = H * 0.6;
      const bandInk = ink ?? t.colors.onPrimary;
      const imgW = W * 0.42;
      body = (
        <View style={{ flex: 1 }}>
          <View style={{ height: bandH, backgroundColor: t.colors.primary, paddingHorizontal: t.margin * 1.2, paddingTop: t.margin * 1.2 }}>
            <PdfDecorations ctx={doc} corners={c.decoration} sparkles={c.sparkles} frame={false} color={t.colors.accent} width={W} height={bandH} />
            {texts(bandInk, bandInk, { center: false, maxWidth: hasImage ? W - imgW - t.margin * 2.6 : undefined })}
          </View>
          {hasImage && <PdfShapedPicture ctx={doc} url={imageUrl} width={imgW} height={imgW * (c.imageShape === 'arch' ? 1.3 : 1.15)} shape={c.imageShape} frame style={{ position: 'absolute', right: t.margin, top: bandH - imgW * 0.75 }} />}
          <View style={{ position: 'absolute', left: t.margin * 1.2, bottom: t.margin, right: hasImage ? imgW + t.margin * 2 : t.margin * 1.2 }}>{contactText(t.colors.mutedText)}</View>
        </View>
      );
      break;
    }
    case 'centered':
      body = (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.margin * 1.4 }}>
          {c.showLogo && <PdfLogo ctx={doc} url={site.business.logoUrl} size={64} />}
          <View style={{ marginTop: 18 }}><PdfOrnament ctx={doc} width={180} /></View>
          {texts(ink, muted, { center: true })}
          <View style={{ marginTop: 14 }}><PdfOrnament ctx={doc} width={180} /></View>
          {hasImage && <PdfShapedPicture ctx={doc} url={imageUrl} width={t.contentWidth * 0.75} height={H * 0.26} shape={c.imageShape === 'rect' ? 'rounded' : c.imageShape} style={{ marginTop: 24, alignSelf: 'center' }} />}
          {contactText(muted, { marginTop: 22, textAlign: 'center' })}
        </View>
      );
      break;
    case 'framed': {
      const inset = t.margin * 0.7;
      body = (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.margin * 1.6 }}>
          {hasImage && <PdfPicture ctx={doc} url={imageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, opacity: 0.22 }} />}
          <View style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, borderWidth: 0.8, borderColor: t.colors.accent }} />
          <View style={{ position: 'absolute', top: inset + 5, left: inset + 5, right: inset + 5, bottom: inset + 5, borderWidth: 0.4, borderColor: t.colors.accent }} />
          {c.showLogo && <PdfLogo ctx={doc} url={site.business.logoUrl} size={60} />}
          {texts(ink, t.colors.accent, { center: true })}
          <View style={{ marginTop: 16 }}><PdfOrnament ctx={doc} /></View>
          {contactText(muted, { position: 'absolute', bottom: inset + 22, left: inset + 20, right: inset + 20, textAlign: 'center' })}
        </View>
      );
      break;
    }
    case 'minimal':
      body = (
        <View style={{ flex: 1, justifyContent: 'center', padding: t.margin * 2, alignItems: center ? 'center' : 'flex-start' }}>
          {texts(ink, muted)}
          <View style={{ height: 0.6, width: 80, backgroundColor: t.colors.border, marginVertical: 18 }} />
          {contactText(muted, { position: 'absolute', bottom: t.margin, left: t.margin * 2, right: t.margin * 2 })}
        </View>
      );
      break;
    default:
      // imageTop
      body = (
        <View style={{ flex: 1 }}>
          {hasImage && <PdfPicture ctx={doc} url={imageUrl} style={{ width: W, height: H * 0.5 }} />}
          <View style={{ paddingHorizontal: t.margin * 1.3, paddingTop: hasImage ? 10 : H * 0.26, flex: 1 }}>
            {texts(ink, muted)}
            <View style={{ height: 2, width: 60, backgroundColor: t.colors.primary, marginTop: 18, alignSelf: center ? 'center' : 'flex-start' }} />
          </View>
          {contactText(muted, { paddingHorizontal: t.margin * 1.3, paddingBottom: t.margin })}
        </View>
      );
  }

  return (
    <>
      <PdfBackground ctx={doc} background={background} width={W} height={H} />
      {layout !== 'band' && <PdfDecorations ctx={doc} corners={c.decoration} sparkles={c.sparkles} frame={false} color={settings.decorations.color} width={W} height={H} />}
      {body}
    </>
  );
}
