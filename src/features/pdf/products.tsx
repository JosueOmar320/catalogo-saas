import { Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { ReactElement } from 'react';
import type { Presentation } from '@/lib/catalog/presentation';
import { discountPercent, type CatalogItemView } from '@/lib/catalog/view-model';
import { pdfAttributes, pdfFields, type PdfDoc } from './doc';
import { headingStyle, PdfBadges, PdfDiscount, PdfPicture, PdfPrice, PdfShapedPicture } from './primitives';

/**
 * Presentaciones de productos en PDF. Misma configuración que la web
 * (`Presentation`), otro renderer: aquí todo se mide en puntos y se arma en
 * FILAS indivisibles, para que un producto nunca quede cortado entre páginas
 * y el título de una categoría viaje con su primera fila.
 */

const RATIO = { square: 1, portrait: 4 / 3, landscape: 3 / 4, wide: 9 / 16 } as const;
const GAP = { tight: 8, normal: 12, loose: 18 } as const;
const THUMB = { sm: 38, md: 56, lg: 78 } as const;
const ZIG = { sm: 0.32, md: 0.42, lg: 0.5 } as const;
/** Layouts que muestran la imagen grande: usan la foto completa, no la miniatura. */
export const BIG_IMAGE_LAYOUTS = new Set(['largeCards', 'editorial', 'imageFocus', 'zigzag', 'detail', 'magazine']);

type Fields = ReturnType<typeof pdfFields>;
type Ctx = { doc: PdfDoc; p: Presentation; f: Fields };

const pictureUrl = (item: CatalogItemView, big: boolean, index = 0) => {
  const image = item.images[index];
  return image ? (big ? image.url : image.thumbUrl) : null;
};

/* ------------------------------------------------------------ Piezas */

function Name({ c, item, size, center, color }: { c: Ctx; item: CatalogItemView; size?: number; center?: boolean; color?: string }) {
  const { t } = c.doc;
  const upper = c.doc.skin.upper && c.doc.skin.card === 'framed';
  return (
    <Text style={{ ...headingStyle(c.doc, size ?? t.size.base * 1.05, color), fontWeight: 700, textAlign: center ? 'center' : 'left', textTransform: upper ? 'uppercase' : undefined, letterSpacing: upper ? 1.2 : undefined }}>
      {item.name}
    </Text>
  );
}

function Desc({ c, item, lines = 3, center, full, color }: { c: Ctx; item: CatalogItemView; lines?: number; center?: boolean; full?: boolean; color?: string }) {
  const text = full ? (item.description ?? item.shortDescription) : item.shortDescription;
  if (!c.f.description || !text) return null;
  const { t } = c.doc;
  return <Text style={{ fontSize: t.size.small, color: color ?? t.colors.mutedText, lineHeight: 1.45, marginTop: 3, maxLines: full ? undefined : lines, textOverflow: 'ellipsis', textAlign: center ? 'center' : 'left' }}>{text}</Text>;
}

function Meta({ c, item, center, color }: { c: Ctx; item: CatalogItemView; center?: boolean; color?: string }) {
  const parts = [
    c.f.category && item.categoryId ? c.doc.categoryNames.get(item.categoryId) : null,
    c.f.sku && item.sku ? c.doc.siteT('Cód. {sku}', { sku: item.sku }) : null,
    c.f.availability && !item.isAvailable ? c.doc.siteT('No disponible') : null,
  ].filter(Boolean);
  return parts.length ? <Text style={{ fontSize: c.doc.t.size.tiny, color: color ?? c.doc.t.colors.mutedText, marginTop: 3, textAlign: center ? 'center' : 'left' }}>{parts.join(' · ')}</Text> : null;
}

function Attrs({ c, item, center, color, list }: { c: Ctx; item: CatalogItemView; center?: boolean; color?: string; list?: boolean }) {
  const attrs = pdfAttributes(c.doc, item, c.f.attributes);
  if (!attrs.length) return null;
  const { t } = c.doc;
  if (list) {
    return (
      <View style={{ marginTop: 5, gap: 2 }}>
        {attrs.map((a) =>
          a.list ? (
            <View key={a.id}>
              <Text style={{ fontSize: t.size.small, fontWeight: 700, color: color ?? t.colors.heading }}>{a.name}</Text>
              {a.list.map((x) => (
                <Text key={x} style={{ fontSize: t.size.small, color: color ?? t.colors.text, lineHeight: 1.4 }}>•  {x}</Text>
              ))}
            </View>
          ) : (
            <Text key={a.id} style={{ fontSize: t.size.small, color: color ?? t.colors.text, lineHeight: 1.4 }}>
              <Text style={{ fontWeight: 700 }}>{a.name}: </Text>
              {a.value}
            </Text>
          ),
        )}
      </View>
    );
  }
  return (
    <Text style={{ fontSize: t.size.tiny, color: color ?? t.colors.mutedText, marginTop: 3, textAlign: center ? 'center' : 'left', lineHeight: 1.35 }}>
      {attrs.map((a) => `${a.name}: ${a.value}`).join('  ·  ')}
    </Text>
  );
}

function Price(props: { c: Ctx; item: CatalogItemView; size?: number; center?: boolean; color?: string }) {
  if (!props.c.f.price) return null;
  return (
    <>
      <PriceValue {...props} />
      <Options {...props} />
    </>
  );
}

/** Opciones con su precio: "Tamaño: 12 oz $68 · 16 oz $78". */
function Options({ c, item, center, color }: { c: Ctx; item: CatalogItemView; center?: boolean; color?: string }) {
  if (!item.variants) return null;
  const { t, siteT } = c.doc;
  const options = item.variants.options.map((o) => [o.name, o.priceLabel, o.available ? null : `(${siteT('Agotado')})`].filter(Boolean).join(' '));
  return (
    <Text style={{ fontSize: t.size.tiny, color: color ?? t.colors.mutedText, marginTop: 3, textAlign: center ? 'center' : 'left', lineHeight: 1.35 }}>
      {item.variants.label ? `${item.variants.label}: ` : ''}
      {options.join('  ·  ')}
    </Text>
  );
}

function PriceValue({ c, item, size, center, color }: { c: Ctx; item: CatalogItemView; size?: number; center?: boolean; color?: string }) {
  if (!c.f.price) return null;
  const { t, siteT, skin } = c.doc;
  const percent = c.f.discount ? discountPercent(item) : null;
  if (skin.price !== 'text' && item.priceLabel) {
    const pill = skin.price === 'pill';
    return (
      <View style={{ flexDirection: 'row', justifyContent: center ? 'center' : 'flex-start', marginTop: 5, alignItems: 'baseline', gap: 4 }}>
        {item.priceNote === 'desde' && <Text style={{ fontSize: t.size.tiny, color: color ?? t.colors.mutedText }}>{siteT('desde')}</Text>}
        <Text
          style={{
            fontFamily: t.fonts.price,
            fontWeight: 700,
            fontSize: size ?? t.size.base * 1.05,
            color: pill ? t.colors.onAccent : (color ?? t.colors.accent),
            backgroundColor: pill ? t.colors.accent : undefined,
            borderRadius: pill ? 9 : 0,
            paddingVertical: pill ? 2 : 0,
            paddingHorizontal: pill ? 7 : 0,
            borderBottomWidth: pill ? 0 : 1.2,
            borderBottomColor: t.colors.accent,
          }}
        >
          {item.priceLabel}
        </Text>
        {c.f.compareAt && item.compareAtLabel && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, textDecoration: 'line-through' }}>{item.compareAtLabel}</Text>}
        {percent !== null && <PdfDiscount ctx={c.doc} percent={percent} />}
      </View>
    );
  }
  return (
    <View style={{ marginTop: 5 }}>
      <PdfPrice item={item} ctx={c.doc} size={size} color={color} align={center ? 'center' : undefined} compare={c.f.compareAt} discount={c.f.discount} />
    </View>
  );
}

/** Contenedor de tarjeta según la skin de la plantilla. */
function cardStyle(c: Ctx): Style {
  const { t, skin } = c.doc;
  switch (skin.card) {
    case 'bordered':
      return { backgroundColor: t.colors.surface, borderWidth: t.borderWidth, borderColor: t.colors.border, borderRadius: t.radius, overflow: 'hidden' };
    case 'soft':
      return { backgroundColor: t.colors.surface, borderRadius: t.radius + 3, padding: 5 };
    case 'framed':
      return { borderWidth: 0.6, borderColor: t.colors.accent, padding: 7 };
    default:
      return {};
  }
}

/* ------------------------------------------------------------ Tarjeta (grid / grandes / revista) */

function Card({ c, item, width, large, compact }: { c: Ctx; item: CatalogItemView; width: number; large?: boolean; compact?: boolean }) {
  const { t, skin } = c.doc;
  const center = c.p.align === 'center' || skin.center;
  const box = cardStyle(c);
  const inner = width - (Number(box.padding ?? 0) * 2);
  const bordered = skin.card === 'bordered';
  const imgW = c.p.shape === 'circle' ? inner * 0.72 : inner;
  const imgH = c.p.shape === 'circle' ? imgW : Math.min(inner * RATIO[c.p.ratio], large ? 300 : compact ? 140 : 220);
  return (
    <View style={{ width, ...box }}>
      {c.f.image && (
        <View style={{ alignItems: center || c.p.shape === 'circle' ? 'center' : 'flex-start', paddingTop: c.p.shape === 'circle' && bordered ? 8 : 0 }}>
          <PdfShapedPicture ctx={c.doc} url={pictureUrl(item, Boolean(large))} width={imgW - (c.p.frame ? 8 : 0)} height={imgH - (c.p.frame ? 8 : 0)} shape={bordered && c.p.shape === 'rounded' ? 'rect' : c.p.shape} frame={c.p.frame} />
        </View>
      )}
      <View style={{ padding: bordered ? 8 : 0, paddingTop: c.f.image ? 7 : bordered ? 8 : 0, alignItems: center ? 'center' : 'stretch' }}>
        {c.f.badges && <PdfBadges item={item} ctx={c.doc} style={{ marginBottom: 4, justifyContent: center ? 'center' : 'flex-start' }} />}
        <Name c={c} item={item} size={large ? t.size.h3 : compact ? t.size.small : undefined} center={center} />
        <Desc c={c} item={item} lines={large ? 4 : compact ? 1 : 2} center={center} />
        {!compact && <Attrs c={c} item={item} center={center} />}
        <Price c={c} item={item} size={large ? t.size.h3 * 0.95 : compact ? t.size.small : undefined} center={center} />
        <Meta c={c} item={item} center={center} />
      </View>
    </View>
  );
}

/** Imagen protagonista: foto completa con el texto encima. */
function FocusCard({ c, item, width }: { c: Ctx; item: CatalogItemView; width: number }) {
  const { t } = c.doc;
  const h = Math.min(width * RATIO[c.p.ratio] * 1.15, 300);
  const radius = c.p.shape === 'rect' ? 0 : t.radius;
  return (
    <View style={{ width, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: t.colors.soft }}>
      <PdfPicture ctx={c.doc} url={pictureUrl(item, true)} style={{ position: 'absolute', top: 0, left: 0, width, height: h }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.55, backgroundColor: '#000000', opacity: 0.42 }} />
      <View style={{ position: 'absolute', left: 9, right: 9, bottom: 9 }}>
        {c.f.badges && <PdfBadges item={item} ctx={c.doc} style={{ marginBottom: 4 }} />}
        <Name c={c} item={item} color="#FFFFFF" />
        <Desc c={c} item={item} lines={2} color="#F2F2F2" />
        <Price c={c} item={item} color="#FFFFFF" />
      </View>
    </View>
  );
}

/** Minimalista: foto, nombre y precio, sin caja. */
function MinimalCard({ c, item, width }: { c: Ctx; item: CatalogItemView; width: number }) {
  const center = c.p.align === 'center';
  const imgW = c.p.shape === 'circle' ? width * 0.8 : width;
  const imgH = c.p.shape === 'circle' ? imgW : Math.min(width * RATIO[c.p.ratio], 220);
  return (
    <View style={{ width, alignItems: center ? 'center' : 'flex-start' }}>
      {c.f.image && <PdfShapedPicture ctx={c.doc} url={pictureUrl(item, false)} width={imgW} height={imgH} shape={c.p.shape} frame={c.p.frame} style={{ marginBottom: 6 }} />}
      <Name c={c} item={item} center={center} />
      <Price c={c} item={item} center={center} />
      {c.f.availability && !item.isAvailable && <Text style={{ fontSize: c.doc.t.size.tiny, color: c.doc.t.colors.error, marginTop: 2 }}>{c.doc.siteT('No disponible')}</Text>}
    </View>
  );
}

/** Comparación: una fila por ítem con precio y atributos en columnas. */
function comparisonRows(c: Ctx, items: CatalogItemView[], width: number): ReactElement[] {
  const { t } = c.doc;
  const mode = c.f.attributes === 'none' ? 'none' : c.f.attributes;
  const defs = mode === 'none' ? [] : c.doc.site.attributeDefs.filter((d) => d.showInPdf && (mode === 'all' || d.showInCard) && items.some((i) => i.attributes[d.id] !== undefined)).slice(0, 4);
  const thumb = THUMB[c.p.imageSize] * 0.8;
  const priceW = c.f.price ? 90 : 0;
  const skuW = c.f.sku ? 60 : 0;
  const nameW = Math.max(width * 0.34, 140);
  const attrW = defs.length ? (width - nameW - priceW - skuW) / defs.length : 0;
  const cell = (w: number, content: ReactElement | string, key: string, head?: boolean) => (
    <View key={key} style={{ width: w, paddingHorizontal: 5, justifyContent: 'center' }}>
      {typeof content === 'string' ? <Text style={{ fontSize: head ? t.size.tiny : t.size.small, fontWeight: head ? 700 : 400, color: head ? t.colors.mutedText : t.colors.text, textTransform: head ? 'uppercase' : undefined, letterSpacing: head ? 0.8 : undefined }}>{content}</Text> : content}
    </View>
  );
  const values = (item: CatalogItemView) => new Map(pdfAttributes(c.doc, item, 'all').map((a) => [a.id, a.list ? a.list.join(', ') : a.value]));
  const header = (
    <View key="head" wrap={false} style={{ flexDirection: 'row', paddingVertical: 6, backgroundColor: t.colors.soft, borderRadius: t.radius * 0.4 }}>
      {cell(nameW, c.doc.siteT('Producto'), 'n', true)}
      {c.f.price ? cell(priceW, c.doc.siteT('Precio'), 'p', true) : null}
      {defs.map((d) => cell(attrW, d.name, d.id, true))}
      {c.f.sku ? cell(skuW, c.doc.siteT('Código'), 's', true) : null}
    </View>
  );
  return [
    header,
    ...items.map((item) => {
      const v = values(item);
      return (
        <View key={item.id} wrap={false} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: t.colors.border, opacity: item.isAvailable ? 1 : 0.6 }}>
          {cell(
            nameW,
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {c.f.image && <PdfShapedPicture ctx={c.doc} url={pictureUrl(item, false)} width={thumb} height={thumb} shape={c.p.shape} />}
              <View style={{ flex: 1 }}>
                <Name c={c} item={item} size={t.size.small * 1.05} />
                <Meta c={c} item={{ ...item, sku: null }} />
              </View>
            </View>,
            'n',
          )}
          {c.f.price ? cell(priceW, <PdfPrice item={item} ctx={c.doc} size={t.size.small * 1.05} compare={c.f.compareAt} discount={c.f.discount} />, 'p') : null}
          {defs.map((d) => cell(attrW, v.get(d.id) ?? '—', d.id))}
          {c.f.sku ? cell(skuW, item.sku ?? '—', 's') : null}
        </View>
      );
    }),
  ];
}

/* ------------------------------------------------------------ Filas */

function gridRows(c: Ctx, items: CatalogItemView[], width: number, cols: number, render: (item: CatalogItemView, w: number) => ReactElement) {
  const gap = GAP[c.p.gap] * c.doc.t.density;
  const w = (width - gap * (cols - 1)) / cols;
  const rows: ReactElement[] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(
      <View key={`r${i}`} wrap={false} style={{ flexDirection: 'row', gap, marginBottom: gap }}>
        {items.slice(i, i + cols).map((item) => (
          <View key={item.id}>{render(item, w)}</View>
        ))}
      </View>,
    );
  }
  return rows;
}

function listRow(c: Ctx, item: CatalogItemView, width: number) {
  const { t } = c.doc;
  const thumb = THUMB[c.p.imageSize];
  const right = c.p.imagePosition === 'right';
  const picture = c.f.image && item.images.length > 0 ? <PdfShapedPicture key="img" ctx={c.doc} url={pictureUrl(item, false)} width={thumb} height={thumb} shape={c.p.shape} frame={c.p.frame} /> : null;
  const body = (
    <View key="body" style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Name c={c} item={item} />
          <Desc c={c} item={item} lines={2} />
          <Attrs c={c} item={item} />
          <Meta c={c} item={item} />
          {c.f.badges && <PdfBadges item={item} ctx={c.doc} style={{ marginTop: 3 }} />}
        </View>
        {c.f.price && (
          <View style={{ width: 96, marginTop: -5 }}>
            <PdfPrice item={item} ctx={c.doc} align="right" size={t.size.base} compare={c.f.compareAt} discount={c.f.discount} />
          </View>
        )}
      </View>
    </View>
  );
  return (
    <View key={item.id} wrap={false} style={{ width, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 7, borderBottomWidth: c.p.separators ? 0.5 : 0, borderBottomColor: t.colors.border }}>
      {right ? [body, picture] : [picture, body]}
    </View>
  );
}

function priceListRows(c: Ctx, items: CatalogItemView[], width: number) {
  const { t } = c.doc;
  const cols = Math.min(c.p.columns.pdf, 2);
  const gap = 24;
  const w = (width - gap * (cols - 1)) / cols;
  const thumb = THUMB[c.p.imageSize] * 0.75;
  const entry = (item: CatalogItemView) => (
    <View key={item.id} style={{ width: w, flexDirection: 'row', gap: 8, paddingVertical: 5, borderBottomWidth: c.p.separators ? 0.5 : 0, borderBottomColor: t.colors.border }}>
      {c.f.image && item.images.length > 0 && <PdfShapedPicture ctx={c.doc} url={pictureUrl(item, false)} width={thumb} height={thumb} shape={c.p.shape} />}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.base * 1.05, color: t.colors.heading, maxWidth: w * 0.7 }}>{item.name}</Text>
          <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: t.colors.border, borderStyle: 'dotted', marginBottom: 3 }} />
          {c.f.price && <Text style={{ fontFamily: t.fonts.price, fontWeight: 700, fontSize: t.size.base * 1.05, color: t.colors.price }}>{item.priceLabel ?? item.priceNote ?? '—'}</Text>}
        </View>
        {c.f.description && item.shortDescription && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, fontStyle: 'italic', marginTop: 1 }}>{item.shortDescription}</Text>}
        <Attrs c={c} item={item} />
        <Meta c={c} item={item} />
        {c.f.badges && <PdfBadges item={item} ctx={c.doc} style={{ marginTop: 3 }} />}
      </View>
    </View>
  );
  const rows: ReactElement[] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(
      <View key={`p${i}`} wrap={false} style={{ flexDirection: 'row', gap }}>
        {items.slice(i, i + cols).map(entry)}
      </View>,
    );
  }
  return rows;
}

function zigzagRow(c: Ctx, item: CatalogItemView, index: number, width: number) {
  const { t } = c.doc;
  const right = c.p.imagePosition === 'right' || (c.p.imagePosition === 'alternate' && index % 2 === 1);
  const imgW = width * ZIG[c.p.imageSize];
  const imgH = c.p.shape === 'arch' ? imgW * 1.25 : c.p.shape === 'circle' ? imgW : Math.min(imgW * RATIO[c.p.ratio], 320);
  // Orden explícito (react-pdf no maneja bien row-reverse).
  const picture = c.f.image ? <PdfShapedPicture key="img" ctx={c.doc} url={pictureUrl(item, true)} width={imgW - (c.p.frame ? 8 : 0)} height={imgH - (c.p.frame ? 8 : 0)} shape={c.p.shape} frame={c.p.frame} /> : null;
  const body = (
    <View key="body" style={{ flex: 1, paddingHorizontal: 4 }}>
      {c.f.badges && <PdfBadges item={item} ctx={c.doc} style={{ marginBottom: 5 }} />}
      {c.f.category && item.categoryId && <Text style={{ fontSize: t.size.tiny, letterSpacing: 1.5, textTransform: 'uppercase', color: t.colors.accent, marginBottom: 3 }}>{c.doc.categoryNames.get(item.categoryId)}</Text>}
      <Name c={c} item={item} size={t.size.h3 * 1.15} />
      <Desc c={c} item={item} lines={7} full />
      <Attrs c={c} item={item} list />
      <Price c={c} item={item} size={t.size.h3} />
      {c.f.sku && item.sku && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, marginTop: 3 }}>Cód. {item.sku}</Text>}
    </View>
  );
  return (
    <View key={item.id} wrap={false} style={{ width, flexDirection: 'row', gap: 20, alignItems: 'center', marginBottom: 22 }}>
      {right ? [body, picture] : [picture, body]}
    </View>
  );
}

function detailRow(c: Ctx, item: CatalogItemView, width: number) {
  const { t } = c.doc;
  const imgW = width * 0.44;
  const thumbs = c.p.gallery ? item.images.slice(1, 4) : [];
  const specs = pdfAttributes(c.doc, item, c.f.attributes === 'none' ? 'none' : 'all');
  const right = c.p.imagePosition === 'right';
  const media = (
    <View key="media" style={{ width: imgW }}>
      {c.f.image && <PdfShapedPicture ctx={c.doc} url={pictureUrl(item, true)} width={imgW} height={imgW * (c.p.shape === 'arch' ? 1.2 : 1)} shape={c.p.shape} />}
      {thumbs.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 5 }}>
          {thumbs.map((_, i) => (
            <PdfPicture key={i} ctx={c.doc} url={pictureUrl(item, false, i + 1)} style={{ width: (imgW - 10) / 3, height: (imgW - 10) / 3, borderRadius: t.radius * 0.5 }} />
          ))}
        </View>
      )}
    </View>
  );
  const info = (
    <View key="info" style={{ flex: 1 }}>
      {c.f.badges && <PdfBadges item={item} ctx={c.doc} style={{ marginBottom: 5 }} />}
      {c.f.category && item.categoryId && <Text style={{ fontSize: t.size.tiny, letterSpacing: 1.5, textTransform: 'uppercase', color: t.colors.accent }}>{c.doc.categoryNames.get(item.categoryId)}</Text>}
      <Text style={{ ...headingStyle(c.doc, t.size.h2 * 0.8), marginTop: 2 }}>{item.name}</Text>
      {c.f.sku && item.sku && <Text style={{ fontSize: t.size.small, color: t.colors.mutedText, marginTop: 2 }}>Código: {item.sku}</Text>}
      <Price c={c} item={item} size={t.size.h3 * 1.1} />
      <Desc c={c} item={item} full />
      {specs.length > 0 && (
        <View style={{ marginTop: 8, borderTopWidth: 0.6, borderTopColor: t.colors.border }}>
          {specs.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.6, borderBottomColor: t.colors.border }}>
              <Text style={{ width: '38%', fontSize: t.size.small, fontWeight: 700, color: t.colors.mutedText }}>{s.name}</Text>
              <Text style={{ flex: 1, fontSize: t.size.small, color: t.colors.text, lineHeight: 1.35 }}>{s.list ? s.list.map((x) => `• ${x}`).join('\n') : s.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
  return (
    <View key={item.id} wrap={false} style={{ width, flexDirection: 'row', gap: 18, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 0.6, borderBottomColor: t.colors.border }}>
      {right ? [info, media] : [media, info]}
    </View>
  );
}

/** Destacado de "editorial" (uno grande + dos chicos) o "revista" (uno horizontal). */
function featureRow(c: Ctx, items: CatalogItemView[], width: number): { row: ReactElement; used: number } {
  const { t } = c.doc;
  const gap = GAP[c.p.gap];
  const [first] = items;
  if (c.p.layout === 'magazine') {
    const imgW = width * 0.55;
    return {
      used: 1,
      row: (
        <View key="feature" wrap={false} style={{ flexDirection: 'row', gap: 16, marginBottom: gap * 1.4, alignItems: 'center', ...cardStyle(c) }}>
          <PdfShapedPicture ctx={c.doc} url={pictureUrl(first, true)} width={imgW} height={Math.min(imgW * RATIO[c.p.ratio], 300)} shape={c.p.shape} frame={c.p.frame} />
          <View style={{ flex: 1, paddingRight: 6 }}>
            {c.f.badges && <PdfBadges item={first} ctx={c.doc} style={{ marginBottom: 5 }} />}
            <Name c={c} item={first} size={t.size.h2 * 0.85} />
            <Desc c={c} item={first} lines={6} full />
            <Attrs c={c} item={first} />
            <Price c={c} item={first} size={t.size.h3} />
          </View>
        </View>
      ),
    };
  }
  const bigW = (width - gap) * 0.62;
  const smallW = width - gap - bigW;
  const side = items.slice(1, 3);
  return {
    used: 1 + side.length,
    row: (
      <View key="feature" wrap={false} style={{ flexDirection: 'row', gap, marginBottom: gap }}>
        <Card c={c} item={first} width={bigW} large />
        <View style={{ width: smallW, gap }}>
          {side.map((item) => (
            <Card key={item.id} c={c} item={item} width={smallW} />
          ))}
        </View>
      </View>
    ),
  };
}

/** Filas indivisibles de una lista de ítems con la presentación indicada. */
export function productRows(doc: PdfDoc, items: CatalogItemView[], p: Presentation, width = doc.t.contentWidth): ReactElement[] {
  if (items.length === 0) return [];
  const c: Ctx = { doc, p, f: pdfFields(doc, p) };
  const cols = p.columns.pdf;
  switch (p.layout) {
    case 'grid':
      return gridRows(c, items, width, cols, (item, w) => <Card c={c} item={item} width={w} />);
    case 'largeCards':
      return gridRows(c, items, width, Math.min(cols, 2), (item, w) => <Card c={c} item={item} width={w} large />);
    case 'imageFocus':
      return gridRows(c, items, width, cols, (item, w) => <FocusCard c={c} item={item} width={w} />);
    case 'editorial':
    case 'magazine': {
      const { row, used } = featureRow(c, items, width);
      return [row, ...gridRows(c, items.slice(used), width, Math.max(2, cols), (item, w) => <Card c={c} item={item} width={w} />)];
    }
    case 'compactList':
      return items.map((item) => listRow(c, item, width));
    case 'priceList':
      return priceListRows(c, items, width);
    case 'zigzag':
      return items.map((item, i) => zigzagRow(c, item, i, width));
    case 'detail':
      return items.map((item) => detailRow(c, item, width));
    case 'compactGrid':
      return gridRows(c, items, width, Math.min(cols + 1, 6), (item, w) => <Card c={c} item={item} width={w} compact />);
    case 'minimal':
      return gridRows(c, items, width, cols, (item, w) => <MinimalCard c={c} item={item} width={w} />);
    case 'comparison':
      return comparisonRows(c, items, width);
  }
}
