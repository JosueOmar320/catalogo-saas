'use client';

import { Autocomplete, Avatar, Box, ButtonBase, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { COLLECTION_LABELS, COLLECTION_SOURCES, resolveCollection, SORT_LABELS, SORT_OPTIONS, type Collection } from '@/lib/catalog/collections';
import { layoutUses, PRODUCT_LAYOUT_META, PRODUCT_LAYOUTS, type Presentation, type ProductLayout } from '@/lib/catalog/presentation';
import { CARD_STYLE_META, CARD_STYLES } from '@/lib/design/styles-registry';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Advanced, ColumnsEditor, Group, Segmented, SelectInput, SliderInput, SwitchRow } from '../controls';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';

const cardStyleOptions = [{ value: 'inherit' as const, label: msg('Como el tema') }, ...CARD_STYLES.map((id) => ({ value: id, label: CARD_STYLE_META[id].label }))];

/* Miniaturas esquemáticas de cada layout (48×36). */
const B = ({ x, y, w, h, r = 1.5, o = 1 }: { x: number; y: number; w: number; h: number; r?: number; o?: number }) => <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" opacity={o} />;
const LINES = (x: number, y: number, w: number) => (
  <>
    <B x={x} y={y} w={w} h={2} o={0.55} r={1} />
    <B x={x} y={y + 4} w={w * 0.7} h={2} o={0.3} r={1} />
  </>
);
const THUMBS: Record<ProductLayout, ReactNode> = {
  grid: [0, 1, 2].flatMap((c) => [0, 1].map((r) => <B key={`${c}${r}`} x={2 + c * 15.5} y={2 + r * 17} w={13} h={15} o={0.35} />)),
  largeCards: [0, 1].map((c) => <B key={c} x={2 + c * 23} y={2} w={21} h={32} o={0.35} />),
  compactList: [0, 1, 2, 3].map((r) => (
    <g key={r}>
      <B x={2} y={2 + r * 8.5} w={6} h={6} o={0.4} />
      {LINES(11, 3 + r * 8.5, 30)}
    </g>
  )),
  editorial: (
    <>
      <B x={2} y={2} w={26} h={32} o={0.4} />
      <B x={31} y={2} w={15} h={15} o={0.3} />
      <B x={31} y={19} w={15} h={15} o={0.3} />
    </>
  ),
  imageFocus: [0, 1, 2].map((c) => (
    <g key={c}>
      <B x={2 + c * 15.5} y={2} w={13} h={32} o={0.45} />
      <B x={4 + c * 15.5} y={26} w={9} h={2} o={0.9} r={1} />
    </g>
  )),
  priceList: [0, 1, 2, 3].map((r) => (
    <g key={r}>
      <B x={2} y={4 + r * 8} w={14} h={2.5} o={0.6} r={1} />
      <line x1={18} x2={38} y1={6 + r * 8} y2={6 + r * 8} stroke="currentColor" strokeDasharray="1 2" opacity={0.5} />
      <B x={40} y={4 + r * 8} w={6} h={2.5} o={0.6} r={1} />
    </g>
  )),
  zigzag: (
    <>
      <B x={2} y={2} w={18} h={14} o={0.4} r={4} />
      {LINES(24, 6, 20)}
      <B x={28} y={20} w={18} h={14} o={0.4} r={4} />
      {LINES(4, 24, 20)}
    </>
  ),
  detail: (
    <>
      <B x={2} y={2} w={22} h={24} o={0.4} />
      {[0, 1, 2].map((i) => <B key={i} x={2 + i * 8} y={28} w={6} h={6} o={0.25} />)}
      {LINES(27, 4, 19)}
      {[0, 1, 2].map((i) => <B key={i} x={27} y={15 + i * 5} w={19} h={1} o={0.3} r={0.5} />)}
    </>
  ),
  magazine: (
    <>
      <B x={2} y={2} w={20} h={15} o={0.45} />
      {LINES(25, 5, 20)}
      {[0, 1, 2].map((c) => <B key={c} x={2 + c * 15.5} y={20} w={13} h={14} o={0.3} />)}
    </>
  ),
  compactGrid: [0, 1, 2, 3].flatMap((c) => [0, 1, 2].map((r) => <B key={`${c}${r}`} x={2 + c * 11.5} y={2 + r * 11.3} w={9.5} h={9.5} o={0.35} r={1} />)),
  minimal: [0, 1, 2].map((c) => (
    <g key={c}>
      <B x={2 + c * 15.5} y={3} w={13} h={20} o={0.35} />
      <B x={3 + c * 15.5} y={26} w={11} h={2} o={0.6} r={1} />
      <B x={5 + c * 15.5} y={30} w={7} h={2} o={0.35} r={1} />
    </g>
  )),
  serviceCards: [0, 1, 2].map((c) => (
    <g key={c}>
      <B x={2 + c * 15.5} y={2} w={13} h={32} o={0.18} />
      <B x={4 + c * 15.5} y={4.5} w={5} h={5} o={0.5} r={1} />
      <B x={4 + c * 15.5} y={12} w={9} h={2} o={0.6} r={1} />
      {[0, 1, 2].map((r) => <B key={r} x={4 + c * 15.5} y={17 + r * 3.5} w={8} h={1.5} o={0.35} r={0.75} />)}
      <B x={4 + c * 15.5} y={29} w={9} h={3} o={0.55} r={1} />
    </g>
  )),
  comparison: (
    <>
      <B x={2} y={3} w={44} h={5} o={0.25} r={1} />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <B x={3} y={11 + r * 8} w={5} h={5} o={0.4} r={1} />
          {[0, 1, 2].map((col) => <B key={col} x={12 + col * 12} y={12.5 + r * 8} w={9} h={2} o={0.45} r={1} />)}
        </g>
      ))}
    </>
  ),
};

export function LayoutPicker({ value, onChange, layouts = PRODUCT_LAYOUTS }: { value: ProductLayout; onChange: (layout: ProductLayout) => void; layouts?: readonly ProductLayout[] }) {
  const t = useT();
  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }} role="radiogroup" aria-label={t('Presentación')}>
        {layouts.map((id) => {
          const selected = id === value;
          return (
            <ButtonBase
              key={id}
              role="radio"
              aria-checked={selected}
              title={t(PRODUCT_LAYOUT_META[id].description)}
              onClick={() => onChange(id)}
              sx={{ flexDirection: 'column', gap: 0.5, p: 0.75, borderRadius: 1.5, border: 1, borderColor: selected ? 'primary.main' : 'divider', color: selected ? 'primary.main' : 'text.secondary', boxShadow: selected ? (th) => `0 0 0 1px ${th.palette.primary.main}` : 'none' }}
            >
              <svg viewBox="0 0 48 36" width="100%" style={{ maxWidth: 64 }} aria-hidden>
                {THUMBS[id]}
              </svg>
              <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.2, textAlign: 'center', color: selected ? 'primary.main' : 'text.primary' }}>
                {t(PRODUCT_LAYOUT_META[id].label)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
        {t(PRODUCT_LAYOUT_META[value].description)}
      </Typography>
    </Box>
  );
}

/** Estilos rápidos: varias opciones de una vez (luego se ajusta lo que se quiera). */
const PRESETS: { id: string; label: string; patch: (p: Presentation) => Partial<Presentation> }[] = [
  { id: 'shop', label: msg('Tienda'), patch: (p) => ({ layout: 'grid', arrangement: 'grid', columns: { ...p.columns, desktop: 4, tablet: 3, mobile: 2 }, ratio: 'square', align: 'left', fields: { ...p.fields, image: true, price: true, button: true } }) },
  { id: 'boutique', label: msg('Boutique'), patch: (p) => ({ layout: 'minimal', columns: { ...p.columns, desktop: 3, tablet: 3, mobile: 2 }, ratio: 'portrait', shape: 'rect', align: 'center', gap: 'loose' }) },
  { id: 'menu', label: msg('Menú'), patch: (p) => ({ layout: 'priceList', columns: { ...p.columns, desktop: 2 }, imageSize: 'sm', separators: true, fields: { ...p.fields, description: true } }) },
  { id: 'services', label: msg('Servicios'), patch: (p) => ({ layout: 'serviceCards', columns: { ...p.columns, desktop: 3, tablet: 2, mobile: 1 }, imageSize: 'md', shape: 'rounded', align: 'left', fields: { ...p.fields, attributes: 'all', price: true, button: true } }) },
  { id: 'showcase', label: msg('Vitrina'), patch: (p) => ({ layout: 'magazine', columns: { ...p.columns, desktop: 3 }, ratio: 'landscape' }) },
  { id: 'carousel', label: msg('Carrusel'), patch: (p) => ({ layout: 'grid', arrangement: 'carousel', columns: { ...p.columns, desktop: 4, tablet: 3, mobile: 2 } }) },
];

function QuickStyles({ value, onChange }: { value: Presentation; onChange: (value: Presentation) => void }) {
  const t = useT();
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>{t('Estilos rápidos')}</Typography>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} role="group" aria-label={t('Estilos rápidos')}>
        {PRESETS.map((preset) => (
          <Chip key={preset.id} size="small" variant="outlined" label={t(preset.label)} onClick={() => onChange({ ...value, ...preset.patch(value) })} />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Editor de presentación: sólo muestra las opciones que el layout usa
 * (LAYOUT_OPTIONS). `target` decide si se editan columnas web o de PDF.
 */
export function PresentationEditor({ value, onChange, target = 'web' }: { value: Presentation; onChange: (value: Presentation) => void; target?: 'web' | 'pdf' }) {
  const t = useT();
  const p = value;
  const set = (patch: Partial<Presentation>) => onChange({ ...p, ...patch });
  const setFields = (patch: Partial<Presentation['fields']>) => set({ fields: { ...p.fields, ...patch } });
  const uses = (o: Parameters<typeof layoutUses>[1]) => layoutUses(p.layout, o);
  const pdf = target === 'pdf';

  return (
    <>
      <Group title={t('Presentación')}>
        {!pdf && <QuickStyles value={p} onChange={onChange} />}
        <LayoutPicker value={p.layout} onChange={(layout) => set({ layout })} />
        {!pdf && p.layout === 'grid' && <Segmented label={t('Disposición')} value={p.arrangement} onChange={(arrangement) => set({ arrangement })} options={[{ value: 'grid', label: t('Cuadrícula') }, { value: 'carousel', label: t('Carrusel') }]} />}
        {uses('columns') &&
          (pdf ? (
            <SliderInput label={t('Columnas en el PDF')} value={p.columns.pdf} min={1} max={p.layout === 'priceList' ? 2 : 5} onChange={(n) => set({ columns: { ...p.columns, pdf: n } })} />
          ) : p.layout === 'priceList' ? (
            <Segmented label={t('Columnas')} value={Math.min(p.columns.desktop, 2)} onChange={(n) => set({ columns: { ...p.columns, desktop: n } })} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
          ) : (
            <ColumnsEditor value={p.columns} onChange={(columns) => set({ columns: { ...p.columns, ...columns } })} maxDesktop={p.layout === 'largeCards' ? 3 : 6} />
          ))}
        {uses('imageSize') && <Segmented label={t('Tamaño de imagen')} value={p.imageSize} onChange={(imageSize) => set({ imageSize })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />}
        {uses('imagePosition') && (
          <Segmented
            label={t('Imagen')}
            value={p.imagePosition}
            onChange={(imagePosition) => set({ imagePosition })}
            options={[{ value: 'left', label: t('Izq.') }, { value: 'right', label: t('Der.') }, ...(p.layout === 'zigzag' ? [{ value: 'alternate' as const, label: t('Alternar') }] : [])]}
          />
        )}
        {!pdf && uses('cardStyle') && <SelectInput label={t('Estilo de tarjeta')} value={p.cardStyle} onChange={(cardStyle) => set({ cardStyle })} options={cardStyleOptions.map((o) => ({ ...o, label: t(o.label) }))} />}
      </Group>

      <Group title={t('Qué mostrar de cada ítem')}>
        <SwitchRow label={t('Imagen')} checked={p.fields.image} onChange={(image) => setFields({ image })} />
        <SwitchRow label={t('Descripción')} checked={p.fields.description} onChange={(description) => setFields({ description })} />
        <SwitchRow label={t('Precio')} checked={p.fields.price} onChange={(price) => setFields({ price })} />
        {p.fields.price && <SwitchRow label={t('Precio anterior tachado')} checked={p.fields.compareAt} onChange={(compareAt) => setFields({ compareAt })} />}
        {p.fields.price && <SwitchRow label={t('Porcentaje de descuento')} description={t('Se calcula con el precio anterior.')} checked={p.fields.discount} onChange={(discount) => setFields({ discount })} />}
        <SwitchRow label={t('Aviso «No disponible»')} checked={p.fields.availability} onChange={(availability) => setFields({ availability })} />
        <SwitchRow label={t('Código / SKU')} checked={p.fields.sku} onChange={(sku) => setFields({ sku })} />
        <SwitchRow label={t('Categoría')} checked={p.fields.category} onChange={(category) => setFields({ category })} />
        <SwitchRow label={t('Etiquetas (Nuevo, Oferta…)')} checked={p.fields.badges} onChange={(badges) => setFields({ badges })} />
        {!pdf && <SwitchRow label={t('Botón de contacto')} checked={p.fields.button} onChange={(button) => setFields({ button })} />}
        <SelectInput
          label={t('Atributos')}
          value={p.fields.attributes}
          onChange={(attributes) => setFields({ attributes })}
          options={[
            { value: 'none', label: t('No mostrar') },
            { value: 'card', label: t('Los marcados "en tarjeta"') },
            { value: 'all', label: t('Todos los de la ficha') },
          ]}
          helper={t('Se definen en Catálogo › Atributos.')}
        />
      </Group>

      <Advanced title={t('Imagen y espaciado')}>
        <Stack spacing={1.75}>
          {uses('shape') && (
            <Segmented label={t('Forma')} value={p.shape} onChange={(shape) => set({ shape })} options={[{ value: 'rect', label: t('Recta') }, { value: 'rounded', label: t('Redond.') }, { value: 'circle', label: t('Círculo') }, { value: 'arch', label: t('Arco') }]} />
          )}
          {uses('shape') && <SwitchRow label={t('Marco decorativo')} checked={p.frame} onChange={(frame) => set({ frame })} />}
          {uses('ratio') && p.shape !== 'circle' && p.shape !== 'arch' && (
            <Segmented label={t('Proporción')} value={p.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: 'square', label: '1:1' }, { value: 'portrait', label: '3:4' }, { value: 'landscape', label: '4:3' }, { value: 'wide', label: '16:9' }]} />
          )}
          {uses('gap') && <Segmented label={t('Separación')} value={p.gap} onChange={(gap) => set({ gap })} options={[{ value: 'tight', label: t('Chica') }, { value: 'normal', label: t('Normal') }, { value: 'loose', label: t('Amplia') }]} />}
          {uses('separators') && <SwitchRow label={t('Líneas separadoras')} checked={p.separators} onChange={(separators) => set({ separators })} />}
          {uses('align') && <Segmented label={t('Alineación')} value={p.align} onChange={(align) => set({ align })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />}
          {uses('gallery') && <SwitchRow label={t('Galería de fotos')} description={t('Miniaturas para cambiar de imagen.')} checked={p.gallery} onChange={(gallery) => set({ gallery })} />}
          {!pdf && uses('columns') && <SliderInput label={t('Columnas al exportar a PDF')} value={p.columns.pdf} min={1} max={5} onChange={(n) => set({ columns: { ...p.columns, pdf: n } })} />}
        </Stack>
      </Advanced>
    </>
  );
}

/** Fuente de ítems: colección dinámica (destacados, ofertas, marca = X…) o elegidos a mano. */
export function CollectionEditor({ value, onChange, site, title }: { value: Collection; onChange: (value: Collection) => void; site: SiteViewModel; title?: string }) {
  const t = useT();
  const c = value;
  const set = (patch: Partial<Collection>) => onChange({ ...c, ...patch });
  const pool = c.itemType === 'any' ? site.items : site.items.filter((i) => i.type === c.itemType);
  const attrDef = site.attributeDefs.find((d) => d.id === c.attributeId);
  const attrValues = attrDef ? (attrDef.options.length > 0 ? attrDef.options : [...new Set(site.items.flatMap((i) => { const v = i.attributes[attrDef.id]; return v === undefined ? [] : Array.isArray(v) ? v : [String(v)]; }))]) : [];
  const sources = COLLECTION_SOURCES.filter((s) => s !== 'attribute' || site.attributeDefs.length > 0);
  const shown = resolveCollection(c, site.items).length;

  return (
    <Group title={title ?? t('Qué mostrar')}>
      <Segmented label={t('Tipo')} value={c.itemType} onChange={(itemType) => set({ itemType })} options={[{ value: 'product', label: t('Productos') }, { value: 'service', label: t('Servicios') }, { value: 'any', label: t('Ambos') }]} />
      <SelectInput label={t('Colección')} value={c.source} onChange={(source) => set({ source })} options={sources.map((s) => ({ value: s, label: t(COLLECTION_LABELS[s]) }))} />
      {c.source === 'category' && (
        <SelectInput label={t('Categoría')} value={c.categoryId} onChange={(categoryId) => set({ categoryId })} options={[{ value: '', label: t('Elige una categoría') }, ...site.categories.map((cat) => ({ value: cat.id, label: cat.name }))]} />
      )}
      {c.source === 'attribute' && (
        <>
          <SelectInput label={t('Atributo')} value={c.attributeId} onChange={(attributeId) => set({ attributeId, attributeValue: '' })} options={[{ value: '', label: t('Elige un atributo') }, ...site.attributeDefs.map((d) => ({ value: d.id, label: d.name }))]} />
          {attrDef && (
            <SelectInput
              label={t('Valor')}
              value={c.attributeValue}
              onChange={(attributeValue) => set({ attributeValue })}
              options={[{ value: '', label: t('Cualquiera (con este atributo)') }, ...(attrDef.type === 'boolean' ? [msg('Sí'), msg('No')] : attrValues).map((v) => ({ value: v, label: attrDef.type === 'boolean' ? t(v) : v }))]}
            />
          )}
        </>
      )}
      {c.source === 'manual' && (
        <>
          <ItemSelect key={c.itemIds.length} label={t('Agregar un ítem')} items={pool.filter((i) => !c.itemIds.includes(i.id))} value="" onChange={(id) => id && set({ itemIds: [...c.itemIds, id] })} />
          <ChosenItems ids={c.itemIds} items={pool} onChange={(itemIds) => set({ itemIds })} />
        </>
      )}
      {c.source !== 'manual' && c.source !== 'latest' && <SelectInput label={t('Orden')} value={c.sort} onChange={(sort) => set({ sort })} options={SORT_OPTIONS.map((s) => ({ value: s, label: t(SORT_LABELS[s]) }))} />}
      {c.source !== 'manual' && <SliderInput label={t('Cantidad máxima')} value={c.limit} min={0} max={48} format={(v) => (v === 0 ? t('Sin límite') : String(v))} onChange={(limit) => set({ limit })} />}
      <Typography variant="caption" color={shown ? 'text.secondary' : 'warning.main'} role="status">
        {shown ? t('Se muestran {count} de {total}.', { count: shown, total: pool.length }) : t('Ningún ítem coincide todavía: en el sitio publicado la sección no aparece.')}
      </Typography>
    </Group>
  );
}

type ItemView = SiteViewModel['items'][number];

/** Un ítem con su foto (o su inicial), nombre y precio. */
function ItemOption({ item }: { item: ItemView }) {
  const t = useT();
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
      <Avatar variant="rounded" src={item.images[0]?.url} alt="" sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 15 }}>{[...item.name.trim()][0]}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap>{item.name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="p">{[item.type === 'service' ? t('Servicio') : t('Producto'), item.priceLabel].filter(Boolean).join(' · ')}</Typography>
      </Box>
    </Stack>
  );
}

/** Elegir un ítem del catálogo buscando por nombre, con foto y precio. `value` '' = ninguno. */
export function ItemSelect({ label, items, value, onChange, emptyLabel, helper }: { label: string; items: ItemView[]; value: string; onChange: (id: string) => void; emptyLabel?: string; helper?: string }) {
  const t = useT();
  const options = emptyLabel ? ['', ...items.map((i) => i.id)] : items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <Autocomplete
      options={options}
      value={value && byId.has(value) ? value : emptyLabel ? '' : null}
      onChange={(_, id) => onChange(id ?? '')}
      getOptionLabel={(id) => (id ? (byId.get(id)?.name ?? t('Ítem')) : (emptyLabel ?? ''))}
      renderOption={({ key, ...props }, id) => (
        <li key={key || 'auto'} {...props}>
          {id ? <ItemOption item={byId.get(id)!} /> : <Typography variant="body2">{emptyLabel}</Typography>}
        </li>
      )}
      noOptionsText={t('Sin resultados')}
      disableClearable={Boolean(emptyLabel)}
      renderInput={(params) => <TextField {...params} label={label} helperText={helper} />}
    />
  );
}

/** Los ítems elegidos a mano, en su orden: subir, bajar o quitar. */
function ChosenItems({ ids, items, onChange }: { ids: string[]; items: ItemView[]; onChange: (ids: string[]) => void }) {
  const t = useT();
  const chosen = ids.flatMap((id) => items.filter((i) => i.id === id));
  if (!chosen.length) return <Typography variant="caption" color="text.secondary">{t('Busca y agrega los ítems que quieres mostrar, en el orden que quieras.')}</Typography>;
  const move = (from: number, to: number) => {
    const next = chosen.map((i) => i.id);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  return (
    <Stack component="ol" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label={t('Ítems elegidos')}>
      {chosen.map((item, i) => (
        <Stack component="li" key={item.id} direction="row" spacing={0.5} sx={{ alignItems: 'center', p: 0.5, borderRadius: 1.5, border: 1, borderColor: 'divider' }}>
          <ItemOption item={item} />
          <IconButton size="small" aria-label={t('Subir {name}', { name: item.name })} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={16} /></IconButton>
          <IconButton size="small" aria-label={t('Bajar {name}', { name: item.name })} disabled={i === chosen.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={16} /></IconButton>
          <IconButton size="small" aria-label={t('Quitar {name}', { name: item.name })} onClick={() => onChange(chosen.filter((x) => x.id !== item.id).map((x) => x.id))}><X size={16} /></IconButton>
        </Stack>
      ))}
    </Stack>
  );
}
