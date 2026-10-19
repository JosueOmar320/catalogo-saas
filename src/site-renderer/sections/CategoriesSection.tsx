import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { resolveLink } from '@/lib/site/links';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteImage } from '../SiteImage';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

function Tag(props: { href?: string; className: string; children: ReactNode; pageId?: string }) {
  return props.href ? (
    <a href={props.href} className={props.className} data-page-id={props.pageId}>
      {props.children}
    </a>
  ) : (
    <div className={props.className}>{props.children}</div>
  );
}

export function CategoriesSection({ section, site, env, links }: SectionProps<'categories'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const counts = new Map<string, number>();
  for (const item of site.items) if (item.categoryId) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  const selected = content.categoryIds.length
    ? content.categoryIds.flatMap((id) => site.categories.filter((c) => c.id === id))
    : site.categories.filter((c) => counts.has(c.id));
  if (selected.length === 0 && env.mode === 'public') return null;

  const target = content.linkPageId ? resolveLink({ kind: 'page', pageId: content.linkPageId, url: '', message: '', newTab: false }, links) : null;
  const hrefFor = (id: string) => (target ? `${target.href}?categoria=${id}` : undefined);
  const count = (id: string) => (content.showCount ? <span className={styles.count}>{(counts.get(id) ?? 0) === 1 ? t('1 ítem') : t('{count} ítems', { count: counts.get(id) ?? 0 })}</span> : null);

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />
      <Placeholder show={selected.length === 0}>{t('Crea categorías y asígnales ítems para que aparezcan aquí.')}</Placeholder>

      {content.display === 'list' ? (
        <div className={styles.catList}>
          {selected.map((c) => (
            <Tag key={c.id} href={hrefFor(c.id)} className={styles.catListItem} pageId={target?.pageId}>
              <div>
                <h3 className={styles.h3}>{c.name}</h3>
                {content.showDescription && c.description && <p className={`${styles.muted} ${styles.noMargin}`}>{c.description}</p>}
              </div>
              <span className={styles.count}>
                {count(c.id)} <ChevronRight size={16} aria-hidden />
              </span>
            </Tag>
          ))}
        </div>
      ) : (
        <div className={styles.grid} style={gridVars(content.columns)}>
          {selected.map((c) =>
            content.display === 'imageText' ? (
              <Tag key={c.id} href={hrefFor(c.id)} className={styles.catImageText} pageId={target?.pageId}>
                {c.imageUrl && <SiteImage src={c.imageUrl} alt="" sizes="(max-width: 600px) 100vw, 33vw" />}
                <div>
                  <h3 className={styles.h3}>{c.name}</h3>
                  {count(c.id)}
                </div>
              </Tag>
            ) : (
              <Tag key={c.id} href={hrefFor(c.id)} className={styles.catCard} pageId={target?.pageId}>
                {content.display === 'cards' && (
                  <div className={styles.catMedia}>{c.imageUrl && <SiteImage src={c.imageUrl} alt="" sizes="(max-width: 600px) 50vw, 25vw" />}</div>
                )}
                <h3 className={styles.h3}>{c.name}</h3>
                {content.showDescription && c.description && <p className={`${styles.muted} ${styles.noMargin}`}>{c.description}</p>}
                {count(c.id)}
              </Tag>
            ),
          )}
        </div>
      )}
    </SectionFrame>
  );
}
