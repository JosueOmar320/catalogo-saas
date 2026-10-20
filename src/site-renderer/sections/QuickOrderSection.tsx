import { ImageIcon } from 'lucide-react';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { itemPath } from '../env';
import { orderable, toOrderItem } from '../order/config';
import { AddToOrder } from '../order/OrderProvider';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { buttonVariant } from '../SiteButton';
import { SiteImage } from '../SiteImage';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/**
 * Pedido rápido: los productos en una lista compacta (foto, nombre, precio y
 * cantidad) para armar un pedido grande sin abrir cada ficha. Los que tienen
 * opciones o extras llevan a su ficha para elegir; los agotados no se piden.
 */
export function QuickOrderSection({ section, site, env }: SectionProps<'quickorder'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const products = site.items.filter((item) => item.type === 'product' && (!content.categoryId || item.categoryId === content.categoryId));
  const ordering = site.items.some((item) => orderable(site, item));
  if (env.mode === 'public' && (!ordering || products.length === 0)) return null;

  const groups = content.groupByCategory
    ? [...site.categories.map((c) => ({ id: c.id, name: c.name as string | null })), { id: null, name: site.categories.length ? t('Otros') : null }]
        .map((group) => ({ ...group, items: products.filter((item) => (group.id === null ? !site.categories.some((c) => c.id === item.categoryId) : item.categoryId === group.id)) }))
        .filter((group) => group.items.length > 0)
    : [{ id: 'all', name: null, items: products }];

  const row = (item: CatalogItemView) => {
    const image = item.images[0];
    const choose = Boolean(item.variants || item.extras);
    return (
      <li key={item.id} className={styles.quickRow}>
        {content.showImages && (
          <span className={styles.quickThumb}>{image ? <SiteImage src={image.thumbUrl} alt="" sizes="48px" /> : <ImageIcon size={18} aria-hidden />}</span>
        )}
        <span className={styles.quickName}>
          {env.mode === 'preview' ? item.name : <a href={itemPath(env, item.slug)}>{item.name}</a>}
          {item.tiers[0] && <small>{t('Mayoreo: desde {qty}, {price} c/u', { qty: item.tiers[0].minQty, price: item.tiers[0].priceLabel })}</small>}
        </span>
        <span className={styles.quickPrice}>
          {item.priceNote === 'desde' ? t('desde {price}', { price: item.priceLabel ?? '' }) : (item.priceLabel ?? t('Por confirmar'))}
        </span>
        <span className={styles.quickAction}>
          {!item.isAvailable ? (
            <span className={styles.availability}>{t('No disponible')}</span>
          ) : choose ? (
            env.mode === 'preview' ? (
              <span className={styles.muted}>{t('Elegir opción')}</span>
            ) : (
              <a href={itemPath(env, item.slug)} className={styles.linkButton}>
                {t('Elegir opción')}
              </a>
            )
          ) : orderable(site, item) ? (
            <AddToOrder item={toOrderItem(item)} className={styles.btn} variant={buttonVariant(site.theme, 'primary')} hover={site.theme.buttons.hover} label={t('Agregar al pedido')} shortLabel={t('Agregar')} small />
          ) : null}
        </span>
      </li>
    );
  };

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />
      <Placeholder show={!ordering}>{t('Activa los pedidos por WhatsApp para que tus clientes pidan desde esta lista.')}</Placeholder>
      <Placeholder show={ordering && products.length === 0}>{t('Aquí aparecerán tus productos.')}</Placeholder>
      {groups.map((group) => (
        <div key={group.id ?? 'otros'} className={styles.quickGroup}>
          {group.name && <h3 className={styles.quickGroupTitle}>{group.name}</h3>}
          <ul className={styles.quickList} aria-label={group.name ?? t('Productos')}>
            {group.items.map(row)}
          </ul>
        </div>
      ))}
    </SectionFrame>
  );
}
