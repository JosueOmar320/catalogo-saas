import { resolveSectionItems } from '@/lib/site/resolve';
import { ProductCollection } from '../ProductCollection';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import styles from '../site.module.css';
import type { SectionProps } from './types';

const EMPTY_HINT: Partial<Record<string, string>> = {
  featured: 'Marca ítems como "Destacado" para que aparezcan aquí.',
  new: 'Marca ítems como "Nuevo" para que aparezcan aquí.',
  sale: 'Marca ítems como "Oferta" para que aparezcan aquí.',
  popular: 'Marca ítems como "Popular" para que aparezcan aquí.',
};

/** Colección de productos (o de cualquier fuente) con la presentación elegida. */
export function ProductsSection({ section, site, env, links, index }: SectionProps<'products'>) {
  const { content } = section;
  const items = resolveSectionItems(content, site.items);
  const categoryNames = new Map(site.categories.map((c) => [c.id, c.name]));
  if (items.length === 0 && env.mode === 'public') return null;
  const center = content.presentation.align === 'center';

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      <Placeholder show={items.length === 0}>{EMPTY_HINT[content.collection.source] ?? 'No hay ítems que coincidan con esta selección.'}</Placeholder>
      <ProductCollection items={items} site={site} env={env} presentation={content.presentation} categoryNames={categoryNames} priority={index === 0} />
      {content.button.label && (
        <div className={styles.sectionFoot}>
          <SiteButton button={content.button} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </SectionFrame>
  );
}
