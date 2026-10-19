/* eslint-disable jsx-a11y/alt-text -- <Image> de react-pdf no admite `alt`. */
import { Circle, Defs, G, Image, Line, Link, LinearGradient, Path, Polyline, RadialGradient, Rect, Stop, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { ReactNode } from 'react';
import type { Translator } from '@/i18n/translate';
import { discountPercent, type CatalogItemView } from '@/lib/catalog/view-model';
import type { Background } from '@/lib/design/background';
import { readableOn } from '@/lib/design/color';
import { ICONS, isIconId } from '@/lib/design/icons';
import { PATTERNS, type PatternShape } from '@/lib/design/patterns';
import { parseRichText, type Inline } from '@/lib/design/rich-text';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveBadges } from '@/lib/site/resolve';
import { mediaUrl } from '@/lib/utils/storage';
import { defaultText } from '@/site-renderer/default-texts';
import type { PdfImage } from './images';
import type { PdfTokens } from './tokens';

export type PdfContext = {
  t: PdfTokens;
  /** Textos fijos del PDF en el idioma del negocio (`t` son los tokens de diseño). */
  siteT: Translator;
  theme: ThemeConfig;
  images: Map<string, PdfImage>;
};

export function img(ctx: PdfContext, url: string | null | undefined): PdfImage | undefined {
  return url ? ctx.images.get(url) : undefined;
}

/* ------------------------------------------------------------ Fondo */

const MAX_PATTERN_SHAPES = 1400;

function patternShapes(bg: Background, width: number, height: number) {
  const def = PATTERNS[bg.pattern.id];
  // En PDF se limita la cantidad de figuras (tamaño del archivo) agrandando la escala si hace falta.
  let scale = bg.pattern.scale;
  const count = (s: number) => Math.ceil(width / (def.tile * s)) * Math.ceil(height / (def.tile * s)) * def.shapes.length;
  while (count(scale) > MAX_PATTERN_SHAPES) scale *= 1.25;
  const tile = def.tile * scale;
  const out: ReactNode[] = [];
  let key = 0;
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      out.push(<G key={key++} transform={`translate(${x} ${y}) scale(${scale})`}>{def.shapes.map((shape, i) => shapeNode(shape, i, bg.pattern.color))}</G>);
    }
  }
  return out;
}

function shapeNode(shape: PatternShape, key: number, color: string) {
  switch (shape.kind) {
    case 'circle':
      return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} fill={color} />;
    case 'rect':
      return <Rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill={color} />;
    case 'line':
      return <Line key={key} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={color} strokeWidth={shape.width} />;
    case 'path':
      return <Path key={key} d={shape.d} stroke={color} strokeWidth={shape.width} fill="none" />;
  }
}

/**
 * Fondo en PDF a partir del MISMO modelo que la web: color, degradado,
 * imagen (con opacidad) y patrón, más overlay.
 */
export function PdfBackground({ ctx, background, width, height, fixed, style }: { ctx: PdfContext; background: Background; width: number; height: number; fixed?: boolean; style?: Style }) {
  if (background.type === 'inherit') return null;
  const image = background.type === 'image' ? img(ctx, mediaUrl(background.image.path)) : undefined;
  const id = `g${Math.round(width)}${Math.round(height)}${background.gradient.angle}`;
  const angle = (background.gradient.angle - 90) * (Math.PI / 180);
  return (
    <View fixed={fixed} style={{ position: 'absolute', top: 0, left: 0, width, height, ...style }}>
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        {background.type === 'gradient' ? (
          <>
            <Defs>
              {background.gradient.kind === 'radial' ? (
                <RadialGradient id={id} cx="50%" cy="50%" r="70%">
                  <Stop offset="0" stopColor={background.gradient.from} />
                  <Stop offset="1" stopColor={background.gradient.to} />
                </RadialGradient>
              ) : (
                <LinearGradient id={id} x1={0.5 - Math.cos(angle) / 2} y1={0.5 - Math.sin(angle) / 2} x2={0.5 + Math.cos(angle) / 2} y2={0.5 + Math.sin(angle) / 2}>
                  <Stop offset="0" stopColor={background.gradient.from} />
                  <Stop offset="1" stopColor={background.gradient.to} />
                </LinearGradient>
              )}
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
          </>
        ) : (
          <Rect x={0} y={0} width={width} height={height} fill={background.color} />
        )}
        {background.type === 'pattern' && <G opacity={background.pattern.opacity / 100}>{patternShapes(background, width, height)}</G>}
      </Svg>
      {image && <Image src={image} style={{ position: 'absolute', top: 0, left: 0, width, height, objectFit: background.image.size === 'contain' ? 'contain' : 'cover', opacity: background.image.opacity / 100 }} />}
      {background.overlay.opacity > 0 && background.type !== 'color' && (
        <View style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: background.overlay.color, opacity: background.overlay.opacity / 100 }} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------ Íconos */

export function PdfIcon({ id, size = 12, color }: { id: string; size?: number; color: string }) {
  if (!isIconId(id)) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ICONS[id].node.map(([tag, attrs], i) => {
        const common = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
        const a = attrs as Record<string, string>;
        switch (tag) {
          case 'path':
            return <Path key={i} d={a.d} {...common} />;
          case 'circle':
            return <Circle key={i} cx={a.cx} cy={a.cy} r={a.r} {...common} />;
          case 'rect':
            return <Rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} {...common} />;
          case 'line':
            return <Line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} {...common} />;
          case 'polyline':
            return <Polyline key={i} points={a.points} {...common} />;
          default:
            return null;
        }
      })}
    </Svg>
  );
}

/* ------------------------------------------------------------ Texto */

function inlines(list: Inline[], ctx: PdfContext) {
  return list.map((inline, i) => {
    const style: Style = { fontWeight: inline.bold ? 700 : undefined, fontStyle: inline.italic ? 'italic' : undefined };
    return inline.href ? (
      <Link key={i} src={inline.href} style={{ ...style, color: ctx.t.colors.accent, textDecoration: 'none' }}>{inline.text}</Link>
    ) : (
      <Text key={i} style={style}>{inline.text}</Text>
    );
  });
}

/** Texto enriquecido: mismo parser que la web. */
export function PdfRichText({ source, ctx, color }: { source: string; ctx: PdfContext; color?: string }) {
  const { t } = ctx;
  const base: Style = { fontSize: t.size.base, lineHeight: 1.5, color: color ?? t.colors.text, marginBottom: 6 };
  return (
    <View>
      {parseRichText(source).map((block, i) => {
        if (block.type === 'p') return <Text key={i} style={base}>{inlines(block.inlines, ctx)}</Text>;
        if (block.type === 'h') return <Text key={i} style={{ ...base, fontFamily: t.fonts.heading, fontWeight: 700, fontSize: t.size.h3, color: color ?? t.colors.heading, marginTop: 4 }}>{inlines(block.inlines, ctx)}</Text>;
        return (
          <View key={i} style={{ marginBottom: 6 }}>
            {block.items.map((item, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                <Text style={{ ...base, marginBottom: 0 }}>{block.type === 'ul' ? '•' : `${j + 1}.`}</Text>
                <Text style={{ ...base, marginBottom: 0, flex: 1 }}>{inlines(item, ctx)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function headingStyle(ctx: PdfContext, size: number, color?: string): Style {
  const { t } = ctx;
  return {
    fontFamily: t.fonts.heading,
    fontWeight: t.headingWeight,
    fontSize: size,
    color: color ?? t.colors.heading,
    letterSpacing: t.letterSpacing,
    textTransform: t.headingUpper ? 'uppercase' : 'none',
    lineHeight: 1.15,
  };
}

/* ------------------------------------------------------------ Precio y badges */

export function PdfPrice({ item, ctx, size, color, align, compare = true, discount = false }: { item: CatalogItemView; ctx: PdfContext; size?: number; color?: string; align?: 'left' | 'right' | 'center'; compare?: boolean; discount?: boolean }) {
  const { t, siteT } = ctx;
  const s = size ?? t.size.base * 1.1;
  const percent = discount ? discountPercent(item) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
      {item.priceLabel ? (
        <>
          {item.priceNote === 'desde' && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText }}>{siteT('desde')}</Text>}
          <Text style={{ fontFamily: t.fonts.price, fontWeight: 700, fontSize: s, color: color ?? t.colors.price }}>{item.priceLabel}</Text>
          {compare && item.compareAtLabel && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText, textDecoration: 'line-through' }}>{item.compareAtLabel}</Text>}
          {percent !== null && <PdfDiscount ctx={ctx} percent={percent} />}
          {item.priceNote && item.priceNote !== 'desde' && <Text style={{ fontSize: t.size.tiny, color: t.colors.mutedText }}>{item.priceNote}</Text>}
        </>
      ) : (
        <Text style={{ fontSize: t.size.small, color: t.colors.mutedText }}>{item.priceNote ?? siteT('Precio a consultar')}</Text>
      )}
    </View>
  );
}

/** "-20%" en el color de error del tema. */
export function PdfDiscount({ ctx, percent }: { ctx: PdfContext; percent: number }) {
  const { t } = ctx;
  return <Text style={{ fontSize: t.size.tiny, fontWeight: 700, color: t.colors.error, borderWidth: 0.6, borderColor: t.colors.error, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 }}>-{percent}%</Text>;
}

export function PdfBadges({ item, ctx, style }: { item: CatalogItemView; ctx: PdfContext; style?: Style }) {
  const badges = resolveBadges(item, ctx.theme);
  if (!badges.length) return null;
  const { shape, style: variant } = ctx.theme.badges;
  return (
    <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap', ...style }}>
      {badges.map((b) => (
        <Text
          key={b.key}
          style={{
            fontSize: ctx.t.size.tiny * 0.9,
            fontWeight: 700,
            paddingVertical: 1.5,
            paddingHorizontal: 5,
            borderRadius: shape === 'pill' ? 8 : 2,
            backgroundColor: variant === 'outline' ? '#FFFFFF' : b.color,
            color: variant === 'outline' ? b.color : readableOn(b.color),
            borderWidth: variant === 'outline' ? 0.8 : 0,
            borderColor: b.color,
          }}
        >
          {defaultText(b.label, ctx.siteT)}
        </Text>
      ))}
    </View>
  );
}

/** Imagen o, si no hay, un bloque suave del color de marca. */
export function PdfPicture({ ctx, url, style }: { ctx: PdfContext; url?: string | null; style: Style }) {
  const image = img(ctx, url);
  return image ? <Image src={image} style={{ objectFit: 'cover', ...style }} /> : <View style={{ backgroundColor: ctx.t.colors.soft, ...style }} />;
}

/** Máscara de las 4 esquinas de un hexágono (con 2 pt de sobra para tapar el borde de la imagen). */
function hexMask(w: number, h: number) {
  const e = 2;
  return [
    `M${-e} ${-e} H${w * 0.25} L${-e} ${h / 2} Z`,
    `M${w * 0.75} ${-e} H${w + e} V${h / 2} Z`,
    `M${-e} ${h / 2} L${w * 0.25} ${h + e} H${-e} Z`,
    `M${w + e} ${h / 2} V${h + e} H${w * 0.75} Z`,
    `M${-e} ${-e} H${w + e} V0 H${-e} Z M${-e} ${h} H${w + e} V${h + e} H${-e} Z`,
  ].join(' ');
}

export type PdfShape = 'rect' | 'rounded' | 'circle' | 'arch' | 'hexagon';

/**
 * Imagen con forma (recta, redondeada, círculo, arco, hexágono) y marco
 * opcional: la misma decisión que `presentation.shape` en la web.
 */
export function PdfShapedPicture({ ctx, url, width, height, shape = 'rect', frame, style }: { ctx: PdfContext; url?: string | null; width: number; height: number; shape?: PdfShape; frame?: boolean; style?: Style }) {
  const { t } = ctx;
  const w = shape === 'circle' || shape === 'hexagon' ? Math.min(width, height) : width;
  const h = shape === 'circle' || shape === 'hexagon' ? w : height;
  const radius: Style =
    shape === 'rounded'
      ? { borderRadius: t.radius }
      : shape === 'circle'
        ? { borderRadius: w / 2 }
        : shape === 'arch'
          ? { borderTopLeftRadius: w / 2, borderTopRightRadius: w / 2, borderBottomLeftRadius: t.radius * 0.5, borderBottomRightRadius: t.radius * 0.5 }
          : {};
  const picture =
    shape === 'hexagon' ? (
      <View style={{ width: w, height: h }}>
        <PdfPicture ctx={ctx} url={url} style={{ width: w, height: h }} />
        {/* Esquinas del hexágono tapadas con el color del papel. */}
        <Svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ position: 'absolute', top: -2, left: -2 }}>
          <Path d={hexMask(w, h)} fill={t.colors.paper} />
        </Svg>
      </View>
    ) : (
      <PdfPicture ctx={ctx} url={url} style={{ width: w, height: h, ...radius }} />
    );
  if (!frame || shape === 'hexagon') return <View style={style}>{picture}</View>;
  const pad = 4;
  const outer: Style =
    shape === 'circle'
      ? { borderRadius: (w + pad * 2) / 2 }
      : shape === 'arch'
        ? { borderTopLeftRadius: (w + pad * 2) / 2, borderTopRightRadius: (w + pad * 2) / 2, borderBottomLeftRadius: t.radius * 0.5 + pad, borderBottomRightRadius: t.radius * 0.5 + pad }
        : shape === 'rounded'
          ? { borderRadius: t.radius + pad }
          : {};
  return (
    <View style={{ padding: pad - 1, borderWidth: 1.2, borderColor: t.colors.accent, alignSelf: 'flex-start', ...outer, ...style }}>
      {picture}
    </View>
  );
}

export function PdfLogo({ ctx, url, size }: { ctx: PdfContext; url: string | null; size: number }) {
  const image = img(ctx, url);
  return image ? <Image src={image} style={{ width: size, height: size, objectFit: 'contain' }} /> : null;
}

/** Línea ◆ línea: separador ornamental. */
export function PdfOrnament({ ctx, width = 140, color }: { ctx: PdfContext; width?: number; color?: string }) {
  const c = color ?? ctx.t.colors.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width, alignSelf: 'center' }}>
      <View style={{ flex: 1, height: 0.6, backgroundColor: c }} />
      <Text style={{ fontSize: 7, color: c }}>◆</Text>
      <View style={{ flex: 1, height: 0.6, backgroundColor: c }} />
    </View>
  );
}
