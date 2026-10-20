import 'server-only';
import { ImageResponse } from 'next/og';
import { prefetchImages } from '@/features/pdf/images';
import { ogFonts } from './fonts';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { readableOn } from '@/lib/share/kit';
import { siteTranslator } from '@/site-renderer/site-i18n';

/**
 * Imágenes para compartir (Open Graph, 1200 × 630): lo que se ve al pegar el
 * enlace en WhatsApp, Facebook o X. La del producto lleva foto, nombre, precio
 * y negocio; la del catálogo, nombre, slogan y fotos de los destacados. Sólo
 * flexbox (Satori). Las fotos se descargan como en el PDF (seguro, con caché).
 */
export const OG_SIZE = { width: 1200, height: 630 };

const dataUri = (image: { data: Buffer; format: 'jpg' | 'png' } | undefined) => (image ? `data:image/${image.format === 'jpg' ? 'jpeg' : 'png'};base64,${image.data.toString('base64')}` : null);
const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const cache = { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } };

export async function itemCard(site: SiteViewModel, item: CatalogItemView): Promise<ImageResponse> {
  const t = siteTranslator(site.settings.language);
  const { colors } = site.theme;
  const photoUrl = item.images[0]?.url ?? null;
  const [images, fonts] = await Promise.all([prefetchImages([photoUrl]), ogFonts(site.theme.typography.headingFont, site.theme.typography.bodyFont)]);
  const family = familyOf(fonts);
  const photo = photoUrl ? dataUri(images.get(photoUrl)) : null;
  const price = item.priceLabel ? `${item.priceNote === 'desde' ? `${t('desde')} ` : ''}${item.priceLabel}` : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: colors.background, color: colors.text, fontFamily: family.body }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- Satori dibuja <img>, no next/image.
          <img src={photo} alt="" width={630} height={630} style={{ width: 630, height: 630, objectFit: 'cover' }} />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 56px' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: colors.accent, letterSpacing: 1 }}>{site.business.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: photo ? 60 : 76, fontWeight: 700, color: colors.heading, lineHeight: 1.1, fontFamily: family.heading }}>{item.name}</div>
            {item.shortDescription && (
              <div style={{ display: 'flex', fontSize: 28, color: colors.mutedText, marginTop: 18, lineHeight: 1.35, maxHeight: 76, overflow: 'hidden' }}>{item.shortDescription}</div>
            )}
            {price && <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: colors.price, marginTop: 28 }}>{price}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18 }}>
            {site.settings.order.enabled && item.type === 'product' && item.isAvailable && (
              <div style={{ display: 'flex', padding: '14px 26px', borderRadius: 999, background: colors.button, color: colors.buttonText, fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap' }}>{t('Pide por WhatsApp')}</div>
            )}
            <div style={{ display: 'flex', fontSize: 22, color: colors.mutedText }}>{host(site.url)}</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, ...cache, fonts },
  );
}

export async function catalogCard(site: SiteViewModel): Promise<ImageResponse> {
  const t = siteTranslator(site.settings.language);
  const { colors } = site.theme;
  const ink = readableOn(colors.accent);
  const featured = [...site.items.filter((i) => i.isFeatured), ...site.items.filter((i) => !i.isFeatured)].filter((i) => i.images[0]).slice(0, 3);
  const urls = featured.map((i) => i.images[0].thumbUrl);
  const [images, fonts] = await Promise.all([prefetchImages([site.business.logoUrl, ...urls]), ogFonts(site.theme.typography.headingFont, site.theme.typography.bodyFont)]);
  const family = familyOf(fonts);
  const logo = site.business.logoUrl ? dataUri(images.get(site.business.logoUrl)) : null;
  const photos = urls.map((url) => dataUri(images.get(url))).filter((uri): uri is string => Boolean(uri));
  const products = site.items.filter((i) => i.type === 'product').length;
  const services = site.items.length - products;
  const summary = [
    products ? (products === 1 ? t('1 producto') : t('{count} productos', { count: products })) : null,
    services ? (services === 1 ? t('1 servicio') : t('{count} servicios', { count: services })) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: colors.accent, color: ink, fontFamily: family.body }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px' }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- Satori dibuja <img>, no next/image.
            <img src={logo} alt="" width={110} height={110} style={{ width: 110, height: 110, borderRadius: 24, objectFit: 'cover', marginBottom: 32, background: '#ffffff' }} />
          )}
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1.05, fontFamily: family.heading }}>{site.business.name}</div>
          {site.business.slogan && <div style={{ display: 'flex', fontSize: 32, marginTop: 20, opacity: 0.9, lineHeight: 1.3 }}>{site.business.slogan}</div>}
          {summary && <div style={{ display: 'flex', fontSize: 26, marginTop: 36, opacity: 0.85 }}>{summary}</div>}
        </div>
        {photos.length > 0 && (
          <div style={{ width: 440, display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 24px 24px 0' }}>
            {photos.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- Satori dibuja <img>, no next/image.
              <img key={index} src={src} alt="" width={416} height={Math.floor((582 - (photos.length - 1) * 12) / photos.length)} style={{ width: 416, height: Math.floor((582 - (photos.length - 1) * 12) / photos.length), objectFit: 'cover', borderRadius: 20 }} />
            ))}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, ...cache, fonts },
  );
}

/** Familias a usar: las del sitio si se pudieron bajar; si no, la fuente por defecto. */
function familyOf(fonts: { name: string }[]) {
  const has = (name: string) => fonts.some((font) => font.name === name);
  return { heading: has('heading') ? 'heading' : undefined, body: has('body') ? 'body' : undefined };
}
