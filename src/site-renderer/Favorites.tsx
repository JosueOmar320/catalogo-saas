'use client';

import { Heart } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

/**
 * Favoritos del visitante: los productos que guardó con el corazón, en su
 * navegador (localStorage, uno por negocio). No viajan al servidor.
 */
const MAX_FAVORITES = 200;
const EMPTY: readonly string[] = [];
const cache = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

const keyOf = (slug: string) => `favs:${slug}`;

function read(slug: string): readonly string[] {
  const key = keyOf(slug);
  const cached = cache.get(key);
  if (cached) return cached;
  let list: readonly string[] = EMPTY;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(raw)) list = raw.filter((id): id is string => typeof id === 'string' && id.length <= 64).slice(0, MAX_FAVORITES);
  } catch {
    // Sin almacenamiento (modo privado) o dato alterado: sin favoritos.
  }
  cache.set(key, list);
  return list;
}

function write(slug: string, list: readonly string[]) {
  cache.set(keyOf(slug), list);
  try {
    localStorage.setItem(keyOf(slug), JSON.stringify(list));
  } catch {
    // Se conserva mientras la página esté abierta.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Otra pestaña cambió los favoritos.
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('favs:')) {
      cache.delete(event.key);
      onChange();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Ids de los favoritos del visitante (vacío en el servidor y al hidratar). */
export function useFavorites(slug: string): readonly string[] {
  return useSyncExternalStore(subscribe, () => read(slug), () => EMPTY);
}

export function toggleFavorite(slug: string, id: string) {
  const list = read(slug);
  write(slug, list.includes(id) ? list.filter((other) => other !== id) : [id, ...list].slice(0, MAX_FAVORITES));
}

/** Corazón para guardar un producto o servicio en favoritos. */
export function FavoriteButton({ slug, itemId, name, variant = 'card', corner = 'right' }: { slug: string; itemId: string; name: string; variant?: 'card' | 'detail'; corner?: 'left' | 'right' }) {
  const t = useSiteT();
  const active = useFavorites(slug).includes(itemId);
  return (
    <button
      type="button"
      className={variant === 'card' ? styles.favorite : styles.favoriteDetail}
      data-corner={variant === 'card' ? corner : undefined}
      aria-pressed={active}
      aria-label={active ? t('Quitar {name} de favoritos', { name }) : t('Guardar {name} en favoritos', { name })}
      title={active ? t('Quitar de favoritos') : t('Guardar en favoritos')}
      onClick={() => toggleFavorite(slug, itemId)}
    >
      <Heart size={variant === 'card' ? 17 : 18} fill={active ? 'currentColor' : 'none'} aria-hidden />
      {variant === 'detail' && <span>{active ? t('En tus favoritos') : t('Guardar')}</span>}
    </button>
  );
}
