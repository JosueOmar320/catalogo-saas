'use client';

import { Box, ButtonBase, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import type { SectionOf } from '@/lib/site/section-schemas';
import { Group, Segmented, SelectInput, SwitchRow } from '../controls';

type Browse = SectionOf<'catalog'>['content']['browse'];

/* Miniaturas de cada disposición (48×36). */
const R = ({ x, y, w, h, o = 0.35, r = 1.5 }: { x: number; y: number; w: number; h: number; o?: number; r?: number }) => <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" opacity={o} />;
const GRID = (x: number, y: number, cols: number, w: number) => [0, 1].flatMap((row) => Array.from({ length: cols }, (_, c) => <R key={`${row}${c}`} x={x + c * (w + 2)} y={y + row * 11} w={w} h={9} />));
const SKETCH: Record<Browse['layout'], ReactNode> = {
  bar: (
    <>
      <R x={2} y={2} w={44} h={6} o={0.55} />
      {GRID(2, 12, 4, 9.5)}
    </>
  ),
  sidebar: (
    <>
      <R x={2} y={2} w={12} h={32} o={0.5} />
      {GRID(17, 2, 3, 8.6)}
    </>
  ),
  drawer: (
    <>
      <R x={2} y={2} w={30} h={6} o={0.55} />
      <R x={36} y={2} w={10} h={6} o={0.8} />
      {GRID(2, 12, 4, 9.5)}
    </>
  ),
};

const LAYOUTS: { id: Browse['layout']; label: string; description: string }[] = [
  { id: 'bar', label: msg('Barra arriba'), description: msg('Buscador, categorías y filtros en una barra; los filtros se despliegan debajo.') },
  { id: 'sidebar', label: msg('Columna lateral'), description: msg('Categorías y filtros siempre a la vista a la izquierda, como una tienda en línea.') },
  { id: 'drawer', label: msg('Panel de filtros'), description: msg('Barra mínima; los filtros y el orden se abren en un panel. Deja más espacio a los productos.') },
];

/** Recetas: varias opciones de una vez. */
const RECIPES: { id: string; label: string; patch: Partial<Browse> }[] = [
  { id: 'store', label: msg('Tienda en línea'), patch: { layout: 'sidebar', categoryNav: 'chips', categoryMode: 'filter', counts: true, viewSwitch: true, sticky: true } },
  { id: 'menu', label: msg('Menú de restaurante'), patch: { layout: 'bar', categoryNav: 'tabs', categoryMode: 'jump', counts: false, viewSwitch: false, sticky: true } },
  { id: 'boutique', label: msg('Boutique'), patch: { layout: 'drawer', categoryNav: 'images', categoryMode: 'filter', counts: false, viewSwitch: false, sticky: false } },
  { id: 'simple', label: msg('Sencillo'), patch: { layout: 'bar', categoryNav: 'chips', categoryMode: 'filter', counts: false, viewSwitch: false, sticky: true } },
];

/** Cómo recorre el visitante el catálogo: disposición, categorías y extras. */
export function CatalogBrowseEditor({ value, onChange }: { value: Browse; onChange: (value: Browse) => void }) {
  const t = useT();
  const set = (patch: Partial<Browse>) => onChange({ ...value, ...patch });
  return (
    <Group title={t('Cómo se recorre')} description={t('Dónde van el buscador y los filtros y cómo se eligen las categorías.')}>
      <Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>{t('Recetas')}</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} role="group" aria-label={t('Recetas')}>
          {RECIPES.map((recipe) => (
            <Chip key={recipe.id} size="small" variant="outlined" label={t(recipe.label)} onClick={() => set(recipe.patch)} />
          ))}
        </Stack>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }} role="radiogroup" aria-label={t('Disposición')}>
        {LAYOUTS.map(({ id, label }) => {
          const selected = value.layout === id;
          return (
            <ButtonBase
              key={id}
              role="radio"
              aria-checked={selected}
              onClick={() => set({ layout: id })}
              sx={{ flexDirection: 'column', gap: 0.5, p: 0.75, borderRadius: 1.5, border: 1, borderColor: selected ? 'primary.main' : 'divider', color: selected ? 'primary.main' : 'text.secondary', boxShadow: selected ? (th) => `0 0 0 1px ${th.palette.primary.main}` : 'none' }}
            >
              <svg viewBox="0 0 48 36" width="100%" style={{ maxWidth: 64 }} aria-hidden>
                {SKETCH[id]}
              </svg>
              <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.2, textAlign: 'center', color: selected ? 'primary.main' : 'text.primary' }}>{t(label)}</Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary">{t(LAYOUTS.find((l) => l.id === value.layout)!.description)}</Typography>
      {value.layout !== 'sidebar' && (
        <SelectInput
          label={t('Categorías como')}
          value={value.categoryNav}
          onChange={(categoryNav) => set({ categoryNav })}
          options={[
            { value: 'chips', label: t('Píldoras') },
            { value: 'tabs', label: t('Pestañas') },
            { value: 'images', label: t('Fotos de cada categoría') },
            { value: 'select', label: t('Lista desplegable') },
          ]}
        />
      )}
      <Segmented label={t('Al elegir una categoría')} value={value.categoryMode} onChange={(categoryMode) => set({ categoryMode })} options={[{ value: 'filter', label: t('Muestra sólo esa') }, { value: 'jump', label: t('Lleva a ella') }]} />
      <Typography variant="caption" color="text.secondary">
        {value.categoryMode === 'jump' ? t('Todo el catálogo a la vista, agrupado por categoría; el menú lleva a cada grupo y marca el que se está viendo (como el menú de un restaurante).') : t('Al elegir una, se ven sólo sus ítems.')}
      </Typography>
      <SwitchRow label={t('Cuántos hay en cada categoría')} checked={value.counts} onChange={(counts) => set({ counts })} />
      <SwitchRow label={t('Barra fija al bajar')} description={t('El buscador y las categorías se quedan a la mano.')} checked={value.sticky} onChange={(sticky) => set({ sticky })} />
      <SwitchRow label={t('Cambiar entre cuadrícula y lista')} description={t('El visitante elige cómo ver los productos.')} checked={value.viewSwitch} onChange={(viewSwitch) => set({ viewSwitch })} />
    </Group>
  );
}
