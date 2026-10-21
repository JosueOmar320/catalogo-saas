import { NextResponse } from 'next/server';
import { listCategories, listItemsWithImages } from '@/features/catalog/queries';
import { getBusinessContext } from '@/lib/auth/session';
import { itemsToCsv } from '@/lib/catalog/csv';
import { publicStorageUrl } from '@/lib/utils/storage';

/** Descarga los productos y servicios del negocio activo en CSV (mismo formato que la importación). */
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Sitio web sin catálogo: no hay productos, pedidos ni estadísticas de catálogo que exportar.
  if (ctx.siteKind !== 'catalog') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const [categories, items] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx)]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const csv = itemsToCsv(
    items.map((i) => ({
      name: i.name,
      type: i.type,
      categoryName: i.category_id ? (categoryName.get(i.category_id) ?? null) : null,
      price: i.price === null ? null : Number(i.price),
      compareAt: i.compare_at_price === null ? null : Number(i.compare_at_price),
      priceNote: i.price_note,
      sku: i.sku,
      shortDescription: i.short_description,
      description: i.description,
      available: i.is_available,
      visible: i.is_visible,
      featured: i.is_featured,
      tags: i.tags ?? [],
      images: i.images.flatMap((image) => publicStorageUrl(image.storage_path) ?? []),
    })),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="catalogo-${ctx.business.slug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
