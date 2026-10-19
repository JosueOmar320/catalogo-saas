'use client';

import { ChevronLeft, ChevronRight, PackageSearch, Search, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Translator } from '@/i18n/translate';
import { SORT_OPTIONS, sortItems, type SortOption } from '@/lib/catalog/collections-core';
import { attributeFilterOptions, EMPTY_FILTERS, filterItems, groupByCategory, type BadgeFilter, type CatalogFilters } from '../filter';
import { ItemCard } from '../ItemCard';
import { ProductCollection } from '../ProductCollection';
import { gridVars, SectionFrame, SectionHead } from '../SectionFrame';
import { useSiteT } from '../SiteI18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/** Orden que elige el visitante, en el idioma del sitio ("custom" es el orden del negocio). */
function sortLabel(option: SortOption, t: Translator): string {
  switch (option) {
    case 'custom':
      return t('Recomendados');
    case 'name':
      return t('Nombre (A–Z)');
    case 'priceAsc':
      return t('Precio: menor a mayor');
    case 'priceDesc':
      return t('Precio: mayor a menor');
    case 'newest':
      return t('Más recientes');
    case 'featured':
      return t('Destacados primero');
  }
}

const badgeFilters = (t: Translator): { value: BadgeFilter; label: string }[] => [
  { value: 'all', label: t('Todos') },
  { value: 'featured', label: t('Destacados') },
  { value: 'new', label: t('Nuevos') },
  { value: 'sale', label: t('En oferta') },
  { value: 'popular', label: t('Populares') },
];

/**
 * Catálogo completo: búsqueda (nombre, código, etiquetas y atributos),
 * categorías, filtros (tipo, precio, estado, atributos), orden y paginación.
 */
export function CatalogSection({ section, site, env }: SectionProps<'catalog'>) {
  const { content } = section;
  const { filters: cfg, pagination } = content;
  const t = useSiteT();
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  // null = orden por defecto de la sección (así la preview refleja cambios del editor).
  const [userSort, setUserSort] = useState<SortOption | null>(null);
  const sort = userSort ?? content.sort.default;
  // Páginas (modo "pages") o bloques cargados (modos "loadMore" / "infinite").
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
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
  const attributeFilters = useMemo(() => {
    if (!cfg.byAttributes) return [];
    const defs = cfg.attributes.length > 0 ? cfg.attributes.flatMap((id) => site.attributeDefs.filter((d) => d.id === id)) : site.attributeDefs.filter((d) => d.filterable);
    return defs.map((def) => ({ def, options: attributeFilterOptions(def, items) })).filter((a) => a.options.length > 1);
  }, [cfg.byAttributes, cfg.attributes, site.attributeDefs, items]);

  const hasBothTypes = items.some((i) => i.type === 'product') && items.some((i) => i.type === 'service');
  const hasPrices = items.some((i) => i.price !== null);
  const showTypes = cfg.types && hasBothTypes;
  const showAvailability = cfg.availability && items.some((i) => !i.isAvailable);
  const showPrice = cfg.price && hasPrices;
  const showCategoryChips = cfg.categories && usedCategories.length > 1;
  const panelFilters = showPrice || cfg.badges || attributeFilters.length > 0 || showAvailability;
  const showSort = content.sort.allowUserSort;
  const showToolbar = items.length > 0 && (cfg.search || showCategoryChips || showTypes || panelFilters || showSort);

  // Dependencias campo por campo SIN el texto escrito: la búsqueda usa el valor diferido (`query`),
  // así cada tecla filtra una sola vez (antes: una con el texto viejo y otra con el nuevo).
  const { categoryId, type, onlyAvailable, priceMin, priceMax, badge, attrs } = filters;
  const filtered = useMemo(
    () => sortItems(filterItems(items, { query, categoryId, type, onlyAvailable, priceMin, priceMax, badge, attrs }), sort),
    [items, query, categoryId, type, onlyAvailable, priceMin, priceMax, badge, attrs, sort],
  );
  const isSearching = filtered.length !== items.length || query.trim() !== '';
  const featured = content.showFeatured && !isSearching ? items.filter((i) => i.isFeatured).slice(0, 6) : [];

  const perPage = pagination.perPage;
  const paged = pagination.mode !== 'all';
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pageCount);
  const visible = !paged ? filtered : pagination.mode === 'pages' ? filtered.slice((current - 1) * perPage, current * perPage) : filtered.slice(0, current * perPage);
  const remaining = filtered.length - visible.length;
  const groups = content.groupByCategory && !query.trim() && sort === 'custom' ? groupByCategory(visible, site.categories, t('Otros')) : [{ id: 'all', title: null, description: null, items: visible }];
  const activeCount = [filters.priceMin !== null || filters.priceMax !== null, filters.badge !== 'all', filters.onlyAvailable, ...Object.values(filters.attrs).map(Boolean)].filter(Boolean).length;

  const update = (patch: Partial<CatalogFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  // Scroll infinito: carga el siguiente bloque al acercarse al final.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (pagination.mode !== 'infinite' || !el || remaining <= 0) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setPage((p) => p + 1), { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pagination.mode, remaining]);

  const top = useRef<HTMLDivElement>(null);
  const goTo = (n: number) => {
    setPage(n);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={content.presentation.align === 'center'} />

      {showToolbar && (
        <div className={styles.toolbar} ref={top}>
          <div className={styles.toolbarRow}>
            {cfg.search && (
              <label className={styles.search}>
                <span className={styles.visuallyHidden}>{t('Buscar')}</span>
                <Search size={16} className={styles.searchIcon} aria-hidden />
                <input type="search" className={styles.searchInput} placeholder={t('Buscar por nombre o código')} value={filters.query} onChange={(e) => update({ query: e.target.value })} />
              </label>
            )}
            <nav className={styles.chips} aria-label={t('Categorías')}>
              {showCategoryChips && (
                <>
                  <Chip active={filters.categoryId === 'all'} onClick={() => update({ categoryId: 'all' })}>{t('Todo')}</Chip>
                  {usedCategories.map((c) => (
                    <Chip key={c.id} active={filters.categoryId === c.id} onClick={() => update({ categoryId: c.id })}>{c.name}</Chip>
                  ))}
                </>
              )}
              {showTypes && (
                <>
                  {showCategoryChips && <span className={styles.chipDivider} aria-hidden />}
                  <Chip active={filters.type === 'product'} onClick={() => update({ type: filters.type === 'product' ? 'all' : 'product' })}>{t('Productos')}</Chip>
                  <Chip active={filters.type === 'service'} onClick={() => update({ type: filters.type === 'service' ? 'all' : 'service' })}>{t('Servicios')}</Chip>
                </>
              )}
            </nav>
            <div className={styles.toolbarEnd}>
              {panelFilters && (
                <button type="button" className={`${styles.chip} ${activeCount > 0 ? styles.chipActive : ''}`} aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
                  <SlidersHorizontal size={14} aria-hidden /> {activeCount > 0 ? t('Filtros ({count})', { count: activeCount }) : t('Filtros')}
                </button>
              )}
              {showSort && (
                <label className={styles.selectWrap}>
                  <span className={styles.visuallyHidden}>{t('Ordenar')}</span>
                  <select
                    className={styles.select}
                    value={sort}
                    onChange={(e) => {
                      setUserSort(e.target.value as SortOption);
                      setPage(1);
                    }}
                  >
                    {SORT_OPTIONS.filter((o) => hasPrices || (o !== 'priceAsc' && o !== 'priceDesc')).map((o) => (
                      <option key={o} value={o}>{sortLabel(o, t)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {panelFilters && panelOpen && (
            <div className={styles.filterPanel}>
              {showPrice && (
                <fieldset className={styles.filterField}>
                  <legend>{t('Precio')}</legend>
                  <div className={styles.priceRange}>
                    <input type="number" inputMode="decimal" min={0} placeholder={t('Mín.')} className={styles.select} value={filters.priceMin ?? ''} onChange={(e) => update({ priceMin: e.target.value === '' ? null : Number(e.target.value) })} />
                    <span aria-hidden>–</span>
                    <input type="number" inputMode="decimal" min={0} placeholder={t('Máx.')} className={styles.select} value={filters.priceMax ?? ''} onChange={(e) => update({ priceMax: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                </fieldset>
              )}
              {cfg.badges && (
                <label className={styles.filterField}>
                  <span>{t('Mostrar')}</span>
                  <select className={styles.select} value={filters.badge} onChange={(e) => update({ badge: e.target.value as BadgeFilter })}>
                    {badgeFilters(t).map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {attributeFilters.map(({ def, options }) => (
                <label key={def.id} className={styles.filterField}>
                  <span>{def.name}</span>
                  <select className={styles.select} value={filters.attrs[def.id] ?? ''} onChange={(e) => update({ attrs: { ...filters.attrs, [def.id]: e.target.value } })}>
                    <option value="">{t('Todos')}</option>
                    {options.map((o) => (
                      <option key={o} value={o}>{def.type === 'boolean' ? yesNo(o, t) : o}{def.unit && def.type === 'number' ? ` ${def.unit}` : ''}</option>
                    ))}
                  </select>
                </label>
              ))}
              {showAvailability && (
                <label className={styles.filterToggle}>
                  <input type="checkbox" checked={filters.onlyAvailable} onChange={(e) => update({ onlyAvailable: e.target.checked })} />
                  {t('Sólo disponibles')}
                </label>
              )}
              {activeCount > 0 && (
                <button type="button" className={styles.linkButton} onClick={() => update({ priceMin: null, priceMax: null, badge: 'all', onlyAvailable: false, attrs: {} })}>
                  {t('Limpiar filtros')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {featured.length > 0 && (
        <div className={styles.catalogGroup}>
          <div className={styles.catalogGroupHead}>
            <h3 className={styles.h3}>{t('Destacados')}</h3>
          </div>
          <div className={styles.carousel} style={gridVars({ desktop: 3, tablet: 2, mobile: 1 })}>
            {featured.map((item, i) => (
              <ItemCard key={item.id} item={item} site={site} env={env} options={{ style: content.presentation.cardStyle === 'inherit' ? undefined : content.presentation.cardStyle, fields: content.presentation.fields, shape: content.presentation.shape, priority: i < 3 }} />
            ))}
          </div>
        </div>
      )}

      {isSearching && filtered.length > 0 && (
        <p className={styles.resultCount} aria-live="polite">
          {filtered.length === 1 ? t('1 resultado') : t('{count} resultados', { count: filtered.length })}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <PackageSearch size={36} strokeWidth={1.5} aria-hidden />
          <p className={styles.emptyTitle}>{items.length === 0 ? t('Muy pronto') : t('Sin resultados')}</p>
          <p>{items.length === 0 ? t('Estamos preparando nuestro catálogo.') : t('Prueba con otra búsqueda, categoría o filtro.')}</p>
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
            <ProductCollection items={group.items} site={site} env={env} presentation={content.presentation} categoryNames={categoryNames} />
          </div>
        ))
      )}

      {pagination.mode === 'pages' && pageCount > 1 && (
        <nav className={styles.pager} aria-label={t('Paginación')}>
          <button type="button" className={styles.chip} disabled={current === 1} onClick={() => goTo(current - 1)} aria-label={t('Página anterior')}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          {pageNumbers(current, pageCount).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} className={styles.pagerGap}>…</span>
            ) : (
              <button key={n} type="button" className={`${styles.chip} ${n === current ? styles.chipActive : ''}`} aria-current={n === current ? 'page' : undefined} onClick={() => goTo(n)}>
                {n}
              </button>
            ),
          )}
          <button type="button" className={styles.chip} disabled={current === pageCount} onClick={() => goTo(current + 1)} aria-label={t('Página siguiente')}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </nav>
      )}

      {(pagination.mode === 'loadMore' || pagination.mode === 'infinite') && remaining > 0 && (
        <div className={styles.sectionFoot} ref={sentinel}>
          <button type="button" className={`${styles.chip} ${styles.loadMore}`} onClick={() => setPage(current + 1)}>
            {t('Ver más ({count})', { count: remaining })}
          </button>
        </div>
      )}
    </SectionFrame>
  );
}

/** Valor de un atributo sí/no: el valor ('Sí'/'No') filtra; el texto va en el idioma del sitio. */
function yesNo(value: string, t: Translator): string {
  return value === 'Sí' ? t('Sí') : value === 'No' ? t('No') : value;
}

/** 1 … 4 5 6 … 12 */
function pageNumbers(current: number, count: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let n = 1; n <= count; n++) {
    if (n === 1 || n === count || Math.abs(n - current) <= 1) out.push(n);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`${styles.chip} ${active ? styles.chipActive : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}
