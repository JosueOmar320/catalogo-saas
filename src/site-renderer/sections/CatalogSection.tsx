'use client';

import { PackageSearch, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { EMPTY_FILTERS, filterItems, groupByCategory, type CatalogFilters } from '../filter';
import { ItemCard, ItemRow } from '../ItemCard';
import { gridVars, SectionFrame, SectionHead } from '../SectionFrame';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/** Catálogo completo con buscador, categorías y filtros (la experiencia de la v1). */
export function CatalogSection({ section, site, env }: SectionProps<'catalog'>) {
  const { content } = section;
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const query = useDeferredValue(filters.query);
  const items = useMemo(() => (content.itemType === 'any' ? site.items : site.items.filter((i) => i.type === content.itemType)), [site.items, content.itemType]);

  // Enlaces desde la sección "Categorías": ?categoria=<id>
  useEffect(() => {
    if (env.mode !== 'public') return;
    const id = new URLSearchParams(window.location.search).get('categoria');
    if (!id || !site.categories.some((c) => c.id === id)) return;
    // Después de hidratar (el HTML del servidor no conoce la URL del cliente).
    const timer = setTimeout(() => setFilters((f) => ({ ...f, categoryId: id })));
    return () => clearTimeout(timer);
  }, [env.mode, site.categories]);

  const categoryNames = useMemo(() => new Map(site.categories.map((c) => [c.id, c.name])), [site.categories]);
  const usedCategories = useMemo(() => {
    const used = new Set(items.map((i) => i.categoryId));
    return site.categories.filter((c) => used.has(c.id));
  }, [site.categories, items]);
  const hasBothTypes = items.some((i) => i.type === 'product') && items.some((i) => i.type === 'service');
  const filtered = useMemo(() => filterItems(items, { ...filters, query }), [items, filters, query]);
  const isSearching = query.trim() !== '' || filters.type !== 'all' || filters.onlyAvailable;
  const featured = content.showFeatured && !isSearching && filters.categoryId === 'all' ? items.filter((i) => i.isFeatured).slice(0, 6) : [];
  const groups = content.groupByCategory && !query.trim() ? groupByCategory(filtered, site.categories) : [{ id: 'all', title: null, description: null, items: filtered }];
  const update = (patch: Partial<CatalogFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const showCategoryChips = content.showCategoryNav && usedCategories.length > 1;
  const showToolbar = items.length > 0 && (content.showSearch || showCategoryChips || (content.showFilters && hasBothTypes));
  const cardStyle = content.cardStyle === 'inherit' ? undefined : content.cardStyle;
  const showcase = content.layout === 'showcase';
  const columns = showcase ? { desktop: Math.min(content.columns.desktop, 3), tablet: 2, mobile: 1 } : content.columns;

  const renderItems = (list: typeof filtered) =>
    content.layout === 'list' ? (
      <div className={styles.list}>
        {list.map((item) => (
          <ItemRow key={item.id} item={item} site={site} env={env} categoryName={item.categoryId ? categoryNames.get(item.categoryId) : undefined} />
        ))}
      </div>
    ) : (
      <div className={styles.grid} style={gridVars(columns)}>
        {list.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            site={site}
            env={env}
            options={{ style: showcase ? (cardStyle ?? 'borderless') : cardStyle, categoryName: item.categoryId ? categoryNames.get(item.categoryId) : undefined }}
          />
        ))}
      </div>
    );

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

      {showToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            {content.showSearch && (
              <label className={styles.search}>
                <span className={styles.visuallyHidden}>Buscar</span>
                <Search size={16} className={styles.searchIcon} aria-hidden />
                <input type="search" className={styles.searchInput} placeholder="Buscar en el catálogo" value={filters.query} onChange={(e) => update({ query: e.target.value })} />
              </label>
            )}
            <nav className={styles.chips} aria-label="Categorías">
              {showCategoryChips && (
                <>
                  <Chip active={filters.categoryId === 'all'} onClick={() => update({ categoryId: 'all' })}>Todo</Chip>
                  {usedCategories.map((c) => (
                    <Chip key={c.id} active={filters.categoryId === c.id} onClick={() => update({ categoryId: c.id })}>{c.name}</Chip>
                  ))}
                </>
              )}
              {content.showFilters && hasBothTypes && (
                <>
                  {showCategoryChips && <span className={styles.chipDivider} aria-hidden />}
                  <Chip active={filters.type === 'product'} onClick={() => update({ type: filters.type === 'product' ? 'all' : 'product' })}>Productos</Chip>
                  <Chip active={filters.type === 'service'} onClick={() => update({ type: filters.type === 'service' ? 'all' : 'service' })}>Servicios</Chip>
                </>
              )}
            </nav>
            {content.showFilters && items.some((i) => !i.isAvailable) && (
              <label className={styles.filterToggle}>
                <input type="checkbox" checked={filters.onlyAvailable} onChange={(e) => update({ onlyAvailable: e.target.checked })} />
                Sólo disponibles
              </label>
            )}
          </div>
        </div>
      )}

      {featured.length > 0 && (
        <div className={styles.catalogGroup}>
          <div className={styles.catalogGroupHead}>
            <h3 className={styles.h3}>Destacados</h3>
          </div>
          <div className={styles.carousel} style={gridVars({ desktop: 3, tablet: 2, mobile: 1 })}>
            {featured.map((item, i) => (
              <ItemCard key={item.id} item={item} site={site} env={env} options={{ style: cardStyle, priority: i < 3 }} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <PackageSearch size={36} strokeWidth={1.5} aria-hidden />
          <p className={styles.emptyTitle}>{items.length === 0 ? 'Muy pronto' : 'Sin resultados'}</p>
          <p>{items.length === 0 ? 'Estamos preparando nuestro catálogo.' : 'Prueba con otra búsqueda o categoría.'}</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.id} className={styles.catalogGroup} id={group.id !== 'all' ? `categoria-${group.id}` : undefined}>
            {group.title && (
              <div className={styles.catalogGroupHead}>
                <h3 className={styles.h3}>{group.title}</h3>
                {group.description && <p className={`${styles.muted} ${styles.tightText}`}>{group.description}</p>}
              </div>
            )}
            {renderItems(group.items)}
          </div>
        ))
      )}
    </SectionFrame>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`${styles.chip} ${active ? styles.chipActive : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}
