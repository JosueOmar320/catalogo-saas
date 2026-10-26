import 'server-only';
import { randomBytes } from 'node:crypto';
import { processImage } from '@/features/media/process';
import { internalAuthEmail } from '@/lib/auth/username';
import { buildDemoSeed, demoCatalogBase, demoPhotoIds, type DemoImage } from '@/lib/demo/seed';
import { env } from '@/lib/env';
import { safeDownload } from '@/lib/net/safe-fetch';
import { SAMPLE_ATTRIBUTE_DEFS, SAMPLE_BUSINESS, samplePhotoUrl } from '@/lib/site/sample-site';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { DEMO_HOURS, MAX_ACTIVE_DEMOS } from './config';
import type { Json } from '@/types/database';

/**
 * Cuenta demo («Probar el panel»): un negocio de prueba por visitante, con el
 * café de ejemplo, que se borra solo. Todo con la service role (el visitante
 * todavía no tiene sesión); la base sólo deja crear y borrar negocios de
 * prueba a esa llave (create_demo_business / purge_demo_business).
 */


/** Fotos del café de ejemplo, procesadas una vez y copiadas a cada negocio de prueba. */
const TEMPLATE = 'demo-template';
/** Código de error de PostgREST/Postgres cuando la función todavía no existe (migración sin aplicar). */
const MISSING_FUNCTION = new Set(['PGRST202', '42883']);

export class DemoError extends Error {
  constructor(readonly code: 'unavailable' | 'full' | 'failed') {
    super(code);
  }
}

type Admin = ReturnType<typeof createAdminClient>;
type TemplateImage = { main: string; thumb: string | null; width: number | null; height: number | null; size: number | null; mime: DemoImage['mime'] };

const bucket = (admin: Admin) => admin.storage.from(env.storageBucket);
const MIME: Record<string, DemoImage['mime']> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * La plantilla de fotos (demo-template/<foto>-<ancho>x<alto>.<ext> y su
 * miniatura). Si falta alguna, se descarga una vez de Unsplash y se procesa
 * como cualquier imagen importada.
 */
async function ensureTemplate(admin: Admin): Promise<Record<string, TemplateImage>> {
  const { data: files } = await bucket(admin).list(TEMPLATE, { limit: 200 });
  const byPhoto: Record<string, TemplateImage> = {};
  for (const file of files ?? []) {
    const main = /^(.+)-(\d+)x(\d+)\.(jpg|png|webp)$/.exec(file.name);
    if (!main) continue;
    const [, photo, width, height, ext] = main;
    const thumb = (files ?? []).find((f) => f.name === `${photo}-thumb.${ext}`);
    byPhoto[photo] = { main: `${TEMPLATE}/${file.name}`, thumb: thumb ? `${TEMPLATE}/${thumb.name}` : null, width: Number(width), height: Number(height), size: Number(file.metadata?.size) || null, mime: MIME[ext] };
  }
  const missing = demoPhotoIds().filter((photo) => !byPhoto[photo]);
  await Promise.all(
    missing.map(async (photo) => {
      try {
        const download = await safeDownload(samplePhotoUrl(photo, 1200));
        const processed = await processImage(download.data);
        const { main, thumb } = processed;
        const mainPath = `${TEMPLATE}/${photo}-${main.width}x${main.height}.${main.extension}`;
        const thumbPath = thumb ? `${TEMPLATE}/${photo}-thumb.${thumb.extension}` : null;
        // upsert: dos primeras demos a la vez pueden armar la plantilla al mismo tiempo.
        await bucket(admin).upload(mainPath, main.data, { contentType: main.mime, cacheControl: '31536000', upsert: true });
        if (thumb && thumbPath) await bucket(admin).upload(thumbPath, thumb.data, { contentType: thumb.mime, cacheControl: '31536000', upsert: true });
        byPhoto[photo] = { main: mainPath, thumb: thumbPath, width: main.width, height: main.height, size: main.data.byteLength, mime: main.mime };
      } catch (error) {
        // Sin esa foto el producto queda sin imagen; la demo sigue.
        console.error('[demo] no se pudo preparar una foto de ejemplo', { photo, error: error instanceof Error ? error.message : 'error' });
      }
    }),
  );
  return byPhoto;
}

/** Copia las fotos de la plantilla a la carpeta del negocio de prueba. */
async function copyTemplate(admin: Admin, businessId: string, template: Record<string, TemplateImage>): Promise<Record<string, DemoImage>> {
  const images: Record<string, DemoImage> = {};
  await Promise.all(
    Object.entries(template).map(async ([photo, file]) => {
      const id = crypto.randomUUID();
      const ext = file.main.split('.').pop();
      const path = `${businessId}/media/${id}.${ext}`;
      const thumbPath = file.thumb ? `${businessId}/media/${id}-thumb.${file.thumb.split('.').pop()}` : null;
      const copied = await bucket(admin).copy(file.main, path);
      if (copied.error) return;
      if (file.thumb && thumbPath && (await bucket(admin).copy(file.thumb, thumbPath)).error) return;
      images[photo] = { path, thumbPath, width: file.width, height: file.height, size: file.size, mime: file.mime };
    }),
  );
  return images;
}

/** Todos los archivos bajo una carpeta (la API de Storage lista un nivel a la vez). */
async function listAll(admin: Admin, prefix: string): Promise<string[]> {
  const { data } = await bucket(admin).list(prefix, { limit: 1000 });
  const nested = await Promise.all((data ?? []).map((entry) => (entry.id ? Promise.resolve([`${prefix}/${entry.name}`]) : listAll(admin, `${prefix}/${entry.name}`))));
  return nested.flat();
}

/** Borra un negocio de prueba: archivos, filas (en cascada) y cuentas de Auth. */
export async function purgeDemo(admin: Admin, businessId: string): Promise<void> {
  const files = await listAll(admin, businessId);
  for (let i = 0; i < files.length; i += 100) await bucket(admin).remove(files.slice(i, i + 100));
  const { data: users, error } = await admin.rpc('purge_demo_business', { p_business: businessId });
  if (error) throw error;
  for (const id of users ?? []) {
    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) console.error('[demo] no se pudo borrar la cuenta de prueba', { code: authError.code });
  }
}

/** Borra hasta `limit` negocios de prueba vencidos. Devuelve cuántos. */
export async function purgeExpiredDemos(limit = 20): Promise<number> {
  if (!isServiceRoleConfigured()) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin.from('businesses').select('id').not('demo_expires_at', 'is', null).lt('demo_expires_at', new Date().toISOString()).order('demo_expires_at').limit(limit);
  if (error) {
    // Sin la migración no hay columna: nada que limpiar.
    if (error.code !== '42703') console.error('[demo] no se pudieron leer las demos vencidas', { code: error.code });
    return 0;
  }
  let purged = 0;
  for (const { id } of data ?? []) {
    try {
      await purgeDemo(admin, id);
      purged++;
    } catch (purgeError) {
      console.error('[demo] no se pudo borrar una demo vencida', { code: (purgeError as { code?: string }).code });
    }
  }
  return purged;
}

/** Negocios de prueba vivos. */
export async function countActiveDemos(admin: Admin = createAdminClient()): Promise<number> {
  const { count } = await admin.from('businesses').select('id', { count: 'exact', head: true }).gt('demo_expires_at', new Date().toISOString());
  return count ?? 0;
}

/**
 * Crea la cuenta y el negocio de prueba con todo su contenido. Devuelve el
 * correo interno y la contraseña de un solo uso para iniciar la sesión.
 */
export async function createDemoAccount(): Promise<{ email: string; password: string; businessId: string }> {
  const admin = createAdminClient();
  if ((await countActiveDemos(admin)) >= MAX_ACTIVE_DEMOS) throw new DemoError('full');

  const tag = randomBytes(4).toString('hex');
  const username = `demo-${tag}`;
  const email = internalAuthEmail(username);
  // Nadie la conoce ni la necesita: la sesión se abre ahora y la cuenta se borra con el negocio.
  const password = randomBytes(24).toString('base64url');
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Visitante demo' },
    app_metadata: { provisioned: true, username, demo: true },
  });
  if (userError || !created.user) throw new DemoError('failed');
  const userId = created.user.id;

  let businessId: string | null = null;
  try {
    const base = demoCatalogBase();
    const { data, error } = await admin.rpc('create_demo_business', {
      p_owner: userId,
      p_name: SAMPLE_BUSINESS.name,
      p_slug: `prueba-${tag}`,
      p_hours: DEMO_HOURS,
      p_slogan: SAMPLE_BUSINESS.slogan,
      p_description: SAMPLE_BUSINESS.description,
      p_contact: SAMPLE_BUSINESS.contact as unknown as Json,
      p_social_links: SAMPLE_BUSINESS.socialLinks as unknown as Json,
      p_theme: base.theme as unknown as Json,
      p_settings: base.settings as unknown as Json,
      p_attribute_defs: SAMPLE_ATTRIBUTE_DEFS as unknown as Json,
    });
    if (error) throw new DemoError(MISSING_FUNCTION.has(error.code ?? '') ? 'unavailable' : 'failed');
    const ids = data as { business_id: string; catalog_id: string };
    businessId = ids.business_id;

    const images = await copyTemplate(admin, businessId, await ensureTemplate(admin));
    const seed = buildDemoSeed({ businessId, catalogId: ids.catalog_id, ownerId: userId, now: new Date(), images });
    // En orden: lo que otras filas referencian va primero.
    const steps: [string, () => PromiseLike<{ error: { code?: string; message?: string } | null }>][] = [
      ['media', () => admin.from('media_assets').insert(seed.media)],
      ['categories', () => admin.from('categories').insert(seed.categories)],
      ['items', () => admin.from('catalog_items').insert(seed.items)],
      ['images', () => admin.from('catalog_item_images').insert(seed.itemImages)],
      ['costs', () => admin.from('item_costs').insert(seed.itemCosts)],
      ['pages', () => admin.from('catalog_pages').insert(seed.pages)],
      ['navigation', () => admin.from('catalogs').update({ navigation: seed.navigation }).eq('id', ids.catalog_id)],
      ['reviews', () => admin.from('reviews').insert(seed.reviews)],
      ['orders', () => admin.from('orders').insert(seed.orders)],
      ['views', () => admin.from('site_view_stats_daily').insert(seed.siteViews)],
      ['item views', () => admin.from('item_view_stats_daily').insert(seed.itemViews)],
      ['funnel', () => admin.from('funnel_stats_daily').insert(seed.funnel)],
      ['cart', () => admin.from('item_cart_stats_daily').insert(seed.itemCart)],
      ['order stats', () => admin.from('order_stats_daily').insert(seed.orderStats)],
      ['searches', () => admin.from('search_miss_stats_daily').insert(seed.searchMisses)],
    ];
    for (const [step, run] of steps) {
      const { error: stepError } = await run();
      if (stepError) {
        console.error('[demo] no se pudo sembrar el negocio de prueba', { step, code: stepError.code, message: stepError.message?.slice(0, 200) });
        throw new DemoError('failed');
      }
    }
    return { email, password, businessId };
  } catch (error) {
    // Nada a medias: se borra lo creado (negocio y archivos, o sólo la cuenta).
    if (businessId) await purgeDemo(admin, businessId).catch(() => undefined);
    else await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw error instanceof DemoError ? error : new DemoError('failed');
  }
}
