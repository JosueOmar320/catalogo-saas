import { resolveContactActions, type ContactActionType } from '@/lib/contact/actions';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { defaultText } from './default-texts';
import { buttonVariant } from './SiteButton';
import { siteTranslator } from './site-i18n';
import { Icon } from './Icon';
import styles from './site.module.css';

const ICONS: Record<ContactActionType, string> = { whatsapp: 'message-circle', phone: 'phone', email: 'mail' };

type Props = {
  site: SiteViewModel;
  item?: CatalogItemView;
  show?: 'primary' | 'all';
  small?: boolean;
  block?: boolean;
  /** Estilo de botón de las tarjetas: solid, link o sólo ícono. */
  appearance?: 'solid' | 'link' | 'icon';
  labelOverride?: string;
  shortLabel?: string;
};

/** Botones de contacto (WhatsApp con mensaje del ítem, llamada, email). */
export function ContactActions({ site, item, show = 'all', small, block, appearance = 'solid', labelOverride, shortLabel }: Props) {
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
  const visible = show === 'primary' ? actions.slice(0, 1) : actions;
  if (visible.length === 0) return null;
  const theme = site.theme;

  return (
    <>
      {visible.map((action, index) => {
        const label = labelOverride && index === 0 ? labelOverride : defaultText(action.label, t);
        const variant = appearance === 'link' ? 'ghost' : buttonVariant(theme, index === 0 ? 'primary' : 'secondary');
        return (
          <a
            key={action.type}
            href={action.href}
            className={`${styles.btn} ${small ? styles.btnSmall : ''} ${block && appearance !== 'icon' ? styles.btnBlock : ''}`}
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
