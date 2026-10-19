import type { Translator } from '@/i18n/translate';
import { resolveSectionItems } from '@/lib/site/resolve';
import { ProductCollection } from '../ProductCollection';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/** Ayuda de la preview cuando la fuente elegida no tiene ítems. */
function emptyHint(source: string, t: Translator): string {
  switch (source) {
    case 'featured':
      return t('Marca ítems como "Destacado" para que aparezcan aquí.');
    case 'new':
      return t('Marca ítems como "Nuevo" para que aparezcan aquí.');
    case 'sale':
      return t('Marca ítems como "Oferta" para que aparezcan aquí.');
    case 'popular':
      return t('Marca ítems como "Popular" para que aparezcan aquí.');
    default:
      return t('No hay ítems que coincidan con esta selección.');
  }
}

/** Colección de productos (o de cualquier fuente) con la presentación elegida. */
export function ProductsSection({ section, site, env, links, index }: SectionProps<'products'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const items = resolveSectionItems(content, site.items);
  const categoryNames = new Map(site.categories.map((c) => [c.id, c.name]));
  if (items.length === 0 && env.mode === 'public') return null;
  const center = content.presentation.align === 'center';

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      <Placeholder show={items.length === 0}>{emptyHint(content.collection.source, t)}</Placeholder>
      <ProductCollection items={items} site={site} env={env} presentation={content.presentation} categoryNames={categoryNames} priority={index === 0} />
      {content.button.label && (
        <div className={styles.sectionFoot}>
          <SiteButton button={content.button} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </SectionFrame>
  );
}
