import { mediaUrl } from '@/lib/utils/storage';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function LogosSection({ section, site, env }: SectionProps<'logos'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const logos = content.logos.flatMap((l) => {
    const url = mediaUrl(l.path);
    return url ? [{ ...l, src: url }] : [];
  });
  if (logos.length === 0 && env.mode === 'public') return null;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center />
      <Placeholder show={logos.length === 0}>{t('Agrega logos de marcas, clientes o certificaciones.')}</Placeholder>
      <div className={`${styles.grid} ${styles.logos}`} data-size={content.size} data-grayscale={content.grayscale || undefined} style={gridVars(content.columns)}>
        {logos.map((logo, i) => {
          // eslint-disable-next-line @next/next/no-img-element -- logos con proporción libre
          const img = <img src={logo.src} alt={logo.name} loading="lazy" />;
          return (
            <div key={`${logo.path}-${i}`} className={styles.logo} title={logo.name}>
              {logo.url && env.mode !== 'preview' ? <a href={logo.url} target="_blank" rel="noopener noreferrer">{img}</a> : img}
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}
