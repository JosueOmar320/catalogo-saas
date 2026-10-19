import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { mapEmbedSrc } from '@/lib/business/maps';
import { digitsOnly, hoursText } from '@/lib/business/profile';
import { ContactActions } from '../ContactActions';
import { OpenNow } from '../OpenNow';
import { SectionFrame, SectionHead } from '../SectionFrame';
import { SocialLinks } from '../SocialLinks';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function ContactSection({ section, site, env }: SectionProps<'contact'>) {
  const { content } = section;
  const { contact } = site.business;
  const t = siteTranslator(site.settings.language);
  const address = [contact.address, contact.city].filter(Boolean).join(', ');
  const hours = hoursText(contact, site.settings.locale, t('Cerrado'));
  const rows = [
    content.showWhatsapp && contact.whatsapp && { key: 'wa', icon: MessageCircle, label: 'WhatsApp', value: contact.whatsapp, href: `https://wa.me/${digitsOnly(contact.whatsapp).replace('+', '')}` },
    content.showPhone && contact.phone && { key: 'tel', icon: Phone, label: t('Teléfono'), value: contact.phone, href: `tel:${digitsOnly(contact.phone)}` },
    content.showEmail && contact.email && { key: 'mail', icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
    content.showAddress && address && { key: 'addr', icon: MapPin, label: t('Dirección'), value: address, href: contact.mapsUrl || undefined },
    content.showHours && hours && { key: 'hours', icon: Clock, label: t('Horarios'), value: hours, href: undefined },
  ].filter(Boolean) as { key: string; icon: typeof Phone; label: string; value: string; href?: string }[];

  const mapSrc = content.showMap ? mapEmbedSrc(contact) : null;
  const hasAnything = rows.length > 0 || Boolean(mapSrc) || (content.showSocial && site.business.socialLinks.length > 0);
  if (!hasAnything && env.mode === 'public') return null;
  const center = content.layout === 'centered';

  const info = (
    <div>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      {content.showHours && contact.schedule.enabled && (
        <p className={`${styles.openRow} ${center ? styles.centerRow : ''}`}>
          <OpenNow schedule={contact.schedule} locale={site.settings.locale} />
        </p>
      )}
      {content.layout === 'cards' ? (
        <div className={styles.contactCards}>
          {rows.map((row) => (
            <a key={row.key} href={row.href} className={styles.contactCard} target={row.href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
              <row.icon size={22} aria-hidden />
              <strong className={styles.cardTitle}>{row.label}</strong>
              <span className={`${styles.muted} ${styles.preLine}`}>{row.value}</span>
            </a>
          ))}
        </div>
      ) : (
        <ul className={styles.contactList}>
          {rows.map((row) => (
            <li key={row.key}>
              <row.icon size={18} aria-hidden />
              {row.href ? (
                <a href={row.href} target={row.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{row.value}</a>
              ) : (
                <span className={styles.preLine}>{row.value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {contact.additionalInfo && <p className={`${styles.muted} ${styles.preLine} ${styles.spaceTop}`}>{contact.additionalInfo}</p>}
      {!hasAnything && <div className={styles.placeholder}>{t('Completa tus datos en Configuración › Información de contacto.')}</div>}
      {content.showActions && (
        <div className={`${styles.btnRow} ${styles.spaceTop} ${center ? styles.centerRow : ''}`}>
          <ContactActions site={site} />
        </div>
      )}
      {content.showSocial && (
        <div className={styles.spaceTop}>
          <SocialLinks site={site} />
        </div>
      )}
    </div>
  );

  return (
    <SectionFrame section={section} theme={site.theme}>
      <div className={styles.contactLayout} data-layout={content.layout}>
        {info}
        {mapSrc && <iframe className={styles.map} src={mapSrc} title={t('Mapa de {name}', { name: site.business.name })} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
      </div>
    </SectionFrame>
  );
}
