import { resolveContactActions, type ContactActionType } from '@/lib/contact/actions';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { CatalogClientSite } from './catalog-client-model';
import { defaultText } from './default-texts';
import { itemPath, type RenderEnv } from './env';
import { buttonVariant } from './SiteButton';
import { siteTranslator } from './site-i18n';
import { Icon } from './Icon';
import { orderable, toOrderItem } from './order/config';
import { AddToOrder } from './order/OrderProvider';
import styles from './site.module.css';

const ICONS: Record<ContactActionType, string> = { whatsapp: 'message-circle', phone: 'phone', email: 'mail' };

type Props = {
  /** El modelo completo o el recortado de la sección de catálogo. */
  site: CatalogClientSite;
  item?: CatalogItemView;
  show?: 'primary' | 'all';
  small?: boolean;
  block?: boolean;
  /** Estilo de botón de las tarjetas: solid, link o sólo ícono. */
  appearance?: 'solid' | 'link' | 'icon';
  labelOverride?: string;
  shortLabel?: string;
  /** La ficha de un producto con opciones agrega desde VariantPicker: aquí sólo van las demás acciones. */
  skipOrder?: boolean;
  /** Para enlazar a la ficha dentro del mismo sitio (demo, vista previa o publicado). */
  env?: RenderEnv;
};

/** Botones de contacto (WhatsApp con mensaje del ítem, llamada, email). */
export function ContactActions({ site, item, show = 'all', small, block, appearance = 'solid', labelOverride, shortLabel, skipOrder, env }: Props) {
  const t = siteTranslator(site.settings.language);
  const config = site.settings.contactActions;
  // Mensaje y asunto de fábrica en el idioma del sitio (los personalizados se respetan).
  const localized = {
    ...config,
    whatsapp: { ...config.whatsapp, message: defaultText(config.whatsapp.message, t) },
    email: { ...config.email, subject: defaultText(config.email.subject, t) },
  };
  const actions = resolveContactActions(localized, {
    businessName: site.business.name,
    contact: site.business.contact,
    catalogUrl: site.url,
    item: item && { name: item.name, priceLabel: item.priceLabel, sku: item.sku, url: item.url },
  });
  // Con pedido por WhatsApp, el botón principal de un producto es "Agregar al pedido"
  // y las demás acciones (consultar, llamar…) quedan como secundarias en la ficha.
  const ordering = item && !skipOrder ? orderable(site, item) : false;
  const visible = show === 'primary' ? (ordering ? [] : actions.slice(0, 1)) : actions;
  if (visible.length === 0 && !ordering) return null;
  const theme = site.theme;
  const offset = ordering ? 1 : 0;

  const buttonClass = `${styles.btn} ${small ? styles.btnSmall : ''} ${block && appearance !== 'icon' ? styles.btnBlock : ''}`;

  return (
    <>
      {ordering && item?.variants && (
        // Con opciones hay que elegir una: la tarjeta lleva a la ficha.
        <a
          // En el lienzo del editor (preview) las fichas no se abren, igual que ItemLink.
          href={!env ? item.url : env.mode === 'preview' ? undefined : itemPath(env, item.slug)}
          className={buttonClass}
          data-variant={appearance === 'link' ? 'ghost' : buttonVariant(theme, 'primary')}
          data-hover={theme.buttons.hover}
          aria-label={appearance === 'icon' ? t('Elegir opción') : undefined}
          title={appearance === 'icon' ? t('Elegir opción') : undefined}
        >
          <Icon id="arrow-right" size={small ? 15 : 17} />
          {appearance !== 'icon' &&
            (shortLabel ? (
              <>
                <span className={styles.labelFull}>{t('Elegir opción')}</span>
                <span className={styles.labelShort}>{t('Opciones')}</span>
              </>
            ) : (
              t('Elegir opción')
            ))}
        </a>
      )}
      {ordering && item && !item.variants && (
        <AddToOrder
          item={toOrderItem(item)}
          className={buttonClass}
          variant={appearance === 'link' ? 'ghost' : buttonVariant(theme, 'primary')}
          hover={theme.buttons.hover}
          label={t('Agregar al pedido')}
          shortLabel={shortLabel ? t('Agregar') : undefined}
          iconOnly={appearance === 'icon'}
          small={small}
          block={block && appearance !== 'icon'}
        />
      )}
      {visible.map((action, index) => {
        const label = labelOverride && index + offset === 0 ? labelOverride : defaultText(action.label, t);
        const variant = appearance === 'link' ? 'ghost' : buttonVariant(theme, index + offset === 0 ? 'primary' : 'secondary');
        return (
          <a
            key={action.type}
            href={action.href}
            className={buttonClass}
            data-variant={variant}
            data-hover={theme.buttons.hover}
            target={action.external ? '_blank' : undefined}
            rel={action.external ? 'noopener noreferrer' : undefined}
            aria-label={appearance === 'icon' ? label : undefined}
            title={appearance === 'icon' ? label : undefined}
          >
            <Icon id={ICONS[action.type]} size={small ? 15 : 17} />
            {appearance !== 'icon' &&
              (shortLabel ? (
                <>
                  <span className={styles.labelFull}>{label}</span>
                  <span className={styles.labelShort}>{shortLabel}</span>
                </>
              ) : (
                label
              ))}
          </a>
        );
      })}
    </>
  );
}
