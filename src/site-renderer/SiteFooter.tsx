import { Clock, Globe, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { digitsOnly, hoursText } from '@/lib/business/profile';
import { env as appEnv } from '@/lib/env';
import { flattenNavigation, type ResolvedNavItem } from '@/lib/site/navigation';
import type { SiteViewModel } from '@/lib/site/view-model';
import { BackgroundLayers } from './Background';
import type { FooterColumn } from './chrome';
import { OpenNow } from './OpenNow';
import { siteTranslator } from './site-i18n';
import { SocialLinks } from './SocialLinks';
import styles from './site.module.css';

export function SiteFooter({ site, navItems, columns }: { site: SiteViewModel; navItems: ResolvedNavItem[]; columns: FooterColumn[] }) {
  const { footer } = site.theme;
  const { contact } = site.business;
  const address = [contact.address, contact.city].filter(Boolean).join(', ');
  const hasContact = Boolean(contact.phone || contact.whatsapp || contact.email || address || contact.website);
  const customBg = footer.background.type !== 'inherit';
  const pageLinks = flattenNavigation(navItems).filter((i) => i.style === 'link');
  const t = siteTranslator(site.settings.language);
  const hours = hoursText(contact, site.settings.locale, t('Cerrado'));
  const showPages = footer.showNav && pageLinks.length > 1 && footer.style !== 'simple';
  // Con muchas columnas, el negocio va en su propia fila y las demás se acomodan solas.
  const columnCount = columns.length + Number(showPages) + Number(footer.showContact && hasContact) + Number(footer.showHours && Boolean(hours));
  // "Sitio creado con {app}": el enlace va donde está la variable (el orden cambia según el idioma).
  const [brandingBefore, brandingAfter = ''] = t('Sitio creado con {app}').split('{app}');

  return (
    <footer className={`${styles.footer} ${styles.layered}`} data-style={footer.style} data-custom-bg={customBg}>
      {customBg && <BackgroundLayers background={footer.background} />}
      <div className={styles.container}>
        <div className={styles.footerGrid} data-many={columnCount > 3 || undefined}>
          <div>
            <p className={`${styles.heading} ${styles.h3}`}>{site.business.name}</p>
            {(footer.customText || site.business.slogan) && <p className={`${styles.muted} ${styles.preLine} ${styles.tightText}`}>{footer.customText || site.business.slogan}</p>}
            {footer.showSocial && site.business.socialLinks.length > 0 && (
              <div className={styles.spaceTop}>
                <SocialLinks site={site} />
              </div>
            )}
          </div>

          {columns.map((column) => (
            <div key={column.id}>
              {column.title && <p className={styles.footerTitle}>{column.title}</p>}
              <ul className={styles.footerList}>
                {column.links.map((link) => (
                  <li key={link.id}>
                    <a href={link.href} data-page-id={link.pageId} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {showPages && (
            <div>
              <p className={styles.footerTitle}>{t('Páginas')}</p>
              <ul className={styles.footerList}>
                {pageLinks.map((item) => (
                  <li key={item.id}>
                    <a href={item.href} data-page-id={item.pageId ?? undefined}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {footer.showContact && hasContact && (
            <div>
              <p className={styles.footerTitle}>{t('Contacto')}</p>
              <ul className={styles.footerList}>
                {contact.whatsapp && (
                  <li><MessageCircle size={16} aria-hidden /><a href={`https://wa.me/${digitsOnly(contact.whatsapp).replace('+', '')}`} target="_blank" rel="noopener noreferrer">{contact.whatsapp}</a></li>
                )}
                {contact.phone && <li><Phone size={16} aria-hidden /><a href={`tel:${digitsOnly(contact.phone)}`}>{contact.phone}</a></li>}
                {contact.email && <li><Mail size={16} aria-hidden /><a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
                {address && (
                  <li><MapPin size={16} aria-hidden />{contact.mapsUrl ? <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer">{address}</a> : <span>{address}</span>}</li>
                )}
                {contact.website && <li><Globe size={16} aria-hidden /><a href={contact.website} target="_blank" rel="noopener noreferrer">{contact.website.replace(/^https?:\/\//, '')}</a></li>}
              </ul>
            </div>
          )}

          {footer.showHours && hours && (
            <div>
              <p className={styles.footerTitle}>{t('Horarios')}</p>
              {contact.schedule.enabled && (
                <p className={styles.openRow}>
                  <OpenNow schedule={contact.schedule} locale={site.settings.locale} />
                </p>
              )}
              <ul className={styles.footerList}>
                <li><Clock size={16} aria-hidden /><p className={styles.preLine}>{hours}</p></li>
              </ul>
            </div>
          )}
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} {site.business.name}</span>
          {site.showBranding && (
            <span>
              {brandingBefore}
              <a href={appEnv.siteUrl} target="_blank" rel="noopener">{appEnv.appName}</a>
              {brandingAfter}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
