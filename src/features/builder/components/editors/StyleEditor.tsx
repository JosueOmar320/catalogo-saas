'use client';

import type { Section, SectionStyle } from '@/lib/site/section-schemas';
import { Advanced, BackgroundEditor, Group, Segmented, SwitchRow, TextInput } from '../controls';

/** Estilo común a todas las secciones. El fondo sobrescribe al de la página y al global. */
export function StyleEditor({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  const style = section.style;
  const set = (patch: Partial<SectionStyle>) => onChange({ ...section, style: { ...style, ...patch } } as Section);
  const padding = [
    { value: 'default' as const, label: 'Auto' },
    { value: 'none' as const, label: '0' },
    { value: 'sm' as const, label: 'S' },
    { value: 'md' as const, label: 'M' },
    { value: 'lg' as const, label: 'L' },
    { value: 'xl' as const, label: 'XL' },
  ];
  return (
    <>
      <Group title="Fondo" description="Heredado = usa el fondo de la página (o el global del sitio).">
        <BackgroundEditor value={style.background} onChange={(background) => set({ background })} />
        <Segmented
          label="Color del texto"
          value={style.textColor}
          onChange={(textColor) => set({ textColor })}
          options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]}
        />
      </Group>
      <Group title="Espaciado y ancho">
        <Segmented label="Arriba" value={style.paddingTop} onChange={(paddingTop) => set({ paddingTop })} options={padding} />
        <Segmented label="Abajo" value={style.paddingBottom} onChange={(paddingBottom) => set({ paddingBottom })} options={padding} />
        <Segmented label="Ancho del contenido" value={style.width} onChange={(width) => set({ width })} options={[{ value: 'contained', label: 'Normal' }, { value: 'wide', label: 'Amplio' }, { value: 'full', label: 'Completo' }]} />
      </Group>
      <Advanced title="Visibilidad y anclas">
        <SwitchRow label="Ocultar en celulares" checked={style.hideOnMobile} onChange={(hideOnMobile) => set({ hideOnMobile })} />
        <SwitchRow label="Ocultar en escritorio" checked={style.hideOnDesktop} onChange={(hideOnDesktop) => set({ hideOnDesktop })} />
        <TextInput
          label="Ancla (id)"
          value={style.anchor}
          placeholder="ej. promociones"
          helper="Permite enlazar a esta sección con #ancla."
          onChange={(anchor) => set({ anchor: anchor.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
          maxLength={40}
        />
      </Advanced>
    </>
  );
}
