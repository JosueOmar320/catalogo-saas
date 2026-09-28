/**
 * Texto enriquecido liviano (subconjunto de Markdown) sin dependencias:
 *   **negrita**, *cursiva*, [enlace](https://…), "- lista", "1. lista", "### Subtítulo"
 * Se parsea a un árbol simple que renderizan la web y el PDF.
 * Los enlaces sólo aceptan http(s), mailto y tel (sin javascript:).
 */
export type Inline = { text: string; bold?: boolean; italic?: boolean; href?: string };
export type RichBlock =
  | { type: 'p'; inlines: Inline[] }
  | { type: 'h'; inlines: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] };

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((\S+?)\)/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) });
    if (match[1] !== undefined) out.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) out.push({ text: match[2], italic: true });
    else out.push(SAFE_URL.test(match[4]) ? { text: match[3], href: match[4] } : { text: match[3] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: Inline[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', inlines: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h', inlines: parseInline(heading[1]) });
    } else if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(parseInline((bullet ?? numbered)![1]));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Texto plano (para SEO, vistas previas y límites). */
export function richTextToPlain(source: string): string {
  return source.replace(/\*\*|\*|^#{1,3}\s+|^\s*[-•*]\s+/gm, '').replace(/\[(.+?)\]\(\S+?\)/g, '$1').trim();
}
