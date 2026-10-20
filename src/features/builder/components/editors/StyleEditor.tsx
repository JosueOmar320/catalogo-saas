'use client';

import { Box, Chip, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import type { Section, SectionStyle } from '@/lib/site/section-schemas';
import { BackgroundEditor, ColorInput, Group, Segmented, SelectInput, SliderInput, SwitchRow, TextInput } from '../controls';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';

type Category = 'background' | 'layout' | 'spacing' | 'appearance' | 'tablet' | 'mobile' | 'advanced';
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'background', label: msg('Fondo') },
  { id: 'layout', label: msg('Diseño') },
  { id: 'spacing', label: msg('Espaciado') },
  { id: 'appearance', label: msg('Apariencia') },
  { id: 'tablet', label: msg('Tablet') },
  { id: 'mobile', label: msg('Celular') },
  { id: 'advanced', label: msg('Avanzado') },
];

const mobilePadding = [
  { value: 'inherit' as const, label: msg('Igual') },
  { value: 'none' as const, label: '0' },
  { value: 'sm' as const, label: 'S' },
  { value: 'md' as const, label: 'M' },
  { value: 'lg' as const, label: 'L' },
];

const padding = [
  { value: 'default' as const, label: msg('Auto') },
  { value: 'none' as const, label: '0' },
  { value: 'sm' as const, label: 'S' },
  { value: 'md' as const, label: 'M' },
  { value: 'lg' as const, label: 'L' },
  { value: 'xl' as const, label: 'XL' },
  { value: 'custom' as const, label: 'px', title: msg('Medida exacta en píxeles') },
];
const animations = [
  { value: 'none' as const, label: msg('Ninguna') },
  { value: 'fade' as const, label: msg('Aparecer') },
  { value: 'up' as const, label: msg('Subir') },
  { value: 'zoom' as const, label: msg('Acercar') },
  { value: 'left' as const, label: msg('Desde la izquierda') },
  { value: 'right' as const, label: msg('Desde la derecha') },
];
const dividerShapes = [
  { value: 'none' as const, label: msg('Ninguno') },
  { value: 'wave' as const, label: msg('Ola') },
  { value: 'curve' as const, label: msg('Curva') },
  { value: 'slant' as const, label: msg('Diagonal') },
  { value: 'zigzag' as const, label: msg('Zigzag') },
  { value: 'triangle' as const, label: msg('Pico') },
];

/**
 * Estilo común a todas las secciones, por categorías para no mostrar todo a
 * la vez. El fondo sobrescribe al de la página y al global.
 */
export function StyleEditor({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  const t = useT();
  // Las opciones constantes se traducen al mostrarlas.
  const tr = <V,>(options: { value: V; label: string; title?: string }[]) => options.map((o) => ({ ...o, label: t(o.label), title: o.title && t(o.title) }));
  const [category, setCategory] = useState<Category>('background');
  const style = section.style;
  const set = (patch: Partial<SectionStyle>) => onChange({ ...section, style: { ...style, ...patch } } as Section);

  return (
    <>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', pt: 1.5 }} role="tablist" aria-label={t('Categorías de estilo')}>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={t(c.label)} size="small" role="tab" aria-selected={category === c.id} color={category === c.id ? 'primary' : 'default'} variant={category === c.id ? 'filled' : 'outlined'} onClick={() => setCategory(c.id)} />
        ))}
      </Stack>

      {category === 'background' && (
        <Group title={t('Fondo')} description={t('Heredado = usa el fondo de la página (o el global del sitio).')}>
          <BackgroundEditor value={style.background} onChange={(background) => set({ background })} allowVideo />
          <Segmented label={t('Color del texto')} value={style.textColor} onChange={(textColor) => set({ textColor })} options={[{ value: 'auto', label: t('Auto') }, { value: 'light', label: t('Claro') }, { value: 'dark', label: t('Oscuro') }]} />
        </Group>
      )}

      {category === 'layout' && (
        <Group title={t('Diseño')}>
          <SelectInput
            label={t('Ancho del contenido')}
            value={style.width}
            onChange={(width) => set({ width })}
            options={[
              { value: 'narrow', label: t('Angosto (lectura)') },
              { value: 'contained', label: t('Normal') },
              { value: 'wide', label: t('Amplio') },
              { value: 'full', label: t('Ancho completo') },
            ]}
          />
          <SelectInput
            label={t('Altura mínima')}
            value={style.minHeight}
            onChange={(minHeight) => set({ minHeight })}
            options={[
              { value: 'auto', label: t('Automática (según el contenido)') },
              { value: 'sm', label: t('Chica') },
              { value: 'md', label: t('Media') },
              { value: 'lg', label: t('Grande') },
              { value: 'screen', label: t('Pantalla completa') },
            ]}
          />
          {style.minHeight !== 'auto' && (
            <Segmented label={t('Contenido')} value={style.verticalAlign} onChange={(verticalAlign) => set({ verticalAlign })} options={[{ value: 'top', label: t('Arriba') }, { value: 'center', label: t('Centro') }, { value: 'bottom', label: t('Abajo') }]} />
          )}
          <Segmented label={t('Alineación')} value={style.textAlign} onChange={(textAlign) => set({ textAlign })} options={[{ value: 'inherit', label: t('Auto') }, { value: 'left', label: t('Izq.') }, { value: 'center', label: t('Centro') }, { value: 'right', label: t('Der.') }]} />
        </Group>
      )}

      {category === 'spacing' && (
        <Group title={t('Espaciado')}>
          <Segmented label={t('Relleno arriba')} value={style.paddingTop} onChange={(paddingTop) => set({ paddingTop })} options={tr(padding)} />
          {style.paddingTop === 'custom' && <SliderInput label={t('Relleno arriba (px)')} value={style.paddingTopPx} min={0} max={400} step={4} format={(v) => `${v}px`} onChange={(paddingTopPx) => set({ paddingTopPx })} />}
          <Segmented label={t('Relleno abajo')} value={style.paddingBottom} onChange={(paddingBottom) => set({ paddingBottom })} options={tr(padding)} />
          {style.paddingBottom === 'custom' && <SliderInput label={t('Relleno abajo (px)')} value={style.paddingBottomPx} min={0} max={400} step={4} format={(v) => `${v}px`} onChange={(paddingBottomPx) => set({ paddingBottomPx })} />}
          <Segmented label={t('Separación superior')} value={style.marginTop} onChange={(marginTop) => set({ marginTop, overlap: 'none' })} options={[{ value: 'none', label: '0' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
          <Box>
            <Segmented label={t('Superponer a la anterior')} value={style.overlap} onChange={(overlap) => set({ overlap, marginTop: 'none' })} options={[{ value: 'none', label: t('No') }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
            <Typography variant="caption" color="text.secondary">{t('Sube la sección sobre la anterior (ideal como caja sobre un hero).')}</Typography>
          </Box>
        </Group>
      )}

      {category === 'appearance' && (
        <>
          <Group title={t('Caja y bordes')}>
            <SwitchRow label={t('Mostrar como caja')} description={t('La sección queda dentro del ancho del sitio, con esquinas redondeadas.')} checked={style.boxed} onChange={(boxed) => set({ boxed, border: { ...style.border, radius: boxed && style.border.radius === 0 ? 16 : style.border.radius } })} />
            <SliderInput label={t('Radio de las esquinas')} value={style.border.radius} min={0} max={48} format={(v) => `${v}px`} onChange={(radius) => set({ border: { ...style.border, radius } })} />
            <SliderInput label={t('Grosor del borde')} value={style.border.width} min={0} max={8} format={(v) => (v ? `${v}px` : t('Sin borde'))} onChange={(width) => set({ border: { ...style.border, width } })} />
            {style.border.width > 0 && <ColorInput label={t('Color del borde')} value={style.border.color || '#E5E5E5'} onChange={(color) => set({ border: { ...style.border, color } })} />}
            <Segmented label={t('Sombra')} value={style.shadow} onChange={(shadow) => set({ shadow })} options={[{ value: 'none', label: t('No') }, { value: 'soft', label: t('Suave') }, { value: 'medium', label: t('Media') }, { value: 'strong', label: t('Fuerte') }]} />
          </Group>
          <Group title={t('Animación de entrada')} description={t('Se anima al aparecer mientras el visitante baja. No se anima si su dispositivo pide reducir el movimiento.')}>
            <SelectInput label={t('Efecto')} value={style.animation} onChange={(animation) => set({ animation })} options={tr(animations)} />
          </Group>
          <Group title={t('Divisores decorativos')} description={t('Formas en el borde superior o inferior (el color por defecto es el fondo de la página).')}>
            {(['dividerTop', 'dividerBottom'] as const).map((key) => (
              <Stack key={key} spacing={1.25}>
                <SelectInput label={key === 'dividerTop' ? t('Arriba') : t('Abajo')} value={style[key].shape} onChange={(shape) => set({ [key]: { ...style[key], shape } })} options={tr(dividerShapes)} />
                {style[key].shape !== 'none' && (
                  <>
                    <Segmented label={t('Altura')} value={style[key].height} onChange={(height) => set({ [key]: { ...style[key], height } })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
                    <ColorInput label={t('Color')} value={style[key].color || '#FFFFFF'} onChange={(color) => set({ [key]: { ...style[key], color } })} />
                    <SwitchRow label={t('Invertir')} checked={style[key].flip} onChange={(flip) => set({ [key]: { ...style[key], flip } })} />
                  </>
                )}
              </Stack>
            ))}
          </Group>
        </>
      )}

      {category === 'tablet' && (
        <Group title={t('Sólo en tablets')} description={t('Ajustes para pantallas medianas. Igual = como en escritorio. Los celulares usan estos valores salvo que los cambies en Celular.')}>
          <Segmented label={t('Espacio arriba')} value={style.tablet.paddingTop} onChange={(paddingTop) => set({ tablet: { ...style.tablet, paddingTop } })} options={tr(mobilePadding)} />
          <Segmented label={t('Espacio abajo')} value={style.tablet.paddingBottom} onChange={(paddingBottom) => set({ tablet: { ...style.tablet, paddingBottom } })} options={tr(mobilePadding)} />
          <Segmented label={t('Alineación del texto')} value={style.tablet.textAlign} onChange={(textAlign) => set({ tablet: { ...style.tablet, textAlign } })} options={[{ value: 'inherit', label: t('Igual') }, { value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
          <SwitchRow label={t('Ocultar en tablets')} checked={style.hideOnTablet} onChange={(hideOnTablet) => set({ hideOnTablet })} />
        </Group>
      )}

      {category === 'mobile' && (
        <Group title={t('Sólo en celulares')} description={t('Ajustes que se aplican en pantallas chicas. Igual = como en tablet (o en escritorio).')}>
          <Segmented label={t('Espacio arriba')} value={style.mobile.paddingTop} onChange={(paddingTop) => set({ mobile: { ...style.mobile, paddingTop } })} options={tr(mobilePadding)} />
          <Segmented label={t('Espacio abajo')} value={style.mobile.paddingBottom} onChange={(paddingBottom) => set({ mobile: { ...style.mobile, paddingBottom } })} options={tr(mobilePadding)} />
          <Segmented label={t('Alineación del texto')} value={style.mobile.textAlign} onChange={(textAlign) => set({ mobile: { ...style.mobile, textAlign } })} options={[{ value: 'inherit', label: t('Igual') }, { value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
          <SwitchRow label={t('Ocultar en celulares')} checked={style.hideOnMobile} onChange={(hideOnMobile) => set({ hideOnMobile })} />
          <Typography variant="caption" color="text.secondary">{t('Las columnas por dispositivo de productos, galerías y la sección Columnas se ajustan en la pestaña Contenido. Los tamaños de texto en celular, en Diseño › Tipografía.')}</Typography>
        </Group>
      )}

      {category === 'advanced' && (
        <Group title={t('Visibilidad y anclas')}>
          <SwitchRow label={t('Ocultar en celulares')} checked={style.hideOnMobile} onChange={(hideOnMobile) => set({ hideOnMobile })} />
          <SwitchRow label={t('Ocultar en tablets')} checked={style.hideOnTablet} onChange={(hideOnTablet) => set({ hideOnTablet })} />
          <SwitchRow label={t('Ocultar en escritorio')} checked={style.hideOnDesktop} onChange={(hideOnDesktop) => set({ hideOnDesktop })} />
          <TextInput
            label={t('Ancla (id)')}
            value={style.anchor}
            placeholder={t('ej. promociones')}
            helper={t('Permite enlazar a esta sección con #ancla.')}
            onChange={(anchor) => set({ anchor: anchor.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            maxLength={40}
          />
        </Group>
      )}
    </>
  );
}
