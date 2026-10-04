import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { AttributesManager } from '@/features/attributes/components/AttributesManager';
import { listItemsWithImages } from '@/features/catalog/queries';
import { requireBusinessContext } from '@/lib/auth/session';
import { parseAttributeDefs } from '@/lib/catalog/attributes';

export const metadata: Metadata = { title: 'Atributos' };

export default async function AttributesPage() {
  const ctx = await requireBusinessContext();
  const items = await listItemsWithImages(ctx);
  // Cuántos ítems tienen un valor para cada atributo.
  const usage: Record<string, number> = {};
  for (const item of items) {
    const values = (item.attributes as { values?: Record<string, unknown> } | null)?.values ?? {};
    for (const id of Object.keys(values)) usage[id] = (usage[id] ?? 0) + 1;
  }
  return (
    <>
      <PageHeader title="Atributos" description="Define los datos que describen tus productos y servicios: marca, material, tamaño, duración, lo que incluye… Tú decides cuáles." />
      <AttributesManager initial={parseAttributeDefs(ctx.catalog.attribute_defs)} usage={usage} />
    </>
  );
}
