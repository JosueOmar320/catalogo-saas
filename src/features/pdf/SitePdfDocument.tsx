/* eslint-disable jsx-a11y/alt-text -- <Image> de react-pdf no admite `alt`. */
import { Document, Image, Link, Page, Text, View } from '@react-pdf/renderer';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { resolveBackground } from '@/lib/design/background';
import { env } from '@/lib/env';
import type { PdfSettings } from '@/lib/pdf/settings';
import { resolveLink } from '@/lib/site/links';
import { heroText, resolveSectionItems, resolveTextMode } from '@/lib/site/resolve';
import type { Section } from '@/lib/site/section-schemas';
import type { SiteViewModel } from '@/lib/site/view-model';
import { mediaUrl } from '@/lib/utils/storage';
import { groupByCategory } from '@/site-renderer/filter';
import { headingStyle, img, PdfBackground, PdfIcon, PdfPicture, PdfRichText, type PdfContext } from './primitives';
import { PDF_TEMPLATE_COMPONENTS, type CoverData } from './templates';

type Props = { site: SiteViewModel; settings: PdfSettings; ctx: PdfContext; items: CatalogItemView[] };

export function contactLine(site: SiteViewModel, parts: { phone?: boolean; whatsapp?: boolean; email?: boolean; website?: boolean } = { phone: true, whatsapp: true, email: true, website: true }) {
  const c = site.business.contact;
  return [
    parts.whatsapp && c.whatsapp && `WhatsApp ${c.whatsapp}`,
    parts.phone && c.phone && c.phone !== c.whatsapp && `Tel. ${c.phone}`,
    parts.email && c.email,
    parts.website && (c.website || site.url).replace(/^https?:\/\//, ''),
  ]
    .filter(Boolean)
    .join('   ·   ');
}

/**
 * PDF = otro destino de render del sitio. Datos del catálogo + tema del sitio
 * + configuración del PDF → plantilla. El orden de los bloques lo define el
 * usuario (portada, catálogo, páginas del sitio, contacto).
 */
export function SitePdfDocument({ site, settings, ctx, items }: Props) {
  const { t } = ctx;
  const template = PDF_TEMPLATE_COMPONENTS[settings.template];
  const blocks = settings.content.filter((b) => b.enabled);
  const cover = blocks.find((b) => b.type === 'cover');
  const flow = blocks.filter((b) => b.type !== 'cover');
  const pageProps = { size: settings.paperSize, orientation: settings.orientation } as const;
  const categoryNames = new Map(site.categories.map((c) => [c.id, c.name]));

  const coverData: CoverData = {
    title: settings.cover.title || site.business.name,
    subtitle: settings.cover.subtitle || site.business.slogan || '',
    description: site.business.description,
    logoUrl: site.business.logoUrl,
    imageUrl: settings.cover.imageSource === 'none' ? null : settings.cover.imageSource === 'custom' ? mediaUrl(settings.cover.imagePath) : site.coverUrl,
    contactLine: contactLine(site),
    background: settings.inkSaver ? resolveBackground(null) : settings.cover.background.type !== 'inherit' ? settings.cover.background : template.coverBackground(ctx),
    showLogo: settings.cover.showLogo,
    showDescription: settings.cover.showDescription,
    showContact: settings.cover.showContact,
  };

  const footerText = [
    contactLine(site, { phone: settings.footer.showPhone, whatsapp: settings.footer.showWhatsapp, email: settings.footer.showEmail, website: settings.footer.showWebsite }),
    settings.footer.customText,
  ]
    .filter(Boolean)
    .join('   ·   ');
  const headerColor = settings.header.color || t.colors.heading;
  const logo = img(ctx, site.business.logoUrl);

  return (
    <Document title={`${site.business.name} · Catálogo`} author={site.business.name} creator={env.appName} producer={env.appName} language="es">
      {cover && (
        <Page {...pageProps} style={{ fontFamily: t.fonts.body, color: t.colors.text, backgroundColor: t.colors.paper }}>
          <PdfBackground ctx={ctx} background={coverData.background} width={t.pageWidth} height={t.pageHeight} />
          <template.Cover ctx={ctx} cover={coverData} />
        </Page>
      )}

      {flow.length > 0 && (
        <Page
          {...pageProps}
          wrap
          style={{
            fontFamily: t.fonts.body,
            fontSize: t.size.base,
            color: t.colors.text,
            backgroundColor: t.colors.paper,
            paddingTop: t.margin + t.headerSpace,
            paddingBottom: t.margin + t.footerSpace,
            paddingHorizontal: t.margin,
          }}
        >
          <PdfBackground ctx={ctx} background={t.pageBackground} width={t.pageWidth} height={t.pageHeight} fixed />

          {settings.header.enabled && (
            <View fixed style={{ position: 'absolute', top: t.margin * 0.55, left: t.margin, right: t.margin, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: settings.header.separator ? 0.6 : 0, borderBottomColor: settings.header.color || t.colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {settings.header.showLogo && logo && <Image src={logo} style={{ width: 16, height: 16, objectFit: 'contain' }} />}
                {settings.header.showName && <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.small, color: headerColor }}>{site.business.name}</Text>}
              </View>
              <Text style={{ fontSize: t.size.tiny, color: headerColor, letterSpacing: 1, textTransform: 'uppercase' }} render={({ pageNumber }) => [settings.header.text, settings.header.showPageNumber ? String(pageNumber) : ''].filter(Boolean).join('   ')} />
            </View>
          )}

          {settings.footer.enabled && (
            <View fixed style={{ position: 'absolute', bottom: t.margin * 0.55, left: t.margin, right: t.margin, flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: t.colors.border }}>
              <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, flex: 1 }}>{footerText}</Text>
              {settings.footer.pageNumbers !== 'none' && (
                <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText }} render={({ pageNumber, totalPages }) => (settings.footer.pageNumbers === 'ofTotal' ? `${pageNumber} / ${totalPages}` : String(pageNumber))} />
              )}
            </View>
          )}

          {flow.map((block, index) => (
            <View key={block.id} break={index > 0 && block.type !== 'contact'}>
              {block.type === 'catalog' && <CatalogBlock ctx={ctx} settings={settings} site={site} items={items} categoryNames={categoryNames} />}
              {block.type === 'page' && <PageBlock ctx={ctx} settings={settings} site={site} items={items} pageId={block.pageId} categoryNames={categoryNames} />}
              {block.type === 'contact' && <ContactBlock ctx={ctx} site={site} />}
            </View>
          ))}
        </Page>
      )}
    </Document>
  );
}

/* ------------------------------------------------------------ Catálogo */

function CatalogBlock({ ctx, settings, site, items, categoryNames, itemType }: { ctx: PdfContext; settings: PdfSettings; site: SiteViewModel; items: CatalogItemView[]; categoryNames: Map<string, string>; itemType?: 'product' | 'service' | 'any' }) {
  const template = PDF_TEMPLATE_COMPONENTS[settings.template];
  const filter = itemType ?? (settings.catalogFilter === 'products' ? 'product' : settings.catalogFilter === 'services' ? 'service' : 'any');
  const pool = filter === 'any' ? items : items.filter((i) => i.type === filter);
  const groups = groupByCategory(pool, site.categories);
  if (groups.length === 0) return <Text style={{ color: ctx.t.colors.mutedText, textAlign: 'center', marginTop: 60 }}>Aún no hay ítems visibles.</Text>;
  // Productos por "fila": el título de categoría viaja con la primera fila (nunca queda huérfano).
  const perRow = ['classic', 'modern', 'luxury'].includes(settings.template) ? settings.products.columns : settings.template === 'menu' ? Math.min(settings.products.columns, 2) : 1;

  return (
    <View>
      {groups.map((group, index) => {
        const first = group.items.slice(0, perRow);
        const rest = group.items.slice(perRow);
        return (
          <View key={group.id} break={settings.products.pageBreakPerCategory && index > 0} style={{ marginBottom: 18 }}>
            <View wrap={false}>
              {group.title && <template.Heading ctx={ctx} title={group.title} description={group.description} index={index} />}
              <template.Items ctx={ctx} items={first} settings={settings} categoryNames={categoryNames} />
            </View>
            {rest.length > 0 && (
              <View style={{ marginTop: settings.template === 'minimal' ? 0 : 12 }}>
                <template.Items ctx={ctx} items={rest} settings={settings} categoryNames={categoryNames} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------ Contacto */

function ContactBlock({ ctx, site }: { ctx: PdfContext; site: SiteViewModel }) {
  const { t } = ctx;
  const c = site.business.contact;
  const address = [c.address, c.city].filter(Boolean).join(', ');
  const rows = [
    c.whatsapp && { icon: 'message-circle', label: 'WhatsApp', value: c.whatsapp },
    c.phone && { icon: 'phone', label: 'Teléfono', value: c.phone },
    c.email && { icon: 'mail', label: 'Email', value: c.email },
    address && { icon: 'map-pin', label: 'Dirección', value: address },
    c.hours && { icon: 'clock', label: 'Horarios', value: c.hours },
    { icon: 'globe', label: 'Sitio', value: (c.website || site.url).replace(/^https?:\/\//, '') },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  return (
    <View wrap={false} style={{ marginTop: 10, padding: 16, backgroundColor: t.colors.soft, borderRadius: t.radius }}>
      <Text style={{ ...headingStyle(ctx, t.size.h3 * 1.1), marginBottom: 10 }}>Contacto</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', gap: 6, width: (t.contentWidth - 32 - 12) / 2 }}>
            <PdfIcon id={row.icon} size={11} color={t.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, textTransform: 'uppercase', letterSpacing: 0.8 }}>{row.label}</Text>
              <Text style={{ fontSize: t.size.small, color: t.colors.text, lineHeight: 1.4 }}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>
      {c.additionalInfo && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 10, lineHeight: 1.4 }}>{c.additionalInfo}</Text>}
      {site.business.socialLinks.length > 0 && (
        <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, marginTop: 10 }}>
          {site.business.socialLinks.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, '')).join('   ·   ')}
        </Text>
      )}
    </View>
  );
}

/* ------------------------------------------------------------ Páginas del sitio */

/**
 * Una página del sitio adaptada a impresión: cada sección tiene su versión
 * PDF (el hero se vuelve un encabezado, la galería una grilla, etc.).
 */
function PageBlock({ ctx, settings, site, items, pageId, categoryNames }: { ctx: PdfContext; settings: PdfSettings; site: SiteViewModel; items: CatalogItemView[]; pageId: string; categoryNames: Map<string, string> }) {
  const page = site.pages.find((p) => p.id === pageId);
  if (!page) return null;
  return (
    <View>
      {page.sections.filter((s) => s.visible).map((section) => (
        <View key={section.id} style={{ marginBottom: 16 }}>
          <PdfSection section={section} ctx={ctx} settings={settings} site={site} items={items} categoryNames={categoryNames} />
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ ctx, title, subtitle, color }: { ctx: PdfContext; title?: string; subtitle?: string; color?: string }) {
  if (!title && !subtitle) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      {title && <Text style={headingStyle(ctx, ctx.t.size.h2, color)}>{title}</Text>}
      {subtitle && <Text style={{ fontSize: ctx.t.size.base, color: color ?? ctx.t.colors.mutedText, marginTop: 3, opacity: color ? 0.85 : 1 }}>{subtitle}</Text>}
    </View>
  );
}

function PdfSection({ section, ctx, settings, site, items, categoryNames }: { section: Section; ctx: PdfContext; settings: PdfSettings; site: SiteViewModel; items: CatalogItemView[]; categoryNames: Map<string, string> }) {
  const { t } = ctx;
  const template = PDF_TEMPLATE_COMPONENTS[settings.template];
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
      const list = resolveSectionItems(section.content, items);
      if (!list.length) return null;
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <template.Items ctx={ctx} items={list} settings={settings} categoryNames={categoryNames} />
        </View>
      );
    }
    case 'catalog':
      return (
        <View>
          <SectionTitle ctx={ctx} title={section.content.title} subtitle={section.content.subtitle} />
          <CatalogBlock ctx={ctx} settings={settings} site={site} items={items} categoryNames={categoryNames} itemType={section.content.itemType} />
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
      return <ContactBlock ctx={ctx} site={site} />;
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
    default:
      return null;
  }
}
