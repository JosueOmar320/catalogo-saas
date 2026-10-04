/* eslint-disable jsx-a11y/alt-text -- <Image> de react-pdf no admite `alt`. */
import { Circle, G, Image, Line, Path, Rect, Svg, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { PdfSettings } from '@/lib/pdf/settings';
import type { SiteViewModel } from '@/lib/site/view-model';
import { sectionTitleAt, type PdfDoc } from './doc';
import { img, type PdfContext } from './primitives';

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

/** "@usuario" de la primera red social (como en los pies de página de catálogos impresos). */
export function socialHandle(site: SiteViewModel): string | null {
  const link = site.business.socialLinks[0];
  if (!link) return null;
  const path = link.url.replace(/^https?:\/\/(www\.)?[^/]+\/?/, '').replace(/\/$/, '').split(/[/?#]/)[0];
  return path ? `@${path.replace(/^@/, '')}` : link.url.replace(/^https?:\/\/(www\.)?/, '');
}

/* ------------------------------------------------------------ Encabezado */

export function PdfHeader({ doc }: { doc: PdfDoc }) {
  const { t, settings, site } = doc;
  const h = settings.header;
  if (h.style === 'none') return null;
  const logo = img(doc, site.business.logoUrl);
  const pageText = (n: number) => [h.showSectionTitle ? sectionTitleAt(doc, n) : '', h.text, h.showPageNumber ? String(n) : ''].filter(Boolean).join('   ·   ');

  if (h.style === 'band') {
    const height = t.margin * 0.5 + 30;
    const ink = t.colors.onPrimary;
    return (
      <View fixed style={{ position: 'absolute', top: 0, left: 0, width: t.pageWidth, height, backgroundColor: h.color || t.colors.primary, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: t.margin, paddingBottom: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {h.showLogo && logo && <Image src={logo} style={{ width: 16, height: 16, objectFit: 'contain' }} />}
          {h.showName && <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.small * 1.05, color: ink }}>{site.business.name}</Text>}
        </View>
        <Text style={{ fontSize: t.size.tiny, color: ink, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.9 }} render={({ pageNumber }) => pageText(pageNumber)} />
      </View>
    );
  }

  if (h.style === 'title') {
    // Título centrado entre líneas: "— CATÁLOGO DE SERVICIOS —".
    const color = h.color || t.colors.heading;
    return (
      <View fixed style={{ position: 'absolute', top: t.margin * 0.55, left: t.margin, right: t.margin, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 0.8, backgroundColor: t.colors.accent }} />
        {h.showLogo && logo && <Image src={logo} style={{ width: 14, height: 14, objectFit: 'contain' }} />}
        <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.small, letterSpacing: 2.5, textTransform: 'uppercase', color }} render={({ pageNumber }) => [h.showName || !h.text ? site.business.name : '', h.text, h.showPageNumber ? String(pageNumber) : ''].filter(Boolean).join('  ·  ')} />
        <View style={{ flex: 1, height: 0.8, backgroundColor: t.colors.accent }} />
      </View>
    );
  }

  const color = h.color || t.colors.heading;
  // Logo/nombre a la izquierda (texto a la derecha), a la derecha (texto a la izquierda) o centrado (texto debajo).
  const brand = (
    <View key="brand" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {h.showLogo && logo && <Image src={logo} style={{ width: 16, height: 16, objectFit: 'contain' }} />}
      {h.showName && <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.small, color }}>{site.business.name}</Text>}
    </View>
  );
  const info = <Text key="info" style={{ fontSize: t.size.tiny, color, letterSpacing: 1, textTransform: 'uppercase', textAlign: h.align === 'center' ? 'center' : h.align === 'right' ? 'left' : 'right' }} render={({ pageNumber }) => pageText(pageNumber)} />;
  return (
    <View fixed style={{ position: 'absolute', top: t.margin * 0.55, left: t.margin, right: t.margin, flexDirection: h.align === 'center' ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: h.align === 'center' ? 2 : 0, paddingBottom: 6, borderBottomWidth: 0.6, borderBottomColor: h.color || t.colors.border }}>
      {h.align === 'right' ? [info, brand] : [brand, info]}
    </View>
  );
}

/* ------------------------------------------------------------ Pie */

export function PdfFooter({ doc }: { doc: PdfDoc }) {
  const { t, settings, site } = doc;
  const f = settings.footer;
  if (f.style === 'none') return null;
  const handle = f.showSocial ? socialHandle(site) : null;
  const text = [f.showBusinessName ? site.business.name : '', contactLine(site, { phone: f.showPhone, whatsapp: f.showWhatsapp, email: f.showEmail, website: f.showWebsite }), f.customText].filter(Boolean).join('   ·   ');
  const numbers = (n: number, total: number) => (f.pageNumbers === 'none' ? '' : f.pageNumbers === 'ofTotal' ? `${n} / ${total}` : String(n));

  if (f.style === 'band') {
    const height = t.margin * 0.45 + 26;
    const ink = t.colors.onPrimary;
    const logo = img(doc, site.business.logoUrl);
    return (
      <View fixed style={{ position: 'absolute', bottom: 0, left: 0, width: t.pageWidth, height, backgroundColor: t.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: t.margin, paddingBottom: t.margin * 0.15 }}>
        <View style={{ flex: 1 }}>
          {handle && <Text style={{ fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.small * 1.1, color: ink }}>{handle}</Text>}
          {text && <Text style={{ fontSize: t.size.tiny, color: ink, opacity: 0.85 }}>{text}</Text>}
        </View>
        <Text style={{ fontSize: t.size.tiny, color: ink }} render={({ pageNumber, totalPages }) => numbers(pageNumber, totalPages)} />
        {logo && <Image src={logo} style={{ width: 20, height: 20, objectFit: 'contain' }} />}
      </View>
    );
  }

  return (
    <View fixed style={{ position: 'absolute', bottom: t.margin * 0.55, left: t.margin, right: t.margin, flexDirection: f.align === 'center' ? 'column' : 'row', alignItems: f.align === 'center' ? 'center' : 'stretch', justifyContent: 'space-between', gap: f.align === 'center' ? 2 : 12, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: t.colors.border }}>
      <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, flex: f.align === 'center' ? undefined : 1, textAlign: f.align === 'center' ? 'center' : 'left' }}>{[handle, text].filter(Boolean).join('   ·   ')}</Text>
      {f.pageNumbers !== 'none' && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText }} render={({ pageNumber, totalPages }) => numbers(pageNumber, totalPages)} />}
    </View>
  );
}

/* ------------------------------------------------------------ Decoración */

type Corners = PdfSettings['decorations']['corners'];

/** Forma decorativa para una esquina (dibujada para la esquina inferior izquierda; se refleja para las demás). */
function cornerShape(kind: Corners, s: number, color: string, key: string): ReactNode {
  switch (kind) {
    case 'waves':
      return (
        <G key={key}>
          <Path d={`M0 ${s * 0.35} C ${s * 0.3} ${s * 0.25}, ${s * 0.45} ${s * 0.65}, ${s} ${s} L0 ${s} Z`} fill={color} opacity={0.18} />
          <Path d={`M0 ${s * 0.6} C ${s * 0.25} ${s * 0.5}, ${s * 0.4} ${s * 0.85}, ${s * 0.75} ${s} L0 ${s} Z`} fill={color} opacity={0.3} />
          <Path d={`M0 ${s * 0.2} C ${s * 0.35} ${s * 0.1}, ${s * 0.55} ${s * 0.55}, ${s * 1.1} ${s * 0.95}`} stroke={color} strokeWidth={1} fill="none" opacity={0.5} />
        </G>
      );
    case 'blobs':
      return (
        <G key={key}>
          <Path d={`M0 ${s * 0.3} C ${s * 0.25} ${s * 0.22}, ${s * 0.5} ${s * 0.42}, ${s * 0.55} ${s * 0.68} C ${s * 0.6} ${s * 0.9}, ${s * 0.85} ${s * 0.92}, ${s} ${s} L0 ${s} Z`} fill={color} opacity={0.2} />
          <Circle cx={s * 0.72} cy={s * 0.55} r={s * 0.07} fill={color} opacity={0.35} />
          <Circle cx={s * 0.18} cy={s * 0.15} r={s * 0.04} fill={color} opacity={0.3} />
        </G>
      );
    case 'lines':
      return (
        <G key={key}>
          {Array.from({ length: 7 }, (_, i) => (
            <Line key={i} x1={0} y1={s * (0.25 + i * 0.11)} x2={s * (0.75 - i * 0.11)} y2={s} stroke={color} strokeWidth={0.8} opacity={0.45} />
          ))}
        </G>
      );
    case 'dots':
      return (
        <G key={key}>
          {Array.from({ length: 6 }, (_, r) =>
            Array.from({ length: 6 - r }, (_, c) => <Circle key={`${r}-${c}`} cx={8 + c * 12} cy={s - 8 - r * 12} r={2} fill={color} opacity={0.4} />),
          )}
        </G>
      );
    default:
      return null;
  }
}

/** Destello de 4 puntas. */
function sparkle(x: number, y: number, r: number, color: string, key: string | number) {
  const k = r * 0.22;
  return <Path key={key} d={`M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r} Z`} fill={color} />;
}

/**
 * Elementos decorativos genéricos (no atados a una industria): esquinas,
 * destellos y marco. Se dibujan detrás del contenido; `fixed` = en cada página.
 */
export function PdfDecorations({ ctx, corners, sparkles, frame, color, fixed, width, height }: { ctx: PdfContext; corners: Corners; sparkles: boolean; frame: boolean; color?: string; fixed?: boolean; width: number; height: number }) {
  const { t } = ctx;
  if (corners === 'none' && !sparkles && !frame) return null;
  const c = color || t.colors.accent;
  const s = Math.min(width, height) * 0.3;
  const inset = t.margin * 0.4;
  return (
    <View fixed={fixed} style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Svg width={width} height={height}>
        {corners !== 'none' && (
          <>
            <G transform={`translate(0 ${height - s})`}>{cornerShape(corners, s, c, 'bl')}</G>
            <G transform={`translate(${width} ${s}) rotate(180)`}>{cornerShape(corners, s, t.colors.primary, 'tr')}</G>
          </>
        )}
        {sparkles && (
          <G opacity={0.75}>
            {sparkle(width - t.margin * 0.9, height * 0.18, 7, c, 1)}
            {sparkle(width - t.margin * 0.55, height * 0.22, 3.5, c, 2)}
            {sparkle(t.margin * 0.7, height * 0.62, 5, c, 3)}
            {sparkle(width * 0.5, height - t.margin * 0.35, 3, c, 4)}
          </G>
        )}
        {frame && (
          <>
            <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} stroke={c} strokeWidth={0.8} fill="none" />
            <Rect x={inset + 4} y={inset + 4} width={width - inset * 2 - 8} height={height - inset * 2 - 8} stroke={c} strokeWidth={0.4} fill="none" />
          </>
        )}
      </Svg>
    </View>
  );
}
