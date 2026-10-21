import type { Translator } from '@/i18n/translate';
import { msg } from '@/i18n/translate';
import { DIET_TAGS, type DietTag } from '@/lib/catalog/item-attributes-core';
import styles from './site.module.css';

/** Etiquetas de dieta y alérgenos en el idioma del sitio. */
export const DIET_LABELS: Record<DietTag, string> = {
  vegan: msg('Vegano'),
  vegetarian: msg('Vegetariano'),
  'gluten-free': msg('Sin gluten'),
  'lactose-free': msg('Sin lactosa'),
  'sugar-free': msg('Sin azúcar'),
  spicy: msg('Picante'),
  organic: msg('Orgánico'),
};

/** Las que usa algún ítem, en el orden de la lista (para el filtro del catálogo). */
export const usedDietTags = (items: { diet: DietTag[] }[]) => DIET_TAGS.filter((tag) => items.some((item) => item.diet.includes(tag)));

/** Chips "Vegano · Sin gluten" en la tarjeta o la ficha. */
export function DietTags({ tags, t, small }: { tags: DietTag[]; t: Translator; small?: boolean }) {
  if (!tags.length) return null;
  return (
    <ul className={styles.dietTags} data-small={small || undefined} aria-label={t('Dieta')}>
      {tags.map((tag) => (
        <li key={tag}>{t(DIET_LABELS[tag])}</li>
      ))}
    </ul>
  );
}
