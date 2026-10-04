import { createColumnBlock, type ColumnsContent } from './section-schemas';

/**
 * Composiciones listas para la sección Columnas. Las usan el editor
 * ("Empezar con…"), las plantillas de sitio y Garfield (también en modo
 * local): no hay componentes duplicados, sólo combinaciones de bloques.
 */

export const COLUMN_PRESETS = ['imageText', 'textImage', 'threeCards', 'steps', 'benefitsImage', 'ctaButtons', 'stats'] as const;
export type ColumnPreset = (typeof COLUMN_PRESETS)[number];

export const COLUMN_PRESET_META: Record<ColumnPreset, { label: string; description: string }> = {
  imageText: { label: 'Imagen + texto', description: 'Foto a la izquierda; título, texto y botón a la derecha.' },
  textImage: { label: 'Texto + imagen', description: 'Como la anterior, con la imagen a la derecha.' },
  threeCards: { label: 'Tres tarjetas', description: 'Servicios, planes o razones con ícono y botón.' },
  steps: { label: 'Proceso en pasos', description: '4 pasos numerados: cómo trabajamos.' },
  benefitsImage: { label: 'Lista de beneficios', description: 'Lista con íconos junto a una imagen.' },
  ctaButtons: { label: 'Llamado a la acción', description: 'Título, texto y dos botones centrados.' },
  stats: { label: 'Cifras', description: 'Cuatro números destacados.' },
};

const col = (id: string, blocks: ColumnsContent['columns'][number]['blocks'], extra: Partial<ColumnsContent['columns'][number]> = {}) => ({ id, blocks, align: 'left' as const, surface: 'none' as const, padding: 'none' as const, ...extra });
const whatsapp = (label: string) => ({ label, link: { kind: 'whatsapp' as const, pageId: '', url: '', message: '', newTab: false }, variant: 'primary' as const, icon: 'message-circle' as const });
const secondary = (label: string, pageId = '') => ({ label, link: pageId ? { kind: 'page' as const, pageId, url: '', message: '', newTab: false } : { kind: 'none' as const, pageId: '', url: '', message: '', newTab: false }, variant: 'secondary' as const, icon: '' as const });

export function columnPreset(preset: ColumnPreset, copy: { title?: string; text?: string; image?: string | null } = {}): Partial<ColumnsContent> {
  const title = copy.title ?? 'Un título que explique tu propuesta';
  const text = copy.text ?? 'Cuenta en dos o tres frases qué haces, para quién y por qué elegirte.';
  const image = createColumnBlock('image', { image: { path: copy.image ?? null }, ratio: 'landscape', shadow: true });
  const copyBlocks = [createColumnBlock('heading', { text: title, level: 'h2' }), createColumnBlock('text', { body: text }), createColumnBlock('buttons', { items: [whatsapp('Escríbenos')] })];
  switch (preset) {
    case 'imageText':
      return { layout: '1-1', verticalAlign: 'center', reverseOnMobile: false, columns: [col('c1', [image]), col('c2', copyBlocks)] };
    case 'textImage':
      return { layout: '1-1', verticalAlign: 'center', reverseOnMobile: true, columns: [col('c1', copyBlocks), col('c2', [image])] };
    case 'threeCards':
      return {
        layout: '1-1-1',
        verticalAlign: 'stretch',
        columns: (['sparkles', 'shield-check', 'clock'] as const).map((icon, i) =>
          col(`c${i + 1}`, [createColumnBlock('card', { icon, title: ['Calidad', 'Garantía', 'Rapidez'][i], text: 'Describe en una frase este beneficio o servicio.', button: secondary('Más información') })]),
        ),
      };
    case 'steps':
      return {
        layout: '1-1-1-1',
        verticalAlign: 'top',
        tablet: '2',
        columns: ['Contáctanos', 'Te asesoramos', 'Lo preparamos', 'Lo disfrutas'].map((step, i) =>
          col(`c${i + 1}`, [createColumnBlock('badge', { text: `Paso ${i + 1}`, tone: 'accent' }), createColumnBlock('heading', { text: step, level: 'h3' }), createColumnBlock('text', { body: 'Explica brevemente este paso.', size: 'sm' })]),
        ),
      };
    case 'benefitsImage':
      return {
        layout: '1-1',
        verticalAlign: 'center',
        columns: [
          col('c1', [
            createColumnBlock('heading', { eyebrow: '¿Por qué elegirnos?', text: title, level: 'h2' }),
            createColumnBlock('list', { marker: 'check', items: ['Atención personalizada', 'Materiales de primera', 'Entrega puntual', 'Garantía por escrito'].map((t) => ({ id: crypto.randomUUID(), text: t, icon: '' })) }),
            createColumnBlock('buttons', { items: [whatsapp('Pide tu cotización')] }),
          ]),
          col('c2', [image]),
        ],
      };
    case 'ctaButtons':
      return {
        layout: '1',
        columns: [col('c1', [createColumnBlock('heading', { text: title, level: 'h2' }), createColumnBlock('text', { body: text, size: 'lg' }), createColumnBlock('buttons', { items: [whatsapp('Escríbenos por WhatsApp'), secondary('Ver catálogo')] })], { align: 'center' })],
      };
    case 'stats':
      return {
        layout: '1-1-1-1',
        verticalAlign: 'top',
        tablet: '2',
        mobile: '2',
        columns: [['+10', 'años de experiencia'], ['+500', 'clientes felices'], ['24 h', 'tiempo de respuesta'], ['100%', 'garantía']].map(([value, label], i) => col(`c${i + 1}`, [createColumnBlock('stat', { value, label })], { align: 'center' })),
      };
  }
}
