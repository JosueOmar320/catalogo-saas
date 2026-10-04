/* eslint-disable jsx-a11y/alt-text -- <Image> de react-pdf no admite `alt`. */
import { Image, Link, Text, View } from '@react-pdf/renderer';
import { resolveBackground } from '@/lib/design/background';
import type { PdfBlockOf } from '@/lib/pdf/settings';
import { resolveLink } from '@/lib/site/links';
import { parseVideoUrl } from '@/lib/site/video';
import { heroText, resolveSectionItems, resolveTextMode } from '@/lib/site/resolve';
import type { ColumnBlock, Section } from '@/lib/site/section-schemas';
import { mediaUrl } from '@/lib/utils/storage';
import { CatalogBlock, ContactBlock } from './blocks';
import type { PdfDoc } from './doc';
import { headingStyle, img, PdfBackground, PdfIcon, PdfPicture, PdfRichText, PdfShapedPicture } from './primitives';
import { productRows } from './products';

/**
 * Una página del sitio adaptada a impresión: cada sección tiene su versión
 * PDF (el hero se vuelve un encabezado, la galería una grilla, etc.). Es la
 * forma de crear páginas "personalizadas" del PDF con el mismo sistema de
 * secciones de la web.
 */
export function PageBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'page'> }) {
  const page = doc.site.pages.find((p) => p.id === block.pageId);
  if (!page) return null;
  return (
    <View>
      {page.sections.filter((s) => s.visible).map((section) => (
        <View key={section.id} style={{ marginBottom: 16 }}>
          <PdfSection section={section} doc={doc} />
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ ctx, title, subtitle, color }: { ctx: PdfDoc; title?: string; subtitle?: string; color?: string }) {
  if (!title && !subtitle) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      {title && <Text style={headingStyle(ctx, ctx.t.size.h2, color)}>{title}</Text>}
      {subtitle && <Text style={{ fontSize: ctx.t.size.base, color: color ?? ctx.t.colors.mutedText, marginTop: 3, opacity: color ? 0.85 : 1 }}>{subtitle}</Text>}
    </View>
  );
}

function PdfSection({ section, doc }: { section: Section; doc: PdfDoc }) {
  const ctx = doc;
  const { t, settings, site } = doc;
  const bg = settings.inkSaver ? resolveBackground(null) : section.style.background;
  const textMode = settings.inkSaver ? null : resolveTextMode(section.style.textColor, bg, site.theme);
  const ink = textMode === 'light' ? '#FFFFFF' : undefined;

  switch (section.type) {
    case 'hero': {
      const text = heroText(section.content, site);
      const height = { sm: 130, md: 180, lg: 230, screen: 260 }[section.content.height];
      return (
        <View wrap={false} style={{ height, justifyContent: 'center', padding: 20, borderRadius: t.radius, overflow: 'hidden', alignItems: section.content.layout === 'centered' ? 'center' : 'flex-start' }}>
          <PdfBackground ctx={ctx} background={bg.type === 'inherit' ? resolveBackground({ ...bg, type: 'color', color: t.colors.soft }) : bg} width={t.contentWidth} height={height} />
          {text.eyebrow && <Text style={{ fontSize: t.size.tiny, letterSpacing: 2, textTransform: 'uppercase', color: ink ?? t.colors.accent, marginBottom: 6 }}>{text.eyebrow}</Text>}
          <Text style={{ ...headingStyle(ctx, t.size.h1, ink), textAlign: section.content.layout === 'centered' ? 'center' : 'left' }}>{text.title}</Text>
          {text.subtitle && <Text style={{ fontSize: t.size.base * 1.15, color: ink ?? t.colors.mutedText, marginTop: 6, textAlign: section.content.layout === 'centered' ? 'center' : 'left' }}>{text.subtitle}</Text>}
        </View>
      );
    }
    case 'text': {
      const image = section.content.imagePosition !== 'none' ? mediaUrl(section.content.image.path) : null;
      const side = image && (section.content.imagePosition === 'left' || section.content.imagePosition === 'right');
      return (
        <View style={{ flexDirection: side ? (section.content.imagePosition === 'left' ? 'row-reverse' : 'row') : 'column', gap: 16 }}>
          <View style={{ flex: 1 }}>
            {section.content.eyebrow && <Text style={{ fontSize: t.size.tiny, letterSpacing: 2, textTransform: 'uppercase', color: t.colors.accent, marginBottom: 4 }}>{section.content.eyebrow}</Text>}
            <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
            {section.content.body && <PdfRichText source={section.content.body} ctx={ctx} />}
          </View>
          {image && <PdfPicture ctx={ctx} url={image} style={{ width: side ? t.contentWidth * 0.4 : '100%', height: side ? 170 : 200, borderRadius: t.radius }} />}
        </View>
      );
    }
    case 'products':
    case 'services': {
      const list = resolveSectionItems(section.content, doc.items);
      if (!list.length) return null;
      const [first, ...rest] = productRows(doc, list, section.content.presentation);
      return (
        <View>
          <View wrap={false}>
            <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
            {first}
          </View>
          {rest}
        </View>
      );
    }
    case 'catalog':
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <CatalogBlock doc={doc} block={sectionCatalogBlock(section)} />
        </View>
      );
    case 'categories': {
      const list = site.categories.filter((c) => !section.content.categoryIds.length || section.content.categoryIds.includes(c.id));
      return (
        <View wrap={false}>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {list.map((c) => (
              <View key={c.id} style={{ width: (t.contentWidth - 20) / 3, padding: 10, borderWidth: 0.6, borderColor: t.colors.border, borderRadius: t.radius }}>
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: t.colors.heading }}>{c.name}</Text>
                {c.description && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, marginTop: 2 }}>{c.description}</Text>}
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'banner': {
      const color = bg.type === 'inherit' ? t.colors.primary : undefined;
      const bannerInk = color ? t.colors.onPrimary : ink;
      const target = resolveLink(section.content.button.link, { basePath: site.url, pages: site.pages, contact: site.business.contact, businessName: site.business.name });
      return (
        <View wrap={false} style={{ padding: 22, borderRadius: t.radius, overflow: 'hidden', alignItems: section.content.alignment === 'center' ? 'center' : 'flex-start', backgroundColor: color }}>
          {!color && <PdfBackground ctx={ctx} background={bg} width={t.contentWidth} height={200} />}
          {section.content.eyebrow && <Text style={{ fontSize: t.size.tiny, letterSpacing: 2, textTransform: 'uppercase', color: bannerInk ?? t.colors.accent }}>{section.content.eyebrow}</Text>}
          {section.content.title && <Text style={{ ...headingStyle(ctx, t.size.h2, bannerInk), marginTop: 4, textAlign: section.content.alignment }}>{section.content.title}</Text>}
          {section.content.subtitle && <Text style={{ fontSize: t.size.base, color: bannerInk ?? t.colors.mutedText, marginTop: 4, textAlign: section.content.alignment }}>{section.content.subtitle}</Text>}
          {section.content.button.label && (
            target && /^https?:/.test(target.href) ? (
              <Link src={target.href} style={{ marginTop: 10, fontSize: t.size.small, fontWeight: 700, color: bannerInk ?? t.colors.accent, textDecoration: 'none' }}>{section.content.button.label} →</Link>
            ) : (
              <Text style={{ marginTop: 10, fontSize: t.size.small, fontWeight: 700, color: bannerInk ?? t.colors.accent }}>{section.content.button.label} →</Text>
            )
          )}
        </View>
      );
    }
    case 'gallery': {
      const images = section.content.images.map((i) => mediaUrl(i.path)).filter((u): u is string => Boolean(u));
      if (!images.length) return null;
      const cols = Math.min(section.content.columns.desktop, 4);
      const w = (t.contentWidth - 8 * (cols - 1)) / cols;
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {images.map((url, i) => (
              <PdfPicture key={`${url}-${i}`} ctx={ctx} url={url} style={{ width: w, height: w * 0.8, borderRadius: t.radius * 0.7 }} />
            ))}
          </View>
        </View>
      );
    }
    case 'features': {
      const cols = Math.min(section.content.columns.desktop, 3);
      const w = (t.contentWidth - 12 * (cols - 1)) / cols;
      return (
        <View wrap={false}>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {section.content.items.map((item) => (
              <View key={item.id} style={{ width: w, alignItems: section.content.alignment === 'center' ? 'center' : 'flex-start' }}>
                <PdfIcon id={item.icon} size={18} color={t.colors.accent} />
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: t.colors.heading, marginTop: 4 }}>{item.title}</Text>
                {item.text && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 2, textAlign: section.content.alignment === 'center' ? 'center' : 'left' }}>{item.text}</Text>}
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'testimonials':
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {section.content.items.filter((i) => i.text).map((item) => (
              <View key={item.id} wrap={false} style={{ width: (t.contentWidth - 10) / 2, padding: 12, backgroundColor: t.colors.surface, borderWidth: 0.6, borderColor: t.colors.border, borderRadius: t.radius }}>
                <Text style={{ fontSize: t.size.small, color: '#F5A524' }}>{'★'.repeat(item.rating)}</Text>
                <Text style={{ fontSize: t.size.small, color: t.colors.text, fontStyle: 'italic', marginTop: 4, lineHeight: 1.45 }}>“{item.text}”</Text>
                <Text style={{ fontSize: t.size.tiny, color: t.colors.heading, fontWeight: 700, marginTop: 6 }}>{item.name}{item.role ? ` · ${item.role}` : ''}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    case 'contact':
      return <ContactBlock doc={doc} />;
    case 'social':
      return site.business.socialLinks.length ? (
        <View wrap={false}>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          {site.business.socialLinks.map((l) => (
            <Link key={l.url} src={l.url} style={{ fontSize: t.size.small, color: t.colors.accent, textDecoration: 'none', marginBottom: 3 }}>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</Link>
          ))}
        </View>
      ) : null;
    case 'spacer':
      return (
        <View style={{ height: { xs: 6, sm: 12, md: 20, lg: 30, xl: 44 }[section.content.height], justifyContent: 'center', alignItems: 'center' }}>
          {section.content.divider !== 'none' && <View style={{ width: section.content.divider === 'line' ? '100%' : 80, height: 0.6, backgroundColor: t.colors.border }} />}
        </View>
      );
    case 'image': {
      const url = mediaUrl(section.content.image.path);
      if (!url) return null;
      const ratio = { original: 0.62, landscape: 0.75, wide: 0.5625, square: 1, portrait: 1.25 }[section.content.ratio];
      const width = Math.min(t.contentWidth, section.content.ratio === 'portrait' ? t.contentWidth * 0.55 : t.contentWidth);
      return (
        <View wrap={false}>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
          <PdfPicture ctx={ctx} url={url} style={{ width, height: width * ratio, borderRadius: section.content.rounded ? t.radius : 0, alignSelf: 'center' }} />
          {section.content.caption && <Text style={{ fontSize: t.size.tiny, color: ink ?? t.colors.mutedText, marginTop: 5, textAlign: 'center' }}>{section.content.caption}</Text>}
        </View>
      );
    }
    case 'video': {
      // En papel no hay reproductor: miniatura (YouTube) o un bloque con el enlace.
      const video = section.content.url ? parseVideoUrl(section.content.url) : null;
      if (!video) return null;
      const thumb = video.kind === 'youtube' ? video.thumbnail : null;
      const width = t.contentWidth * (section.content.layout === 'split' ? 0.5 : 0.8);
      const player = (
        <Link src={section.content.url} style={{ width, height: width * 0.5625, borderRadius: t.radius, overflow: 'hidden', backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center', textDecoration: 'none' }}>
          {thumb && <PdfPicture ctx={ctx} url={thumb} style={{ position: 'absolute', top: 0, left: 0, width, height: width * 0.5625 }} />}
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
            <PdfIcon id="play" size={16} color="#FFFFFF" />
          </View>
        </Link>
      );
      return (
        <View wrap={false} style={{ flexDirection: section.content.layout === 'split' ? 'row' : 'column', gap: 14, alignItems: section.content.layout === 'split' ? 'center' : 'stretch' }}>
          <View style={{ flex: section.content.layout === 'split' ? 1 : undefined }}>
            <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
            {section.content.layout === 'split' && section.content.body && <Text style={{ fontSize: t.size.small, color: ink ?? t.colors.text, lineHeight: 1.45 }}>{section.content.body}</Text>}
          </View>
          <View style={{ alignItems: 'center' }}>{player}</View>
          <Text style={{ fontSize: t.size.tiny, color: ink ?? t.colors.mutedText, textAlign: 'center' }}>Ver video: {section.content.url.replace(/^https:\/\/(www\.)?/, '')}</Text>
        </View>
      );
    }
    case 'faq': {
      const items = section.content.items.filter((i) => i.question.trim());
      if (!items.length) return null;
      const two = section.content.layout === 'twoColumns';
      const w = two ? (t.contentWidth - 16) / 2 : t.contentWidth;
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, columnGap: 16 }}>
            {items.map((item) => (
              <View key={item.id} wrap={false} style={{ width: w, paddingBottom: 8, borderBottomWidth: two ? 0 : 0.5, borderBottomColor: t.colors.border }}>
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: ink ?? t.colors.heading }}>{item.question}</Text>
                {item.answer && <Text style={{ fontSize: t.size.small, color: ink ?? t.colors.mutedText, marginTop: 3, lineHeight: 1.45 }}>{item.answer}</Text>}
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'pricing': {
      const plans = section.content.plans.filter((p) => p.name || p.price);
      if (!plans.length) return null;
      const cols = Math.min(plans.length, 3);
      const w = (t.contentWidth - 10 * (cols - 1)) / cols;
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {plans.map((plan) => (
              <View key={plan.id} wrap={false} style={{ width: w, padding: 12, backgroundColor: t.colors.surface, borderRadius: t.radius, borderWidth: plan.highlighted ? 1.5 : 0.6, borderColor: plan.highlighted ? t.colors.accent : t.colors.border }}>
                {plan.badge && <Text style={{ alignSelf: 'flex-start', fontSize: t.size.tiny, fontWeight: 700, color: t.colors.onAccent, backgroundColor: t.colors.accent, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, marginBottom: 5 }}>{plan.badge}</Text>}
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base * 1.1, color: t.colors.heading }}>{plan.name}</Text>
                <Text style={{ fontFamily: t.fonts.price, fontWeight: 700, fontSize: t.size.h2, color: t.colors.price, marginTop: 4 }}>
                  {plan.price}
                  {plan.period && <Text style={{ fontSize: t.size.small, fontWeight: 400, color: t.colors.mutedText }}> {plan.period}</Text>}
                </Text>
                {plan.description && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 3 }}>{plan.description}</Text>}
                {plan.features.map((feature, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 4, marginTop: 3, alignItems: 'center' }}>
                    <PdfIcon id="check" size={8} color={t.colors.success} />
                    <Text style={{ fontSize: t.size.small, color: t.colors.text }}>{feature}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'team': {
      const members = section.content.members.filter((m) => m.name);
      if (!members.length) return null;
      const cols = Math.min(section.content.columns.desktop, 4);
      const w = (t.contentWidth - 12 * (cols - 1)) / cols;
      const size = Math.min(w * 0.7, 90);
      const shape = section.content.photoShape === 'circle' ? 'circle' : section.content.photoShape === 'rounded' ? 'rounded' : 'rect';
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {members.map((m) => (
              <View key={m.id} wrap={false} style={{ width: w, alignItems: 'center' }}>
                <PdfShapedPicture ctx={ctx} url={mediaUrl(m.photo)} width={size} height={size} shape={shape} />
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: ink ?? t.colors.heading, marginTop: 6, textAlign: 'center' }}>{m.name}</Text>
                {m.role && <Text style={{ fontSize: t.size.tiny, color: ink ?? t.colors.accent, fontWeight: 700, textAlign: 'center' }}>{m.role}</Text>}
                {m.bio && <Text style={{ fontSize: t.size.tiny, color: ink ?? t.colors.mutedText, marginTop: 3, textAlign: 'center' }}>{m.bio}</Text>}
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'stats': {
      const items = section.content.items.filter((i) => i.value);
      if (!items.length) return null;
      const w = (t.contentWidth - 10 * (items.length - 1)) / items.length;
      const cards = section.content.layout === 'cards';
      const center = section.content.alignment === 'center';
      return (
        <View wrap={false}>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {items.map((item) => (
              <View key={item.id} style={{ width: w, alignItems: center ? 'center' : 'flex-start', padding: cards ? 10 : 0, backgroundColor: cards ? t.colors.surface : undefined, borderRadius: t.radius, borderWidth: cards ? 0.6 : 0, borderColor: t.colors.border }}>
                {item.icon && <PdfIcon id={item.icon} size={14} color={t.colors.accent} />}
                <Text style={{ fontFamily: t.fonts.heading, fontWeight: 800, fontSize: t.size.h2 * 1.1, color: cards ? t.colors.heading : (ink ?? t.colors.heading), marginTop: 2 }}>{item.value}</Text>
                <Text style={{ fontSize: t.size.small, color: cards ? t.colors.mutedText : (ink ?? t.colors.mutedText), textAlign: center ? 'center' : 'left' }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'logos': {
      const logos = section.content.logos.filter((l) => mediaUrl(l.path) && img(ctx, mediaUrl(l.path)));
      if (!logos.length) return null;
      const cols = Math.min(section.content.columns.desktop, 6);
      const w = (t.contentWidth - 10 * (cols - 1)) / cols;
      const h = { sm: 24, md: 34, lg: 48 }[section.content.size];
      return (
        <View wrap={false}>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} color={ink} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {logos.map((logo, i) => (
              <View key={`${logo.path}-${i}`} style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
                <Image src={img(ctx, mediaUrl(logo.path))!} style={{ maxWidth: w, maxHeight: h, objectFit: 'contain' }} />
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'columns':
      return <PdfColumns doc={doc} section={section} ink={ink} />;
    default: {
      // Todos los tipos de sección deben tener su versión PDF.
      const missing: never = section;
      return missing;
    }
  }
}

const RATIOS = { original: 0.66, square: 1, landscape: 0.75, portrait: 1.3, wide: 0.5625 } as const;

/** Sección Columnas en papel: columnas con el mismo reparto de ancho; los bloques se adaptan a impresión. */
function PdfColumns({ doc, section, ink }: { doc: PdfDoc; section: Extract<Section, { type: 'columns' }>; ink?: string }) {
  const { t } = doc;
  const c = section.content;
  const parts = c.layout.split('-').map(Number);
  const total = parts.reduce((a, b) => a + b, 0);
  const gap = { sm: 10, md: 16, lg: 24 }[c.gap];
  const usable = t.contentWidth - gap * (parts.length - 1);
  const color = (fallback: string) => ink ?? fallback;
  const block = (b: ColumnBlock, width: number, align: 'left' | 'center' | 'right') => {
    const textAlign = align;
    switch (b.kind) {
      case 'heading':
        return (
          <View key={b.id}>
            {b.eyebrow && <Text style={{ fontSize: t.size.tiny, letterSpacing: 2, textTransform: 'uppercase', color: ink ?? t.colors.accent, marginBottom: 3, textAlign }}>{b.eyebrow}</Text>}
            {b.text && <Text style={{ ...headingStyle(doc, b.level === 'h2' ? t.size.h2 : b.level === 'h3' ? t.size.h3 : t.size.base * 1.1, ink), textAlign }}>{b.text}</Text>}
          </View>
        );
      case 'text':
        return b.body ? <PdfRichText key={b.id} source={b.body} ctx={doc} color={ink} /> : null;
      case 'image': {
        const url = mediaUrl(b.image.path);
        return url ? <PdfPicture key={b.id} ctx={doc} url={url} style={{ width, height: Math.min(width * RATIOS[b.ratio], 360), borderRadius: b.rounded ? t.radius : 0 }} /> : null;
      }
      case 'buttons':
        return (
          <View key={b.id} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
            {b.items.filter((i) => i.label).map((i, n) => <Text key={n} style={{ fontSize: t.size.small, fontWeight: 700, color: color(t.colors.accent) }}>{i.label} →</Text>)}
          </View>
        );
      case 'list':
        return (
          <View key={b.id} style={{ gap: 4 }}>
            {b.items.map((item, i) => (
              <View key={item.id} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                {b.marker === 'number' || b.marker === 'bullet' ? (
                  <Text style={{ fontSize: t.size.small, fontWeight: 700, color: ink ?? t.colors.accent, width: 12 }}>{b.marker === 'number' ? `${i + 1}.` : '•'}</Text>
                ) : (
                  <View style={{ marginTop: 1.5 }}><PdfIcon id={b.marker === 'icon' && item.icon ? item.icon : 'check'} size={9} color={ink ?? t.colors.accent} /></View>
                )}
                <Text style={{ fontSize: t.size.small, color: color(t.colors.text), flex: 1 }}>{item.text}</Text>
              </View>
            ))}
          </View>
        );
      case 'card':
        return (
          <View key={b.id} wrap={false} style={{ padding: 10, borderRadius: t.radius, backgroundColor: t.colors.surface, borderWidth: 0.6, borderColor: t.colors.border, gap: 4, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
            {mediaUrl(b.image.path) ? <PdfPicture ctx={doc} url={mediaUrl(b.image.path)} style={{ width: width - 20, height: (width - 20) * 0.6, borderRadius: t.radius * 0.7 }} /> : b.icon ? <PdfIcon id={b.icon} size={16} color={t.colors.accent} /> : null}
            {b.title && <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: t.colors.heading }}>{b.title}</Text>}
            {b.text && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, textAlign }}>{b.text}</Text>}
          </View>
        );
      case 'icon':
        return <PdfIcon key={b.id} id={b.icon} size={b.size === 'lg' ? 26 : b.size === 'sm' ? 14 : 20} color={ink ?? t.colors.accent} />;
      case 'badge':
        return b.text ? <Text key={b.id} style={{ alignSelf: align === 'center' ? 'center' : 'flex-start', fontSize: t.size.tiny, fontWeight: 700, color: t.colors.onAccent, backgroundColor: t.colors.accent, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8 }}>{b.text}</Text> : null;
      case 'stat':
        return (
          <View key={b.id} style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
            <Text style={{ fontFamily: t.fonts.heading, fontWeight: 800, fontSize: t.size.h2 * 1.1, color: color(t.colors.heading) }}>{b.value}</Text>
            {b.label && <Text style={{ fontSize: t.size.small, color: color(t.colors.mutedText) }}>{b.label}</Text>}
          </View>
        );
      case 'divider':
        return <View key={b.id} style={{ height: 0.6, backgroundColor: t.colors.border, marginVertical: 2 }} />;
      case 'spacer':
        return <View key={b.id} style={{ height: { sm: 6, md: 12, lg: 20 }[b.size] }} />;
      case 'video':
        return b.url ? <Link key={b.id} src={b.url} style={{ fontSize: t.size.small, color: ink ?? t.colors.accent }}>▶ Ver video</Link> : null;
    }
  };
  return (
    <View>
      <SectionTitle ctx={doc} title={c.title} subtitle={c.subtitle} color={ink} />
      <View style={{ flexDirection: 'row', gap, alignItems: c.verticalAlign === 'center' ? 'center' : c.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start' }}>
        {parts.map((part, i) => {
          const column = c.columns[i];
          const width = (usable * part) / total;
          if (!column) return <View key={i} style={{ width }} />;
          const surface = column.surface !== 'none';
          const inner = surface ? width - 20 : width;
          return (
            <View key={column.id} style={{ width, gap: 8, padding: surface ? 10 : 0, borderRadius: t.radius, backgroundColor: column.surface === 'card' ? t.colors.surface : column.surface === 'soft' ? t.colors.soft : undefined, borderWidth: column.surface === 'card' || column.surface === 'outline' ? 0.6 : 0, borderColor: t.colors.border, alignItems: column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'stretch' }}>
              {column.blocks.map((b) => block(b, inner, column.align))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** La sección "Catálogo" de la web como bloque de catálogo del PDF (misma presentación y orden). */
function sectionCatalogBlock(section: Extract<Section, { type: 'catalog' }>): PdfBlockOf<'catalog'> {
  return {
    id: section.id,
    type: 'catalog',
    enabled: true,
    newPage: false,
    title: '',
    subtitle: '',
    itemType: section.content.itemType,
    categoryIds: [],
    categoryStyle: 'simple',
    categoryNewPage: false,
    sort: section.content.sort.default,
    presentation: section.content.presentation,
    itemsPerPage: 0,
  };
}
