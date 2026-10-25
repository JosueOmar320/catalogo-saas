'use client';

import { ChevronLeft, ChevronRight, Heart, PackageSearch, Search, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { SectionOf } from '@/lib/site/section-schemas';
import { sortItems, type SortOption } from '@/lib/catalog/collections-core';
import { attributeFilterOptions, EMPTY_FILTERS, filterItems, groupByCategory, type CatalogFilters } from '../filter';
import { usedDietTags } from '../diet';
import { useFavorites } from '../Favorites';
import { ItemCard } from '../ItemCard';
import { ProductCollection } from '../ProductCollection';
import { gridVars, SectionFrame, SectionHead } from '../SectionFrame';
import { useSiteT } from '../SiteI18n';
import type { CatalogClientSite } from '../catalog-client-model';
import type { RenderEnv } from '../env';
import { CategoryNav, Chip, FilterFields, Sheet, SortSelect, ViewSwitch, type CategoryNavVariant, type FilterOptions } from './catalog-parts';
import styles from '../site.module.css';

/** Lo que recibe la cuadrícula: la sección, el modelo recortado del sitio (ver catalog-client-model) y el entorno. */
export type CatalogGridProps = { section: SectionOf<'catalog'>; site: CatalogClientSite; env: RenderEnv };

/**
 * Catálogo completo: búsqueda (nombre, código, etiquetas y atributos),
 * categorías, filtros (tipo, precio, estado, atributos), orden y paginación.
 * Tres disposiciones (content.browse.layout):
 *  · bar: todo en una barra arriba; los filtros se despliegan debajo.
 *  · sidebar: columna lateral con búsqueda, categorías y filtros a la vista
 *    (en el celular, un botón «Filtros» los abre en un panel).
 *  · drawer: barra mínima; los filtros y el orden van en un panel lateral.
 * Las categorías filtran o, en modo «jump», llevan a su grupo (como el menú
 * de un restaurante) y se marcan solas al desplazarse.
 * Recibe el modelo recortado (CatalogSection lo arma): al navegador sólo
 * viaja lo que la cuadrícula dibuja.
 */
export function CatalogGrid({ section, site, env }: CatalogGridProps) {
  const { content } = section;
  const { filters: cfg, pagination, browse } = content;
  const t = useSiteT();
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  // null = orden por defecto de la sección (así la preview refleja cambios del editor).
  const [userSort, setUserSort] = useState<SortOption | null>(null);
  const sort = userSort ?? content.sort.default;
  // Páginas (modo "pages") o bloques cargados (modos "loadMore" / "infinite").
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // Favoritos del visitante (en su navegador): un filtro más.
  const favorites = useFavorites(site.business.slug);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const query = useDeferredValue(filters.query);
  const items = useMemo(() => (content.itemType === 'any' ? site.items : site.items.filter((i) => i.type === content.itemType)), [site.items, content.itemType]);
  const jump = browse.categoryMode === 'jump';

  // Enlaces desde la sección "Categorías": ?categoria=<id>
  useEffect(() => {
    if (env.mode !== 'public') return;
    const id = new URLSearchParams(window.location.search).get('categoria');
    if (!id || !site.categories.some((c) => c.id === id)) return;
    // Después de hidratar (el HTML del servidor no conoce la URL del cliente).
    const timer = setTimeout(() => (jump ? document.getElementById(`categoria-${id}`)?.scrollIntoView({ block: 'start' }) : setFilters((f) => ({ ...f, categoryId: id }))));
    return () => clearTimeout(timer);
  }, [env.mode, site.categories, jump]);

  const categoryNames = useMemo(() => new Map(site.categories.map((c) => [c.id, c.name])), [site.categories]);
  const usedCategories = useMemo(() => {
    const used = new Set(items.map((i) => i.categoryId));
    return site.categories.filter((c) => used.has(c.id));
  }, [site.categories, items]);
  const counts = useMemo(() => {
    if (!browse.counts) return null;
    const map = new Map<string, number>();
    for (const item of items) if (item.categoryId) map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
    return map;
  }, [browse.counts, items]);
  const attributeFilters = useMemo(() => {
    if (!cfg.byAttributes) return [];
    const defs = cfg.attributes.length > 0 ? cfg.attributes.flatMap((id) => site.attributeDefs.filter((d) => d.id === id)) : site.attributeDefs.filter((d) => d.filterable);
    return defs.map((def) => ({ def, options: attributeFilterOptions(def, items) })).filter((a) => a.options.length > 1);
  }, [cfg.byAttributes, cfg.attributes, site.attributeDefs, items]);
  const dietTags = useMemo(() => usedDietTags(items), [items]);

  const hasBothTypes = items.some((i) => i.type === 'product') && items.some((i) => i.type === 'service');
  const hasPrices = items.some((i) => i.price !== null);
  const showTypes = cfg.types && hasBothTypes;
  const options: FilterOptions = { showPrice: cfg.price && hasPrices, badges: cfg.badges, dietTags, attributeFilters, showAvailability: cfg.availability && items.some((i) => !i.isAvailable) };
  const showCategories = cfg.categories && usedCategories.length > 1;
  const panelFilters = options.showPrice || options.badges || attributeFilters.length > 0 || options.showAvailability || dietTags.length > 0;
  const showSort = content.sort.allowUserSort;
  const favoriteIds = useMemo(() => new Set(env.mode === 'public' ? favorites : []), [favorites, env.mode]);
  const favoriteCount = items.filter((i) => favoriteIds.has(i.id)).length;
  // Sin favoritos (p. ej. quitó el último), el filtro deja de aplicar.
  const favoritesFilter = onlyFavorites && favoriteCount > 0;
  const showToolbar = items.length > 0 && (cfg.search || showCategories || showTypes || panelFilters || showSort || favoriteCount > 0 || browse.viewSwitch);

  // Dependencias campo por campo SIN el texto escrito: la búsqueda usa el valor diferido (`query`),
  // así cada tecla filtra una sola vez (antes: una con el texto viejo y otra con el nuevo).
  const { categoryId, type, onlyAvailable, priceMin, priceMax, badge, attrs, diet } = filters;
  const filtered = useMemo(
    () => sortItems(filterItems(favoritesFilter ? items.filter((i) => favoriteIds.has(i.id)) : items, { query, categoryId: jump ? 'all' : categoryId, type, onlyAvailable, priceMin, priceMax, badge, attrs, diet }), sort),
    [items, favoritesFilter, favoriteIds, query, categoryId, jump, type, onlyAvailable, priceMin, priceMax, badge, attrs, diet, sort],
  );
  const isSearching = filtered.length !== items.length || query.trim() !== '';

  // Búsquedas sin resultados (sólo el sitio publicado): el negocio ve qué le piden y no tiene.
  const trackMisses = env.mode === 'public' && env.basePath === `/catalogo/${site.business.slug}`;
  const reported = useRef(new Set<string>());
  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!trackMisses || term.length < 3 || reported.current.has(term)) return;
    // Sin resultados en todo el catálogo (no por los demás filtros), y cuando deja de escribir.
    if (filterItems(items, { ...EMPTY_FILTERS, query: term }).length > 0) return;
    const timer = window.setTimeout(() => {
      reported.current.add(term);
      try {
        navigator.sendBeacon?.('/api/search-misses', new Blob([JSON.stringify({ slug: site.business.slug, term })], { type: 'application/json' }));
      } catch {}
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [query, items, trackMisses, site.business.slug]);
  const featured = content.showFeatured && !isSearching ? items.filter((i) => i.isFeatured).slice(0, 6) : [];

  const perPage = pagination.perPage;
  // Con el menú de saltos se ve todo (cada categoría tiene que estar en la página).
  const paged = pagination.mode !== 'all' && !jump;
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pageCount);
  const visible = !paged ? filtered : pagination.mode === 'pages' ? filtered.slice((current - 1) * perPage, current * perPage) : filtered.slice(0, current * perPage);
  const remaining = filtered.length - visible.length;
  const grouped = jump || (content.groupByCategory && !query.trim() && sort === 'custom');
  const groups = grouped ? groupByCategory(visible, site.categories, t('Otros')) : [{ id: 'all', title: null, description: null, items: visible }];
  const activeCount = [filters.priceMin !== null || filters.priceMax !== null, filters.badge !== 'all', filters.onlyAvailable, (filters.diet ?? 'all') !== 'all', ...Object.values(filters.attrs).map(Boolean)].filter(Boolean).length;
  const presentation = view === 'list' ? { ...content.presentation, layout: 'compactList' as const } : content.presentation;

  const update = (patch: Partial<CatalogFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const clearFilters = () => update({ priceMin: null, priceMax: null, badge: 'all', onlyAvailable: false, attrs: {}, diet: 'all' });

  const top = useRef<HTMLDivElement>(null);
  // Menú de saltos: la categoría que se está viendo queda marcada.
  const [inView, setInView] = useState('all');
  const groupIds = groups.map((g) => g.id).join(',');
  useEffect(() => {
    if (!jump) return;
    const ids = groupIds.split(',');
    let raf = 0;
    // La marcada es la última categoría cuyo título ya pasó debajo de la barra (o «Todo» antes de la primera).
    const check = () => {
      raf = 0;
      const line = (top.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let current = 'all';
      for (const id of ids) {
        const el = document.getElementById(`categoria-${id}`);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setInView(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    // En captura: también el scroll de la vista previa del editor (no es la ventana).
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    check();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [jump, groupIds]);

  const selectCategory = (id: string) => {
    if (!jump) return update({ categoryId: id });
    setInView(id);
    const bar = top.current;
    if (id === 'all') return bar?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const group = document.getElementById(`categoria-${id}`);
    if (!group) return;
    // El grupo queda justo debajo de la barra fija (y del header fijo encima de ella).
    if (bar && browse.sticky) group.style.scrollMarginTop = `${(parseFloat(getComputedStyle(bar).getPropertyValue('--header-offset')) || 0) + bar.offsetHeight + 12}px`;
    group.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const goTo = (n: number) => {
    setPage(n);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeCategory = jump ? inView : filters.categoryId;
  const sidebar = browse.layout === 'sidebar';
  const drawer = browse.layout === 'drawer';

  const searchBox = cfg.search && (
    <label className={styles.search}>
      <span className={styles.visuallyHidden}>{t('Buscar')}</span>
      <Search size={16} className={styles.searchIcon} aria-hidden />
      <input type="search" className={styles.searchInput} placeholder={t('Buscar por nombre o código')} value={filters.query} onChange={(e) => update({ query: e.target.value })} />
    </label>
  );
  const categoryNav = (variant: CategoryNavVariant = browse.categoryNav) =>
    showCategories && <CategoryNav variant={variant} categories={usedCategories} active={activeCategory} counts={counts} total={items.length} onSelect={selectCategory} t={t} />;
  const typeChips = showTypes && (
    <div className={styles.chips} role="group" aria-label={t('Tipo')}>
      <Chip active={filters.type === 'product'} onClick={() => update({ type: filters.type === 'product' ? 'all' : 'product' })}>{t('Productos')}</Chip>
      <Chip active={filters.type === 'service'} onClick={() => update({ type: filters.type === 'service' ? 'all' : 'service' })}>{t('Servicios')}</Chip>
    </div>
  );
  const favoritesChip = favoriteCount > 0 && (
    <button
      type="button"
      className={`${styles.chip} ${favoritesFilter ? styles.chipActive : ''}`}
      aria-pressed={favoritesFilter}
      onClick={() => {
        setOnlyFavorites(!favoritesFilter);
        setPage(1);
      }}
    >
      <Heart size={14} fill={favoritesFilter ? 'currentColor' : 'none'} aria-hidden /> {t('Favoritos ({count})', { count: favoriteCount })}
    </button>
  );
  const filtersButton = (onClick: () => void, expanded: boolean) => (
    <button type="button" className={`${styles.chip} ${activeCount > 0 ? styles.chipActive : ''}`} aria-expanded={expanded} onClick={onClick}>
      <SlidersHorizontal size={14} aria-hidden /> {activeCount > 0 ? t('Filtros ({count})', { count: activeCount }) : t('Filtros')}
    </button>
  );
  const sortSelect = showSort && (
    <SortSelect
      value={sort}
      withPrices={hasPrices}
      t={t}
      onChange={(value) => {
        setUserSort(value);
        setPage(1);
      }}
    />
  );
  const viewSwitch = browse.viewSwitch && <ViewSwitch value={view} onChange={setView} t={t} />;
  const filterFields = (stacked: boolean) => <FilterFields filters={filters} options={options} update={update} activeCount={activeCount} onClear={clearFilters} stacked={stacked} t={t} />;
  // Lo que va en el panel lateral (celular en «sidebar», siempre en «drawer»).
  const sheetBody = (
    <>
      {sidebar && showCategories && (
        <div className={styles.sheetSection}>
          <p className={styles.asideTitle}>{t('Categorías')}</p>
          {categoryNav('list')}
        </div>
      )}
      {sidebar && typeChips}
      {drawer && showSort && (
        <div className={styles.sheetSection}>
          <p className={styles.asideTitle}>{t('Ordenar')}</p>
          {sortSelect}
        </div>
      )}
      {panelFilters && filterFields(true)}
    </>
  );
  const sheetFooter = (
    <button type="button" className={styles.btn} data-variant="solid" onClick={() => setSheetOpen(false)}>
      {filtered.length === 1 ? t('Ver 1 resultado') : t('Ver {count} resultados', { count: filtered.length })}
    </button>
  );

  const toolbar = showToolbar && !sidebar && (
    <div className={styles.toolbar} ref={top} data-sticky={browse.sticky} data-layout={browse.layout} data-cats={showCategories ? browse.categoryNav : undefined}>
      <div className={styles.toolbarRow}>
        {searchBox}
        <div className={styles.toolbarCats}>
          {categoryNav()}
          {!drawer && showCategories && typeChips && <span className={styles.chipDivider} aria-hidden />}
          {!drawer && typeChips}
        </div>
        <div className={styles.toolbarEnd}>
          {favoritesChip}
          {drawer ? (panelFilters || showSort || showTypes) && filtersButton(() => setSheetOpen(true), sheetOpen) : panelFilters && filtersButton(() => setPanelOpen((o) => !o), panelOpen)}
          {!drawer && sortSelect}
          {viewSwitch}
        </div>
      </div>
      {!drawer && panelFilters && panelOpen && filterFields(false)}
    </div>
  );
  // Fuera de la barra: su desenfoque (backdrop-filter) encerraría al panel fijo.
  const drawerSheet = drawer && (
    <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('Filtros')} footer={sheetFooter} t={t}>
      {typeChips}
      {sheetBody}
    </Sheet>
  );

  const results = (
    <>
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

      {isSearching && filtered.length > 0 && !sidebar && (
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
            <ProductCollection items={group.items} site={site} env={env} presentation={presentation} categoryNames={categoryNames} />
          </div>
        ))
      )}

      {paged && pagination.mode === 'pages' && pageCount > 1 && (
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

      {paged && (pagination.mode === 'loadMore' || pagination.mode === 'infinite') && remaining > 0 && (
        <div className={styles.sectionFoot} ref={sentinel}>
          <button type="button" className={`${styles.chip} ${styles.loadMore}`} onClick={() => setPage(current + 1)}>
            {t('Ver más ({count})', { count: remaining })}
          </button>
        </div>
      )}
    </>
  );

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={content.presentation.align === 'center'} />
      {sidebar && showToolbar ? (
        <div className={styles.catalogLayout} ref={top}>
          <aside className={styles.catalogAside} aria-label={t('Buscar y filtrar')} data-sticky={browse.sticky}>
            {searchBox}
            {showCategories && (
              <div>
                <p className={styles.asideTitle}>{t('Categorías')}</p>
                {categoryNav('list')}
              </div>
            )}
            {typeChips}
            {favoritesChip}
            {panelFilters && (
              <div>
                <p className={styles.asideTitle}>{t('Filtros')}</p>
                {filterFields(true)}
              </div>
            )}
          </aside>
          <div className={styles.catalogMain}>
            {/* En el celular la búsqueda va arriba; categorías y filtros, en el panel. */}
            {searchBox && <div className={styles.asideMobileSearch}>{searchBox}</div>}
            <div className={styles.resultsBar}>
              <p className={styles.resultCount} aria-live="polite">{filtered.length === 1 ? t('1 resultado') : t('{count} resultados', { count: filtered.length })}</p>
              <div className={styles.toolbarEnd}>
                {(panelFilters || showCategories || showTypes) && <span className={styles.asideOpener}>{filtersButton(() => setSheetOpen(true), sheetOpen)}</span>}
                {sortSelect}
                {viewSwitch}
              </div>
            </div>
            {results}
          </div>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('Buscar y filtrar')} footer={sheetFooter} t={t}>
            {sheetBody}
          </Sheet>
        </div>
      ) : (
        <>
          {toolbar}
          {drawerSheet}
          {results}
        </>
      )}
    </SectionFrame>
  );
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
