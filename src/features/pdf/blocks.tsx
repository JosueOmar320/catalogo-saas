import { Link, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { hoursText } from '@/lib/business/profile';
import { resolveCollection, sortItems } from '@/lib/catalog/collections';
import type { CatalogCategoryView, CatalogItemView } from '@/lib/catalog/view-model';
import type { Translator } from '@/i18n/translate';
import type { PdfBlock, PdfBlockOf, PdfBlockType } from '@/lib/pdf/settings';
import { mediaUrl } from '@/lib/utils/storage';
import { defaultText } from '@/site-renderer/default-texts';
import { groupByCategory } from '@/site-renderer/filter';
import { socialHandle } from './chrome';
import { pdfAttributes, type PdfDoc } from './doc';
import { headingStyle, PdfIcon, PdfOrnament, PdfPicture, PdfPrice, PdfRichText, PdfShapedPicture } from './primitives';
import { productRows } from './products';

/* ------------------------------------------------------------ Anclas e índice */

/**
 * Marca invisible: registra en qué página cae (para el índice) y sirve de
 * destino de los enlaces internos del índice.
 */
export function Anchor({ doc, id }: { doc: PdfDoc; id: string }) {
  return (
    <View id={id} style={{ height: 0.1 }}>
      <Text
        style={{ fontSize: 0.1, opacity: 0 }}
        render={({ pageNumber }) => {
          doc.marks.set(id, pageNumber);
          return ' ';
        }}
      />
    </View>
  );
}

export type TocEntry = { id: string; label: string; level: 0 | 1 };

/** Nombre de un bloque sin título (para el índice), en el idioma del negocio. */
function blockLabel(type: Exclude<PdfBlockType, 'cover' | 'toc' | 'pageBreak' | 'catalog' | 'page'>, siteT: Translator): string {
  switch (type) {
    case 'products':
      return siteT('Colección de productos');
    case 'comparison':
      return siteT('Tabla comparativa');
    case 'text':
      return siteT('Página de información');
    case 'gallery':
      return siteT('Galería');
    case 'image':
      return siteT('Página de imagen');
    case 'promo':
      return siteT('Página promocional');
    case 'contact':
      return siteT('Contacto');
    case 'backCover':
      return siteT('Contraportada');
  }
}

/** Entradas del índice: bloques con título y, si se pide, sus categorías. */
export function tocEntries(doc: PdfDoc, blocks: PdfBlock[], withCategories: boolean): TocEntry[] {
  return blocks.flatMap((b): TocEntry[] => {
    switch (b.type) {
      case 'cover':
      case 'toc':
      case 'pageBreak':
        return [];
      case 'catalog': {
        const cats = withCategories ? catalogGroups(doc, b).flatMap((g) => (g.title ? [{ id: `${b.id}-${g.id}`, label: g.title, level: (b.title ? 1 : 0) as 0 | 1 }] : [])) : [];
        return [...(b.title || cats.length === 0 ? [{ id: b.id, label: b.title || doc.siteT('Catálogo'), level: 0 as const }] : []), ...cats];
      }
      case 'page': {
        const page = doc.site.pages.find((p) => p.id === b.pageId);
        return page ? [{ id: b.id, label: page.title, level: 0 }] : [];
      }
      default:
        return [{ id: b.id, label: b.title || blockLabel(b.type, doc.siteT), level: 0 }];
    }
  });
}

export function TocBlock({ doc, block, entries }: { doc: PdfDoc; block: PdfBlockOf<'toc'>; entries: TocEntry[] }) {
  const { t, siteT, skin } = doc;
  return (
    <View>
      <Text style={{ ...headingStyle(doc, t.size.h1), textAlign: skin.center ? 'center' : 'left', marginBottom: 6 }}>{defaultText(block.title, siteT)}</Text>
      {skin.center ? <PdfOrnament ctx={doc} /> : <View style={{ height: 2, width: 50, backgroundColor: t.colors.accent }} />}
      <View style={{ marginTop: 22 }}>
        {entries.map((e) => (
          <Link key={e.id} src={`#${e.id}`} style={{ textDecoration: 'none' }}>
            <View wrap={false} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: e.level === 0 ? 6 : 3.5, paddingLeft: e.level === 1 ? 16 : 0 }}>
              <Text style={e.level === 0 ? { ...headingStyle(doc, t.size.base * 1.2), fontWeight: 700 } : { fontSize: t.size.base, color: t.colors.text }}>{e.label}</Text>
              <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: t.colors.border, borderStyle: 'dotted', marginBottom: 3 }} />
              <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: t.colors.accent, minWidth: 16, textAlign: 'right' }}>{doc.toc.get(e.id) ?? ''}</Text>
            </View>
          </Link>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------ Títulos */

export function BlockTitle({ doc, title, subtitle, center }: { doc: PdfDoc; title?: string; subtitle?: string; center?: boolean }) {
  if (!title && !subtitle) return null;
  const { t, skin } = doc;
  const c = center ?? skin.center;
  return (
    <View style={{ marginBottom: 14, alignItems: c ? 'center' : 'flex-start' }}>
      {title && <Text style={{ ...headingStyle(doc, t.size.h2), textAlign: c ? 'center' : 'left' }}>{title}</Text>}
      {subtitle && <Text style={{ fontSize: t.size.base, color: t.colors.mutedText, marginTop: 4, textAlign: c ? 'center' : 'left', lineHeight: 1.4 }}>{subtitle}</Text>}
    </View>
  );
}

/** Título de categoría "simple": su aspecto lo define la plantilla. */
function SimpleCategoryHeading({ doc, title, description, index }: { doc: PdfDoc; title: string; description: string | null; index: number }) {
  const { t, skin } = doc;
  const desc = description && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 3, textAlign: skin.center ? 'center' : 'left' }}>{description}</Text>;
  switch (skin.heading) {
    case 'pill':
      return (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ alignSelf: 'flex-start', fontSize: t.size.tiny, fontWeight: 700, color: t.colors.onAccent, backgroundColor: t.colors.accent, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{doc.siteT('Categoría')}</Text>
          <Text style={{ ...headingStyle(doc, t.size.h2 * 1.1), marginTop: 6 }}>{title}</Text>
          {desc}
        </View>
      );
    case 'number':
      return <EditorialHeading doc={doc} title={title} description={description} index={index} />;
    case 'spaced':
      return (
        <View style={{ marginBottom: 8, marginTop: 4 }}>
          <Text style={{ fontSize: t.size.small, letterSpacing: 2.5, textTransform: 'uppercase', color: t.colors.heading, fontWeight: 700 }}>{title}</Text>
          {desc}
          <View style={{ height: 0.5, backgroundColor: t.colors.border, marginTop: 6 }} />
        </View>
      );
    case 'ornament':
      return (
        <View style={{ alignItems: 'center', marginBottom: 14, marginTop: 6 }}>
          <Text style={{ ...headingStyle(doc, t.size.h2), textAlign: 'center', textTransform: skin.upper ? 'uppercase' : undefined, letterSpacing: skin.upper ? 3 : undefined }}>{title}</Text>
          <View style={{ marginTop: 6 }}><PdfOrnament ctx={doc} width={110} /></View>
          {desc}
        </View>
      );
    case 'bar':
      return (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={{ width: 4, backgroundColor: t.colors.accent, borderRadius: 2 }} />
          <View style={{ flex: 1, paddingVertical: 2 }}>
            <Text style={{ ...headingStyle(doc, t.size.h2), textTransform: skin.upper ? 'uppercase' : undefined, letterSpacing: skin.upper ? 1.5 : undefined }}>{title}</Text>
            {desc}
          </View>
        </View>
      );
    case 'band':
      return (
        <View style={{ marginBottom: 14, backgroundColor: t.colors.primary, borderRadius: t.radius, paddingVertical: 9, paddingHorizontal: 14 }}>
          <Text style={headingStyle(doc, t.size.h2, t.colors.onPrimary)}>{title}</Text>
          {description && <Text style={{ fontSize: t.size.small, color: t.colors.onPrimary, opacity: 0.85, marginTop: 2 }}>{description}</Text>}
        </View>
      );
    default:
      return (
        <View style={{ marginBottom: 12, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: t.colors.primary }}>
          <Text style={headingStyle(doc, t.size.h2)}>{title}</Text>
          {desc}
        </View>
      );
  }
}

function EditorialHeading({ doc, title, description, index }: { doc: PdfDoc; title: string; description: string | null; index: number }) {
  const { t } = doc;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16, paddingBottom: 8, borderBottomWidth: 0.6, borderBottomColor: t.colors.border }}>
      <Text style={{ ...headingStyle(doc, t.size.h1 * 1.4, t.colors.accent), lineHeight: 1 }}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={headingStyle(doc, t.size.h2)}>{title}</Text>
        {description && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 2, fontStyle: 'italic' }}>{description}</Text>}
      </View>
    </View>
  );
}

function ImageCategoryHeading({ doc, category, title, description }: { doc: PdfDoc; category?: CatalogCategoryView; title: string; description: string | null }) {
  const { t } = doc;
  const h = 86;
  return (
    <View style={{ height: h, marginBottom: 14, borderRadius: t.radius, overflow: 'hidden', backgroundColor: t.colors.primary, justifyContent: 'flex-end', padding: 12 }}>
      {category?.imageUrl && (
        <>
          <PdfPicture ctx={doc} url={category.imageUrl} style={{ position: 'absolute', top: 0, left: 0, width: t.contentWidth, height: h }} />
          <View style={{ position: 'absolute', top: 0, left: 0, width: t.contentWidth, height: h, backgroundColor: '#000000', opacity: 0.4 }} />
        </>
      )}
      <Text style={headingStyle(doc, t.size.h2 * 1.1, category?.imageUrl ? '#FFFFFF' : t.colors.onPrimary)}>{title}</Text>
      {description && <Text style={{ fontSize: t.size.small, color: category?.imageUrl ? '#FFFFFF' : t.colors.onPrimary, opacity: 0.9, marginTop: 2 }}>{description}</Text>}
    </View>
  );
}

/** Portada de categoría: una página entera antes de sus ítems. */
function HeroCategoryPage({ doc, category, title, description, count, index, blockTitle }: { doc: PdfDoc; category?: CatalogCategoryView; title: string; description: string | null; count: number; index: number; blockTitle?: ReactNode }) {
  const { t, skin } = doc;
  const height = t.pageHeight - t.margin * 2 - t.headerSpace - t.footerSpace - 4;
  const imgH = height * 0.55;
  return (
    <View wrap={false} style={{ height, justifyContent: 'center' }}>
      {blockTitle}
      {category?.imageUrl ? (
        <PdfShapedPicture ctx={doc} url={category.imageUrl} width={t.contentWidth * 0.8} height={imgH} shape={skin.card === 'plain' ? 'arch' : 'rounded'} frame={skin.card === 'plain'} style={{ alignSelf: 'center' }} />
      ) : (
        <View style={{ alignSelf: 'center', width: t.contentWidth * 0.5, height: 2, backgroundColor: t.colors.accent }} />
      )}
      <Text style={{ fontSize: t.size.small, letterSpacing: 3, textTransform: 'uppercase', color: t.colors.accent, marginTop: 22, textAlign: 'center' }}>{String(index + 1).padStart(2, '0')}</Text>
      <Text style={{ ...headingStyle(doc, t.size.h1 * 1.35), textAlign: 'center', marginTop: 4 }}>{title}</Text>
      {description && <Text style={{ fontSize: t.size.base * 1.1, color: t.colors.mutedText, textAlign: 'center', marginTop: 8, lineHeight: 1.45, paddingHorizontal: t.contentWidth * 0.1 }}>{description}</Text>}
      <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, textAlign: 'center', marginTop: 10 }}>{count === 1 ? doc.siteT('1 opción') : doc.siteT('{count} opciones', { count })}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ Paginación de filas */

function chunk<T>(list: T[], size: number): T[][] {
  if (size <= 0) return [list];
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Encabezado + filas, con "N ítems por página": cada página nueva empieza con
 * un salto. El encabezado viaja siempre con la primera fila.
 */
function PagedRows({ doc, items, presentation, itemsPerPage, head, breakFirst }: { doc: PdfDoc; items: CatalogItemView[]; presentation: PdfBlockOf<'products'>['presentation']; itemsPerPage: number; head?: ReactNode; breakFirst?: boolean }) {
  const pages = chunk(items, itemsPerPage);
  return (
    <>
      {pages.map((pageItems, pi) => {
        // El destacado de "editorial"/"revista" va sólo en la primera página; las siguientes son cuadrícula.
        const featured = presentation.layout === 'editorial' || presentation.layout === 'magazine';
        const rows = productRows(doc, pageItems, pi > 0 && featured ? { ...presentation, layout: 'grid' } : presentation);
        const [first, ...rest] = rows;
        return (
          <View key={pi} break={pi > 0 || breakFirst}>
            <View wrap={false}>
              {pi === 0 && head}
              {first}
            </View>
            {rest}
          </View>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------ Catálogo por categorías */

export function catalogItems(doc: PdfDoc, block: PdfBlockOf<'catalog'>): CatalogItemView[] {
  const pool = block.itemType === 'any' ? doc.items : doc.items.filter((i) => i.type === block.itemType);
  const filtered = block.categoryIds.length ? pool.filter((i) => i.categoryId && block.categoryIds.includes(i.categoryId)) : pool;
  return sortItems(filtered, block.sort);
}

export function catalogGroups(doc: PdfDoc, block: PdfBlockOf<'catalog'>) {
  const categories = block.categoryIds.length ? block.categoryIds.flatMap((id) => doc.site.categories.filter((c) => c.id === id)) : doc.site.categories;
  return groupByCategory(catalogItems(doc, block), categories, doc.siteT('Otros'));
}

export function CatalogBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'catalog'> }) {
  const { t } = doc;
  const groups = catalogGroups(doc, block);
  if (groups.length === 0) return <Text style={{ color: t.colors.mutedText, textAlign: 'center', marginTop: 60 }}>{doc.siteT('Aún no hay ítems visibles.')}</Text>;
  const title = <BlockTitle doc={doc} title={block.title} subtitle={block.subtitle} />;
  const hero = block.categoryStyle === 'hero';

  return (
    <View>
      {!hero && title}
      {groups.map((group, gi) => {
        const category = doc.site.categories.find((c) => c.id === group.id);
        const anchor = <Anchor doc={doc} id={`${block.id}-${group.id}`} />;
        if (hero && group.title) {
          return (
            <View key={group.id} break={gi > 0}>
              {anchor}
              <HeroCategoryPage doc={doc} category={category} title={group.title} description={group.description} count={group.items.length} index={gi} blockTitle={gi === 0 ? title : undefined} />
              <PagedRows doc={doc} items={group.items} presentation={block.presentation} itemsPerPage={block.itemsPerPage} breakFirst />
            </View>
          );
        }
        const heading = group.title ? (
          block.categoryStyle === 'image' ? (
            <ImageCategoryHeading doc={doc} category={category} title={group.title} description={group.description} />
          ) : block.categoryStyle === 'editorial' ? (
            <EditorialHeading doc={doc} title={group.title} description={group.description} index={gi} />
          ) : (
            <SimpleCategoryHeading doc={doc} title={group.title} description={group.description} index={gi} />
          )
        ) : null;
        return (
          <View key={group.id} break={block.categoryNewPage && gi > 0} style={{ marginBottom: 14 }}>
            {anchor}
            <PagedRows doc={doc} items={group.items} presentation={block.presentation} itemsPerPage={block.itemsPerPage} head={heading} />
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------ Colección */

export function ProductsBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'products'> }) {
  const items = resolveCollection(block.collection, doc.items);
  if (items.length === 0) return null;
  return <PagedRows doc={doc} items={items} presentation={block.presentation} itemsPerPage={block.itemsPerPage} head={<BlockTitle doc={doc} title={block.title} subtitle={block.subtitle} />} />;
}

/* ------------------------------------------------------------ Comparación */

export function ComparisonBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'comparison'> }) {
  const { t } = doc;
  const items = resolveCollection({ ...block.collection, limit: block.collection.limit || 8 }, doc.items);
  if (items.length === 0) return null;
  const chosen = block.attributeIds.length ? block.attributeIds.flatMap((id) => doc.site.attributeDefs.filter((d) => d.id === id)) : doc.site.attributeDefs.filter((d) => d.showInPdf);
  // Sólo atributos que al menos un ítem tiene (una fila de "—" no compara nada).
  const defs = chosen.filter((d) => items.some((i) => i.attributes[d.id] !== undefined));
  const tables = chunk(items, 4);
  const labelW = t.contentWidth * 0.22;

  const cell = (content: ReactNode, key: string | number, opts: { label?: boolean; head?: boolean; width: number }) => (
    <View key={key} style={{ width: opts.width, padding: 6, borderRightWidth: 0.5, borderRightColor: t.colors.border, backgroundColor: opts.label ? t.colors.soft : opts.head ? t.colors.surface : undefined, justifyContent: 'center' }}>
      {typeof content === 'string' ? <Text style={{ fontSize: t.size.small, fontWeight: opts.label || opts.head ? 700 : 400, color: opts.label ? t.colors.mutedText : t.colors.text, textAlign: opts.label ? 'left' : 'center' }}>{content}</Text> : content}
    </View>
  );

  return (
    <View>
      <BlockTitle doc={doc} title={block.title} subtitle={block.subtitle} />
      {tables.map((list, ti) => {
        const colW = (t.contentWidth - labelW) / list.length;
        const row = (label: string, render: (item: CatalogItemView) => ReactNode, key: string, head?: boolean) => (
          <View key={key} wrap={false} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: t.colors.border }}>
            {cell(label, 'label', { label: true, width: labelW })}
            {list.map((item) => cell(render(item), item.id, { width: colW, head }))}
          </View>
        );
        const values = (id: string) => (item: CatalogItemView) => pdfAttributes(doc, item, 'all').find((a) => a.id === id)?.value ?? '—';
        return (
          <View key={ti} wrap={false} style={{ borderWidth: 0.5, borderColor: t.colors.border, borderRadius: t.radius * 0.5, marginBottom: 16, overflow: 'hidden' }}>
            {block.showImage &&
              row('', (item) => <PdfShapedPicture ctx={doc} url={item.images[0]?.thumbUrl} width={Math.min(colW - 12, 90)} height={Math.min(colW - 12, 90)} shape="rounded" style={{ alignSelf: 'center' }} />, 'img')}
            {row(doc.siteT('Producto'), (item) => <Text style={{ ...headingStyle(doc, t.size.base), fontWeight: 700, textAlign: 'center' }}>{item.name}</Text>, 'name', true)}
            {block.showPrice && row(doc.siteT('Precio'), (item) => <PdfPrice item={item} ctx={doc} align="center" size={t.size.base} />, 'price')}
            {block.showSku && row(doc.siteT('Código'), (item) => item.sku ?? '—', 'sku')}
            {defs.map((d) => row(d.name, values(d.id), d.id))}
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------ Información */

export function TextBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'text'> }) {
  const { t } = doc;
  const image = mediaUrl(block.imagePath);
  const side = image && (block.imagePosition === 'left' || block.imagePosition === 'right');
  const picture = image ? <PdfShapedPicture key="img" ctx={doc} url={image} width={side ? t.contentWidth * 0.4 : t.contentWidth} height={side ? t.contentWidth * 0.5 : 220} shape="rounded" /> : null;
  const text = (
    <View key="text" style={{ flex: side ? 1 : undefined }}>
      <BlockTitle doc={doc} title={block.title} subtitle={block.subtitle} center={false} />
      {block.body && <PdfRichText source={block.body} ctx={doc} />}
    </View>
  );
  if (side) return <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>{block.imagePosition === 'left' ? [picture, text] : [text, picture]}</View>;
  return (
    <View style={{ gap: 14 }}>
      {block.imagePosition === 'top' && picture}
      {text}
      {block.imagePosition === 'bottom' && picture}
    </View>
  );
}

/* ------------------------------------------------------------ Galería */

export function GalleryBlock({ doc, block }: { doc: PdfDoc; block: PdfBlockOf<'gallery'> }) {
  const { t } = doc;
  const pictures =
    block.source === 'custom'
      ? block.images.map((i) => ({ url: mediaUrl(i.path), caption: i.caption }))
      : resolveCollection(block.collection, doc.items).filter((i) => i.images.length > 0).map((i) => ({ url: i.images[0].url, caption: i.name }));
  if (pictures.length === 0) return null;
  const cols = block.columns;
  const gap = block.shape === 'hexagon' ? 4 : 10;
  const w = (t.contentWidth - gap * (cols - 1)) / cols;
  const h = block.shape === 'circle' || block.shape === 'hexagon' ? w : w * 0.8;
  const rows = chunk(pictures, cols);
  return (
    <View>
      <BlockTitle doc={doc} title={block.title} subtitle={block.subtitle} />
      {rows.map((row, ri) => (
        <View key={ri} wrap={false} style={{ flexDirection: 'row', gap, marginBottom: gap, marginLeft: block.shape === 'hexagon' && ri % 2 === 1 && row.length < cols ? w / 2 : 0 }}>
          {row.map((pic, i) => (
            <View key={i} style={{ width: w, alignItems: 'center' }}>
              <PdfShapedPicture ctx={doc} url={pic.url} width={w} height={h} shape={block.shape} />
              {block.captions && pic.caption && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, marginTop: 4, textAlign: 'center' }}>{pic.caption}</Text>}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------ Contacto */

export function ContactBlock({ doc, block }: { doc: PdfDoc; block?: PdfBlockOf<'contact'> }) {
  const { t, siteT, site } = doc;
  const c = site.business.contact;
  const address = [c.address, c.city].filter(Boolean).join(', ');
  const hours = hoursText(c, site.settings.locale, siteT('Cerrado'));
  const handle = socialHandle(site);
  const rows = [
    c.whatsapp && { icon: 'message-circle', label: 'WhatsApp', value: c.whatsapp },
    c.phone && { icon: 'phone', label: siteT('Teléfono'), value: c.phone },
    c.email && { icon: 'mail', label: 'Email', value: c.email },
    address && { icon: 'map-pin', label: siteT('Dirección'), value: address },
    hours && { icon: 'clock', label: siteT('Horarios'), value: hours },
    { icon: 'globe', label: siteT('Sitio'), value: (c.website || site.url).replace(/^https?:\/\//, '') },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  return (
    <View wrap={false} style={{ marginTop: 10, padding: 18, backgroundColor: t.colors.soft, borderRadius: t.radius }}>
      <Text style={{ ...headingStyle(doc, t.size.h2 * 0.9), marginBottom: 4 }}>{block?.title ? defaultText(block.title, siteT) : siteT('Contacto')}</Text>
      {block?.subtitle && <Text style={{ fontSize: t.size.base, color: t.colors.mutedText, marginBottom: 8 }}>{block.subtitle}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', gap: 6, width: (t.contentWidth - 36 - 12) / 2 }}>
            <PdfIcon id={row.icon} size={11} color={t.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, textTransform: 'uppercase', letterSpacing: 0.8 }}>{row.label}</Text>
              <Text style={{ fontSize: t.size.small, color: t.colors.text, lineHeight: 1.4 }}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>
      {c.additionalInfo && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 10, lineHeight: 1.4 }}>{c.additionalInfo}</Text>}
      {block?.notes && (
        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 0.6, borderTopColor: t.colors.border }}>
          <PdfRichText source={block.notes} ctx={doc} />
        </View>
      )}
      {(block?.showSocial ?? true) && site.business.socialLinks.length > 0 && (
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {handle && <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base, color: t.colors.accent }}>{handle}</Text>}
          <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, flex: 1 }}>{site.business.socialLinks.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, '')).join('   ·   ')}</Text>
        </View>
      )}
    </View>
  );
}

