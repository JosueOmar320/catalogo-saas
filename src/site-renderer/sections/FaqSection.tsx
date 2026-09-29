import { ChevronDown } from 'lucide-react';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/** Preguntas frecuentes con <details>: accesible y sin JavaScript. */
export function FaqSection({ section, site, env }: SectionProps<'faq'>) {
  const { content } = section;
  const items = content.items.filter((i) => i.question.trim());
  if (items.length === 0 && env.mode === 'public') return null;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={content.layout !== 'twoColumns'} />
      <Placeholder show={items.length === 0}>Agrega preguntas y respuestas desde el editor.</Placeholder>
      <div className={styles.faq} data-layout={content.layout}>
        {items.map((item, i) =>
          content.layout === 'accordion' ? (
            <details key={item.id} className={styles.faqItem} open={content.openFirst && i === 0}>
              <summary className={styles.faqQuestion}>
                <span>{item.question}</span>
                <ChevronDown size={18} aria-hidden className={styles.faqChevron} />
              </summary>
              <p className={`${styles.faqAnswer} ${styles.preLine}`}>{item.answer}</p>
            </details>
          ) : (
            <div key={item.id} className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>{item.question}</h3>
              <p className={`${styles.faqAnswer} ${styles.preLine}`}>{item.answer}</p>
            </div>
          ),
        )}
      </div>
      {items.length > 0 && env.mode === 'public' && (
        <script
          type="application/ld+json"
          // JSON-LD de preguntas frecuentes (SEO). JSON.stringify escapa el contenido; se neutraliza "</".
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
            }).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </SectionFrame>
  );
}
