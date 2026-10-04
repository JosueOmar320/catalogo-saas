import { User } from 'lucide-react';
import { mediaUrl } from '@/lib/utils/storage';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function TeamSection({ section, site, env }: SectionProps<'team'>) {
  const { content } = section;
  if (content.members.length === 0 && env.mode === 'public') return null;
  const list = content.layout === 'list';
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={!list} />
      <Placeholder show={content.members.length === 0}>Agrega a las personas de tu equipo desde el editor.</Placeholder>
      <div className={list ? styles.teamList : styles.grid} style={list ? undefined : gridVars(content.columns)}>
        {content.members.map((m) => {
          const photo = mediaUrl(m.photo);
          return (
            <article key={m.id} className={styles.teamMember} data-layout={content.layout}>
              <div className={styles.teamPhoto} data-shape={content.photoShape}>
                {photo ? <SiteImage src={photo} alt={m.name} sizes="240px" /> : <User size={36} strokeWidth={1.5} aria-hidden />}
              </div>
              <div>
                <h3 className={styles.h3}>{m.name}</h3>
                {m.role && <p className={styles.teamRole}>{m.role}</p>}
                {m.bio && <p className={styles.muted}>{m.bio}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </SectionFrame>
  );
}
