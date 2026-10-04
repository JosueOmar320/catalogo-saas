'use client';

import { Box, Chip, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import type { Section, SectionStyle } from '@/lib/site/section-schemas';
import { BackgroundEditor, ColorInput, Group, Segmented, SelectInput, SliderInput, SwitchRow, TextInput } from '../controls';

type Category = 'background' | 'layout' | 'spacing' | 'appearance' | 'mobile' | 'advanced';
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'background', label: 'Fondo' },
  { id: 'layout', label: 'Diseño' },
  { id: 'spacing', label: 'Espaciado' },
  { id: 'appearance', label: 'Apariencia' },
  { id: 'mobile', label: 'Celular' },
  { id: 'advanced', label: 'Avanzado' },
];

const mobilePadding = [
  { value: 'inherit' as const, label: 'Igual' },
  { value: 'none' as const, label: '0' },
  { value: 'sm' as const, label: 'S' },
  { value: 'md' as const, label: 'M' },
  { value: 'lg' as const, label: 'L' },
];

const padding = [
  { value: 'default' as const, label: 'Auto' },
  { value: 'none' as const, label: '0' },
  { value: 'sm' as const, label: 'S' },
  { value: 'md' as const, label: 'M' },
  { value: 'lg' as const, label: 'L' },
  { value: 'xl' as const, label: 'XL' },
];
const dividerShapes = [
  { value: 'none' as const, label: 'Ninguno' },
  { value: 'wave' as const, label: 'Ola' },
  { value: 'curve' as const, label: 'Curva' },
  { value: 'slant' as const, label: 'Diagonal' },
  { value: 'zigzag' as const, label: 'Zigzag' },
  { value: 'triangle' as const, label: 'Pico' },
];

/**
 * Estilo común a todas las secciones, por categorías para no mostrar todo a
 * la vez. El fondo sobrescribe al de la página y al global.
 */
export function StyleEditor({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  const [category, setCategory] = useState<Category>('background');
  const style = section.style;
  const set = (patch: Partial<SectionStyle>) => onChange({ ...section, style: { ...style, ...patch } } as Section);

  return (
    <>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', pt: 1.5 }} role="tablist" aria-label="Categorías de estilo">
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} size="small" role="tab" aria-selected={category === c.id} color={category === c.id ? 'primary' : 'default'} variant={category === c.id ? 'filled' : 'outlined'} onClick={() => setCategory(c.id)} />
        ))}
      </Stack>

      {category === 'background' && (
        <Group title="Fondo" description="Heredado = usa el fondo de la página (o el global del sitio).">
          <BackgroundEditor value={style.background} onChange={(background) => set({ background })} allowVideo />
          <Segmented label="Color del texto" value={style.textColor} onChange={(textColor) => set({ textColor })} options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} />
        </Group>
      )}

      {category === 'layout' && (
        <Group title="Diseño">
          <SelectInput
            label="Ancho del contenido"
            value={style.width}
            onChange={(width) => set({ width })}
            options={[
              { value: 'narrow', label: 'Angosto (lectura)' },
              { value: 'contained', label: 'Normal' },
              { value: 'wide', label: 'Amplio' },
              { value: 'full', label: 'Ancho completo' },
            ]}
          />
          <SelectInput
            label="Altura mínima"
            value={style.minHeight}
            onChange={(minHeight) => set({ minHeight })}
            options={[
              { value: 'auto', label: 'Automática (según el contenido)' },
              { value: 'sm', label: 'Chica' },
              { value: 'md', label: 'Media' },
              { value: 'lg', label: 'Grande' },
              { value: 'screen', label: 'Pantalla completa' },
            ]}
          />
          {style.minHeight !== 'auto' && (
            <Segmented label="Contenido" value={style.verticalAlign} onChange={(verticalAlign) => set({ verticalAlign })} options={[{ value: 'top', label: 'Arriba' }, { value: 'center', label: 'Centro' }, { value: 'bottom', label: 'Abajo' }]} />
          )}
          <Segmented label="Alineación" value={style.textAlign} onChange={(textAlign) => set({ textAlign })} options={[{ value: 'inherit', label: 'Auto' }, { value: 'left', label: 'Izq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Der.' }]} />
        </Group>
      )}

      {category === 'spacing' && (
        <Group title="Espaciado">
          <Segmented label="Relleno arriba" value={style.paddingTop} onChange={(paddingTop) => set({ paddingTop })} options={padding} />
          <Segmented label="Relleno abajo" value={style.paddingBottom} onChange={(paddingBottom) => set({ paddingBottom })} options={padding} />
          <Segmented label="Separación superior" value={style.marginTop} onChange={(marginTop) => set({ marginTop, overlap: 'none' })} options={[{ value: 'none', label: '0' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
          <Box>
            <Segmented label="Superponer a la anterior" value={style.overlap} onChange={(overlap) => set({ overlap, marginTop: 'none' })} options={[{ value: 'none', label: 'No' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
            <Typography variant="caption" color="text.secondary">Sube la sección sobre la anterior (ideal como caja sobre un hero).</Typography>
          </Box>
        </Group>
      )}

      {category === 'appearance' && (
        <>
          <Group title="Caja y bordes">
            <SwitchRow label="Mostrar como caja" description="La sección queda dentro del ancho del sitio, con esquinas redondeadas." checked={style.boxed} onChange={(boxed) => set({ boxed, border: { ...style.border, radius: boxed && style.border.radius === 0 ? 16 : style.border.radius } })} />
            <SliderInput label="Radio de las esquinas" value={style.border.radius} min={0} max={48} format={(v) => `${v}px`} onChange={(radius) => set({ border: { ...style.border, radius } })} />
            <SliderInput label="Grosor del borde" value={style.border.width} min={0} max={8} format={(v) => (v ? `${v}px` : 'Sin borde')} onChange={(width) => set({ border: { ...style.border, width } })} />
            {style.border.width > 0 && <ColorInput label="Color del borde" value={style.border.color || '#E5E5E5'} onChange={(color) => set({ border: { ...style.border, color } })} />}
            <Segmented label="Sombra" value={style.shadow} onChange={(shadow) => set({ shadow })} options={[{ value: 'none', label: 'No' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Media' }, { value: 'strong', label: 'Fuerte' }]} />
          </Group>
          <Group title="Divisores decorativos" description="Formas en el borde superior o inferior (el color por defecto es el fondo de la página).">
            {(['dividerTop', 'dividerBottom'] as const).map((key) => (
              <Stack key={key} spacing={1.25}>
                <SelectInput label={key === 'dividerTop' ? 'Arriba' : 'Abajo'} value={style[key].shape} onChange={(shape) => set({ [key]: { ...style[key], shape } })} options={dividerShapes} />
                {style[key].shape !== 'none' && (
                  <>
                    <Segmented label="Altura" value={style[key].height} onChange={(height) => set({ [key]: { ...style[key], height } })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
                    <ColorInput label="Color" value={style[key].color || '#FFFFFF'} onChange={(color) => set({ [key]: { ...style[key], color } })} />
                    <SwitchRow label="Invertir" checked={style[key].flip} onChange={(flip) => set({ [key]: { ...style[key], flip } })} />
                  </>
                )}
              </Stack>
            ))}
          </Group>
        </>
      )}

      {category === 'mobile' && (
        <Group title="Sólo en celulares" description="Ajustes que se aplican en pantallas chicas. Igual = como en escritorio.">
          <Segmented label="Espacio arriba" value={style.mobile.paddingTop} onChange={(paddingTop) => set({ mobile: { ...style.mobile, paddingTop } })} options={mobilePadding} />
          <Segmented label="Espacio abajo" value={style.mobile.paddingBottom} onChange={(paddingBottom) => set({ mobile: { ...style.mobile, paddingBottom } })} options={mobilePadding} />
          <Segmented label="Alineación del texto" value={style.mobile.textAlign} onChange={(textAlign) => set({ mobile: { ...style.mobile, textAlign } })} options={[{ value: 'inherit', label: 'Igual' }, { value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
          <SwitchRow label="Ocultar en celulares" checked={style.hideOnMobile} onChange={(hideOnMobile) => set({ hideOnMobile })} />
          <Typography variant="caption" color="text.secondary">Las columnas por dispositivo de productos, galerías y la sección Columnas se ajustan en la pestaña Contenido. Los tamaños de texto en celular, en Diseño › Tipografía.</Typography>
        </Group>
      )}

      {category === 'advanced' && (
        <Group title="Visibilidad y anclas">
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
        </Group>
      )}
    </>
  );
}
