import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { backgroundSchema, INHERIT_BACKGROUND } from '@/lib/design/background';
import { buildSampleSite } from '@/lib/site/sample-site';
import { EMPTY_FILTERS, filterItems, groupByCategory, type CatalogFilters } from '@/site-renderer/filter';

/**
 * Las optimizaciones de rendimiento NO deben cambiar resultados: se comparan
 * contra la implementación anterior (copiada aquí tal cual).
 */
const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const attrStrings = (value: unknown): string[] => (value === undefined ? [] : typeof value === 'boolean' ? [value ? 'Sí' : 'No'] : Array.isArray(value) ? value : [String(value)]);
function oldSearch(items: CatalogItemView[], query: string) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (terms.length === 0) return true;
    const attrText = Object.values(item.attributes).flatMap(attrStrings);
    const optionText = [...(item.variants?.options ?? []).flatMap((o) => [o.name, o.sku]), ...(item.extras?.options ?? []).map((o) => o.name)];
    const haystack = normalize([item.name, item.shortDescription, item.sku, ...item.tags, ...attrText, ...optionText].filter(Boolean).join(' '));
    return terms.every((t) => haystack.includes(t));
  });
}
function oldGroup(items: CatalogItemView[], categories: { id: string; name: string; description: string | null }[]) {
  const byCategory = new Map<string, CatalogItemView[]>();
  const uncategorized: CatalogItemView[] = [];
  for (const item of items) {
    if (item.categoryId) byCategory.set(item.categoryId, [...(byCategory.get(item.categoryId) ?? []), item]);
    else uncategorized.push(item);
  }
  const groups: { id: string; title: string | null; description: string | null; items: CatalogItemView[] }[] = categories.filter((c) => byCategory.has(c.id)).map((c) => ({ id: c.id, title: c.name, description: c.description, items: byCategory.get(c.id)! }));
  if (uncategorized.length) groups.push({ id: 'uncategorized', title: groups.length > 0 ? 'Otros' : null, description: null, items: uncategorized });
  return groups;
}

const site = buildSampleSite();
const items: CatalogItemView[] = Array.from({ length: 600 }, (_, i) => {
  const b = site.items[i % site.items.length];
  return { ...b, id: `i${i}`, name: `${b.name} ${i % 7 === 0 ? 'Edición Ñandú' : ''}`, categoryId: i % 9 === 0 ? null : site.categories[i % site.categories.length].id };
});

describe('Optimizaciones del catálogo: mismo resultado que antes', () => {
  it('búsqueda (con acentos, varias palabras, códigos, atributos)', () => {
    for (const q of ['', 'cafe', 'CAFÉ', 'nandu', 'espresso doble', 'caf-00', 'chiapas', '16 oz', 'zzz', '  latte   avena ']) {
      const filters: CatalogFilters = { ...EMPTY_FILTERS, query: q };
      // Dos veces: la segunda usa el texto ya calculado (caché).
      for (let round = 0; round < 2; round++) assert.deepEqual(filterItems(items, filters).map((i) => i.id), oldSearch(items, q).map((i) => i.id), q);
    }
  });

  it('agrupar por categoría conserva grupos y orden', () => {
    assert.deepEqual(JSON.stringify(groupByCategory(items, site.categories)), JSON.stringify(oldGroup(items, site.categories)));
  });
});

describe('Módulos sin zod para el navegador', () => {
  it('el fondo por defecto escrito a mano es igual al del esquema', () => {
    assert.deepEqual(INHERIT_BACKGROUND, backgroundSchema.parse({}));
  });
});
