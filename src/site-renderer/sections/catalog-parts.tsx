'use client';

import { LayoutGrid, List, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Translator } from '@/i18n/translate';
import { SORT_OPTIONS, type SortOption } from '@/lib/catalog/collections-core';
import type { CatalogCategoryView } from '@/lib/catalog/view-model';
import type { DietTag } from '@/lib/catalog/item-attributes';
import { DIET_LABELS } from '../diet';
import type { BadgeFilter, CatalogFilters } from '../filter';
import type { CatalogClientSite } from '../catalog-client-model';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';

/** Orden que elige el visitante, en el idioma del sitio ("custom" es el orden del negocio). */
export function sortLabel(option: SortOption, t: Translator): string {
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

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`${styles.chip} ${active ? styles.chipActive : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

export type CategoryNavVariant = 'chips' | 'tabs' | 'select' | 'images' | 'list';

/**
 * Categorías del catálogo: píldoras, pestañas, lista desplegable, fotos o
 * (en la columna lateral) una lista. `counts`: cuántos ítems tiene cada una.
 */
export function CategoryNav({ variant, categories, active, counts, total, onSelect, t }: { variant: CategoryNavVariant; categories: CatalogCategoryView[]; active: string; counts: Map<string, number> | null; total: number; onSelect: (id: string) => void; t: Translator }) {
  const count = (n: number | undefined) => (counts && n !== undefined ? <span className={styles.catCount}>{n}</span> : null);
  if (variant === 'select') {
    return (
      <label className={styles.selectWrap}>
        <span className={styles.visuallyHidden}>{t('Categoría')}</span>
        <select className={styles.select} value={active} onChange={(e) => onSelect(e.target.value)}>
          <option value="all">{t('Todas las categorías')}{counts ? ` (${total})` : ''}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{counts ? ` (${counts.get(c.id) ?? 0})` : ''}</option>
          ))}
        </select>
      </label>
    );
  }
  if (variant === 'images') {
    return (
      <nav className={styles.catImages} aria-label={t('Categorías')}>
        {[{ id: 'all', name: t('Todo'), imageUrl: null as string | null }, ...categories].map((c) => (
          <button key={c.id} type="button" className={styles.catImage} aria-pressed={active === c.id} onClick={() => onSelect(c.id)}>
            <span className={styles.catImageThumb} aria-hidden>
              {c.imageUrl ? <SiteImage src={c.imageUrl} alt="" sizes="72px" /> : <span>{[...c.name.trim()][0]}</span>}
            </span>
            <span className={styles.catImageName}>{c.name}</span>
            {count(c.id === 'all' ? total : counts?.get(c.id))}
          </button>
        ))}
      </nav>
    );
  }
  const className = variant === 'tabs' ? styles.catTabs : variant === 'list' ? styles.catList : styles.chips;
  const item = variant === 'tabs' ? styles.catTab : variant === 'list' ? styles.catListItem : undefined;
  return (
    <nav className={className} aria-label={t('Categorías')}>
      {[{ id: 'all', name: t('Todo') }, ...categories].map((c) =>
        item ? (
          <button key={c.id} type="button" className={item} aria-pressed={active === c.id} onClick={() => onSelect(c.id)}>
            <span>{c.name}</span>
            {count(c.id === 'all' ? total : counts?.get(c.id))}
          </button>
        ) : (
          <Chip key={c.id} active={active === c.id} onClick={() => onSelect(c.id)}>
            {c.name}
            {count(c.id === 'all' ? total : counts?.get(c.id))}
          </Chip>
        ),
      )}
    </nav>
  );
}

export function SortSelect({ value, onChange, withPrices, t }: { value: SortOption; onChange: (value: SortOption) => void; withPrices: boolean; t: Translator }) {
  return (
    <label className={styles.selectWrap}>
      <span className={styles.visuallyHidden}>{t('Ordenar')}</span>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value as SortOption)}>
        {SORT_OPTIONS.filter((o) => withPrices || (o !== 'priceAsc' && o !== 'priceDesc')).map((o) => (
          <option key={o} value={o}>{sortLabel(o, t)}</option>
        ))}
      </select>
    </label>
  );
}

/** Cuadrícula o lista, a gusto del visitante. */
export function ViewSwitch({ value, onChange, t }: { value: 'grid' | 'list'; onChange: (value: 'grid' | 'list') => void; t: Translator }) {
  return (
    <div className={styles.viewSwitch} role="group" aria-label={t('Vista')}>
      <button type="button" aria-pressed={value === 'grid'} aria-label={t('Ver en cuadrícula')} title={t('Ver en cuadrícula')} onClick={() => onChange('grid')}>
        <LayoutGrid size={16} aria-hidden />
      </button>
      <button type="button" aria-pressed={value === 'list'} aria-label={t('Ver en lista')} title={t('Ver en lista')} onClick={() => onChange('list')}>
        <List size={16} aria-hidden />
      </button>
    </div>
  );
}

export type FilterOptions = {
  showPrice: boolean;
  badges: boolean;
  dietTags: DietTag[];
  attributeFilters: { def: CatalogClientSite['attributeDefs'][number]; options: string[] }[];
  showAvailability: boolean;
};

/** Precio, etiquetas, dieta, atributos y disponibilidad (los mismos en la barra, la columna y el panel). */
export function FilterFields({ filters, options, update, activeCount, onClear, stacked = false, t }: { filters: CatalogFilters; options: FilterOptions; update: (patch: Partial<CatalogFilters>) => void; activeCount: number; onClear: () => void; stacked?: boolean; t: Translator }) {
  return (
    <div className={stacked ? styles.filterStack : styles.filterPanel}>
      {options.showPrice && (
        <fieldset className={styles.filterField}>
          <legend>{t('Precio')}</legend>
          <div className={styles.priceRange}>
            <input type="number" inputMode="decimal" min={0} placeholder={t('Mín.')} aria-label={t('Precio mínimo')} className={styles.select} value={filters.priceMin ?? ''} onChange={(e) => update({ priceMin: e.target.value === '' ? null : Number(e.target.value) })} />
            <span aria-hidden>–</span>
            <input type="number" inputMode="decimal" min={0} placeholder={t('Máx.')} aria-label={t('Precio máximo')} className={styles.select} value={filters.priceMax ?? ''} onChange={(e) => update({ priceMax: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </fieldset>
      )}
      {options.badges && (
        <label className={styles.filterField}>
          <span>{t('Mostrar')}</span>
          <select className={styles.select} value={filters.badge} onChange={(e) => update({ badge: e.target.value as BadgeFilter })}>
            {badgeFilters(t).map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
      )}
      {options.dietTags.length > 0 && (
        <label className={styles.filterField}>
          <span>{t('Dieta')}</span>
          <select className={styles.select} value={filters.diet ?? 'all'} onChange={(e) => update({ diet: e.target.value as DietTag | 'all' })}>
            <option value="all">{t('Todas')}</option>
            {options.dietTags.map((tag) => (
              <option key={tag} value={tag}>{t(DIET_LABELS[tag])}</option>
            ))}
          </select>
        </label>
      )}
      {options.attributeFilters.map(({ def, options: values }) => (
        <label key={def.id} className={styles.filterField}>
          <span>{def.name}</span>
          <select className={styles.select} value={filters.attrs[def.id] ?? ''} onChange={(e) => update({ attrs: { ...filters.attrs, [def.id]: e.target.value } })}>
            <option value="">{t('Todos')}</option>
            {values.map((o) => (
              <option key={o} value={o}>{def.type === 'boolean' ? yesNo(o, t) : o}{def.unit && def.type === 'number' ? ` ${def.unit}` : ''}</option>
            ))}
          </select>
        </label>
      ))}
      {options.showAvailability && (
        <label className={styles.filterToggle}>
          <input type="checkbox" checked={filters.onlyAvailable} onChange={(e) => update({ onlyAvailable: e.target.checked })} />
          {t('Sólo disponibles')}
        </label>
      )}
      {activeCount > 0 && (
        <button type="button" className={styles.linkButton} onClick={onClear}>
          {t('Limpiar filtros')}
        </button>
      )}
    </div>
  );
}

/** Valor de un atributo sí/no: el valor ('Sí'/'No') filtra; el texto va en el idioma del sitio. */
export function yesNo(value: string, t: Translator): string {
  return value === 'Sí' ? t('Sí') : value === 'No' ? t('No') : value;
}

/**
 * Panel lateral (filtros en el celular o con la disposición «panel»): fondo
 * que cierra, Escape, foco dentro y de vuelta al botón que lo abrió. Sin
 * <dialog> modal: así queda dentro de la vista previa del editor.
 */
export function Sheet({ open, onClose, title, footer, children, t }: { open: boolean; onClose: () => void; title: string; footer?: ReactNode; children: ReactNode; t: Translator }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className={styles.mobileBackdrop} onClick={onClose} aria-hidden />
      <div ref={panel} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.sheetHead}>
          <h2 id={titleId} className={styles.sheetTitle}>{title}</h2>
          <button type="button" className={styles.sheetClose} aria-label={t('Cerrar')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer && <div className={styles.sheetFoot}>{footer}</div>}
      </div>
    </>
  );
}
