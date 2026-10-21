import { SocialIcon } from './SocialIcon';
import { SOCIAL_NETWORKS } from '@/lib/social/networks';
import type { SiteViewModel } from '@/lib/site/view-model';
import styles from './site.module.css';

export function SocialLinks({ site, display = 'icons' }: { site: SiteViewModel; display?: 'icons' | 'buttons' | 'cards' }) {
  const links = site.business.socialLinks;
  if (links.length === 0) return null;
  if (display === 'cards') {
    return (
      <div className={styles.socialCards}>
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.socialCard}>
            <SocialIcon network={link.network} size={20} /> {SOCIAL_NETWORKS[link.network].label}
          </a>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.social}>
      {links.map((link) =>
        display === 'buttons' ? (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.btn} data-variant="outline" data-hover={site.theme.buttons.hover}>
            <SocialIcon network={link.network} size={16} /> {SOCIAL_NETWORKS[link.network].label}
          </a>
        ) : (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.iconButton} aria-label={SOCIAL_NETWORKS[link.network].label} title={SOCIAL_NETWORKS[link.network].label}>
            <SocialIcon network={link.network} />
          </a>
        ),
      )}
    </div>
  );
}
