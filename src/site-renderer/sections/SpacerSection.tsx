import { SectionFrame } from '../SectionFrame';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function SpacerSection({ section, site }: SectionProps<'spacer'>) {
  const { height, divider } = section.content;
  return (
    <SectionFrame section={{ ...section, style: { ...section.style, paddingTop: 'none', paddingBottom: 'none' } }} theme={site.theme}>
      <div className={styles.spacer} data-height={height} aria-hidden>
        {divider === 'line' && <div className={styles.dividerLine} />}
        {divider === 'dots' && <span className={styles.dividerDots}>• • •</span>}
        {divider === 'ornament' && <span className={styles.dividerOrnament}>◆</span>}
      </div>
    </SectionFrame>
  );
}
