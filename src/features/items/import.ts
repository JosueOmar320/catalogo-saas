'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requireBusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { matchKey, MAX_IMPORT_ROWS } from '@/lib/catalog/csv';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { isWithinLimit } from '@/lib/plans/entitlements';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { slugify, withRandomSuffix } from '@/lib/utils/slug';
import { parseInput } from '@/lib/utils/validation';

/**
 * Importa productos y servicios desde las filas que ya validó la vista previa
 * (lib/catalog/csv). Aquí se vuelve a validar todo: el navegador no es de
 * confianza. Reconoce los existentes por código (o por nombre y tipo) y los
 * actualiza; los demás se crean. Las imágenes no se importan.
 */
const text = (max: number) => z.string().trim().max(max).nullable();
const price = z.number().min(0).max(99_999_999).nullable();

const rowSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['product', 'service']),
  category: text(80),
  price,
  compareAt: price,
  priceNote: text(40),
  sku: text(64),
  shortDescription: text(300),
  description: text(5000),
  available: z.boolean(),
  visible: z.boolean(),
  featured: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15),
});

const importSchema = z.object({
  rows: z.array(rowSchema).min(1).max(MAX_IMPORT_ROWS),
  createCategories: z.boolean(),
});

export type ImportItemsInput = z.input<typeof importSchema>;

const nameKey = (name: string) => name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function importItems(input: ImportItemsInput): Promise<ActionResult<{ created: number; updated: number; categories: number }>> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(importSchema, input);
  if (!parsed.success) return parsed.result;
  const { createCategories } = parsed.data;
  const t = await getT();

  // Un mismo producto repetido en el archivo: gana la última fila.
  const byKey = new Map(parsed.data.rows.map((row) => [matchKey(row), row]));
  const rows = [...byKey.values()];

  const [existing, categories] = await Promise.all([
    fetchAllRows((from, to) =>
      ctx.supabase.from('catalog_items').select('id, name, sku, type, slug, position').eq('catalog_id', ctx.catalog.id).is('deleted_at', null).order('id').range(from, to),
    ),
    ctx.supabase.from('categories').select('id, name, position').eq('catalog_id', ctx.catalog.id).is('deleted_at', null),
  ]);
  if (categories.error) return fail(dbErrorMessage(categories.error));
  const existingByKey = new Map(existing.map((item) => [matchKey(item), item]));

  const toCreate = rows.filter((row) => !existingByKey.has(matchKey(row)));
  const maxItems = ctx.entitlements.limits.max_items;
  if (maxItems !== null && !isWithinLimit(maxItems, existing.length + toCreate.length - 1)) {
    return fail(t('Tu plan permite hasta {max} ítems: tienes {current} y el archivo agrega {count}.', { max: maxItems, current: existing.length, count: toCreate.length }));
  }

  // Categorías por nombre (sin distinguir mayúsculas ni acentos); las que faltan se crean si se pidió.
  const categoryId = new Map(categories.data.map((c) => [nameKey(c.name), c.id]));
  const missing = [...new Map(rows.filter((r) => r.category && !categoryId.has(nameKey(r.category))).map((r) => [nameKey(r.category!), r.category!])).values()];
  let createdCategories = 0;
  if (createCategories && missing.length) {
    const start = Math.max(-1, ...categories.data.map((c) => c.position)) + 1;
    const { data, error } = await ctx.supabase
      .from('categories')
      .insert(missing.map((name, index) => ({ business_id: ctx.business.id, catalog_id: ctx.catalog.id, name, position: start + index })))
      .select('id, name');
    if (error) return fail(dbErrorMessage(error));
    for (const c of data) categoryId.set(nameKey(c.name), c.id);
    createdCategories = data.length;
  }

  const values = (row: z.output<typeof rowSchema>) => ({
    name: row.name,
    type: row.type,
    category_id: row.category ? (categoryId.get(nameKey(row.category)) ?? null) : null,
    price: row.price,
    compare_at_price: row.compareAt !== null && row.price !== null && row.compareAt > row.price ? row.compareAt : null,
    price_note: row.priceNote,
    sku: row.sku,
    short_description: row.shortDescription,
    description: row.description,
    is_available: row.available,
    is_visible: row.visible,
    is_featured: row.featured,
    tags: row.tags,
  });

  // Actualizaciones, de 20 en 20.
  const toUpdate = rows.filter((row) => existingByKey.has(matchKey(row)));
  for (let i = 0; i < toUpdate.length; i += 20) {
    const results = await Promise.all(
      toUpdate.slice(i, i + 20).map((row) => ctx.supabase.from('catalog_items').update(values(row)).eq('id', existingByKey.get(matchKey(row))!.id).eq('catalog_id', ctx.catalog.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(dbErrorMessage(failed.error));
  }

  // Nuevos: al final del orden actual, con URL única.
  const { currency } = parseCatalogSettings(ctx.catalog.settings);
  const usedSlugs = new Set(existing.map((item) => item.slug));
  let position = Math.max(-1, ...existing.map((item) => item.position)) + 1;
  const inserts = toCreate.map((row) => {
    let slug = slugify(row.name, 60) || 'item';
    while (usedSlugs.has(slug)) slug = withRandomSuffix(slugify(row.name, 60) || 'item');
    usedSlugs.add(slug);
    return { ...values(row), slug, position: position++, currency, business_id: ctx.business.id, catalog_id: ctx.catalog.id };
  });
  for (let i = 0; i < inserts.length; i += 100) {
    const { error } = await ctx.supabase.from('catalog_items').insert(inserts.slice(i, i + 100));
    if (error) return fail(error.message.includes('plan_limit_reached') ? msg('Se alcanzó el límite de tu plan durante la importación.') : dbErrorMessage(error));
  }

  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(
    { created: inserts.length, updated: toUpdate.length, categories: createdCategories },
    t('Importación lista: {created} nuevos y {updated} actualizados.', { created: inserts.length, updated: toUpdate.length }),
  );
}
