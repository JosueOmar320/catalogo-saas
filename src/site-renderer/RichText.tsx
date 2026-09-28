import { Fragment } from 'react';
import { parseRichText, type Inline } from '@/lib/design/rich-text';
import styles from './site.module.css';

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        let node: React.ReactNode = inline.text.split('\n').map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ));
        if (inline.bold) node = <strong>{node}</strong>;
        if (inline.italic) node = <em>{node}</em>;
        if (inline.href) node = <a href={inline.href} target={/^https?:/.test(inline.href) ? '_blank' : undefined} rel="noopener noreferrer">{node}</a>;
        return <Fragment key={index}>{node}</Fragment>;
      })}
    </>
  );
}

/** Texto enriquecido (Markdown liviano) → HTML seguro (sin dangerouslySetInnerHTML). */
export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseRichText(source);
  return (
    <div className={`${styles.rich} ${className ?? ''}`}>
      {blocks.map((block, index) => {
        if (block.type === 'p') return <p key={index}><Inlines inlines={block.inlines} /></p>;
        if (block.type === 'h') return <h3 key={index}><Inlines inlines={block.inlines} /></h3>;
        const List = block.type;
        return (
          <List key={index}>
            {block.items.map((item, i) => (
              <li key={i}><Inlines inlines={item} /></li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
