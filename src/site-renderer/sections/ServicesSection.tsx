import { resolveSectionItems } from '@/lib/site/resolve';
import { ProductCollection } from '../ProductCollection';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/** Servicios: misma maquinaria que productos, con zigzag como presentación por defecto. */
export function ServicesSection({ section, site, env, links, index }: SectionProps<'services'>) {
  const { content } = section;
  const items = resolveSectionItems(content, site.items);
  const categoryNames = new Map(site.categories.map((c) => [c.id, c.name]));
  if (items.length === 0 && env.mode === 'public') return null;

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={content.presentation.align === 'center'} />
      <Placeholder show={items.length === 0}>Crea servicios en Catálogo › Servicios para que aparezcan aquí.</Placeholder>
      <ProductCollection items={items} site={site} env={env} presentation={content.presentation} categoryNames={categoryNames} priority={index === 0} />
      {content.button.label && (
        <div className={styles.sectionFoot}>
          <SiteButton button={content.button} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </SectionFrame>
  );
}
