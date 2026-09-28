'use client';

import { Autocomplete, Chip, Stack, TextField } from '@mui/material';
import type { ComponentType } from 'react';
import { CARD_STYLE_META, CARD_STYLES } from '@/lib/design/styles-registry';
import type { SitePage } from '@/lib/site/pages';
import type { SectionOf, SectionType } from '@/lib/site/section-schemas';
import type { SiteViewModel } from '@/lib/site/view-model';
import {
  Advanced,
  ButtonEditor,
  ColumnsEditor,
  Group,
  IconPicker,
  ListEditor,
  MediaInput,
  RichTextInput,
  Segmented,
  SelectInput,
  SliderInput,
  SwitchRow,
  TextInput,
} from '../controls';

export type EditorProps<T extends SectionType> = {
  section: SectionOf<T>;
  onChange: (section: SectionOf<T>) => void;
  pages: SitePage[];
  site: SiteViewModel;
};

/** Actualiza campos del contenido conservando el resto. */
function useContent<T extends SectionType>({ section, onChange }: EditorProps<T>) {
  const content = (section as { content: object }).content;
  return (patch: Partial<SectionOf<T>['content']>) => onChange({ ...section, content: { ...content, ...patch } } as SectionOf<T>);
}

function Heading<T extends 'hero' | 'text' | 'products' | 'services' | 'catalog' | 'categories' | 'banner' | 'gallery' | 'features' | 'testimonials' | 'contact' | 'social'>(
  props: EditorProps<T> & { subtitleLabel?: string; titlePlaceholder?: string },
) {
  const set = useContent(props);
  const c = (props.section as unknown as { content: { eyebrow: string; title: string; subtitle: string } }).content;
  return (
    <>
      <TextInput label="Título" value={c.title} placeholder={props.titlePlaceholder} onChange={(title) => set({ title } as never)} maxLength={160} />
      <TextInput label={props.subtitleLabel ?? 'Subtítulo'} value={c.subtitle} onChange={(subtitle) => set({ subtitle } as never)} multiline rows={2} maxLength={500} />
      <TextInput label="Antetítulo (opcional)" value={c.eyebrow} placeholder="Ej. NOVEDADES" onChange={(eyebrow) => set({ eyebrow } as never)} maxLength={80} />
    </>
  );
}

const cardStyleOptions = [{ value: 'inherit' as const, label: 'Como el tema' }, ...CARD_STYLES.map((id) => ({ value: id, label: CARD_STYLE_META[id].label }))];

/* ------------------------------------------------------------ Hero */

function HeroEditor(props: EditorProps<'hero'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} titlePlaceholder={`Vacío = ${props.site.business.name}`} subtitleLabel="Subtítulo (vacío = slogan del negocio)" />
      </Group>
      <Group title="Diseño">
        <Segmented label="Composición" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'centered', label: 'Centrado' }, { value: 'left', label: 'Izquierda' }, { value: 'split', label: 'Con imagen' }]} />
        <Segmented label="Altura" value={c.height} onChange={(height) => set({ height })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'screen', label: 'Pantalla' }]} />
        {c.layout === 'split' && <MediaInput label="Imagen lateral" value={c.image.path} onChange={(path) => set({ image: { path } })} />}
        <SwitchRow label="Mostrar logo" checked={c.showLogo} onChange={(showLogo) => set({ showLogo })} />
      </Group>
      <Group title="Botones">
        <ButtonEditor label="Botón principal" value={c.primaryButton} onChange={(primaryButton) => set({ primaryButton })} pages={props.pages} />
        <ButtonEditor label="Botón secundario" value={c.secondaryButton} onChange={(secondaryButton) => set({ secondaryButton })} pages={props.pages} />
      </Group>
      <Advanced title="Video de fondo">
        <TextInput label="URL de video (.mp4)" value={c.videoUrl} placeholder="https://…/video.mp4" helper="Se reproduce en silencio y en bucle detrás del texto. Usa el Estilo para oscurecerlo." onChange={(videoUrl) => set({ videoUrl })} />
      </Advanced>
    </>
  );
}

/* ------------------------------------------------------------ Texto */

function TextEditor(props: EditorProps<'text'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
        <RichTextInput label="Texto" value={c.body} onChange={(body) => set({ body })} />
      </Group>
      <Group title="Imagen">
        <Segmented label="Posición" value={c.imagePosition} onChange={(imagePosition) => set({ imagePosition })} options={[{ value: 'none', label: 'Sin' }, { value: 'left', label: 'Izq.' }, { value: 'right', label: 'Der.' }, { value: 'top', label: 'Arriba' }]} />
        {c.imagePosition !== 'none' && <MediaInput label="Imagen" value={c.image.path} onChange={(path) => set({ image: { path } })} />}
      </Group>
      <Group title="Diseño">
        <Segmented label="Alineación" value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
        <Segmented label="Ancho del texto" value={c.width} onChange={(width) => set({ width })} options={[{ value: 'narrow', label: 'Angosto' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Ancho' }]} />
        <ButtonEditor label="Botón" value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Productos / Servicios */

function ItemSourceFields(props: EditorProps<'products'> | EditorProps<'services'>) {
  const set = useContent(props as EditorProps<'products'>);
  const c = props.section.content;
  const pool = c.itemType === 'any' ? props.site.items : props.site.items.filter((i) => i.type === c.itemType);
  return (
    <Group title="Qué mostrar">
      <Segmented label="Tipo" value={c.itemType} onChange={(itemType) => set({ itemType })} options={[{ value: 'product', label: 'Productos' }, { value: 'service', label: 'Servicios' }, { value: 'any', label: 'Ambos' }]} />
      <SelectInput
        label="Selección"
        value={c.source}
        onChange={(source) => set({ source })}
        options={[
          { value: 'featured', label: 'Destacados' },
          { value: 'latest', label: 'Más recientes' },
          { value: 'category', label: 'De una categoría' },
          { value: 'manual', label: 'Elegidos a mano' },
          { value: 'all', label: 'Todos' },
        ]}
      />
      {c.source === 'category' && (
        <SelectInput label="Categoría" value={c.categoryId} onChange={(categoryId) => set({ categoryId })} options={[{ value: '', label: 'Elige una categoría' }, ...props.site.categories.map((cat) => ({ value: cat.id, label: cat.name }))]} />
      )}
      {c.source === 'manual' && (
        <Autocomplete
          multiple
          options={pool.map((i) => i.id)}
          value={c.itemIds.filter((id) => pool.some((i) => i.id === id))}
          getOptionLabel={(id) => pool.find((i) => i.id === id)?.name ?? 'Ítem'}
          onChange={(_, itemIds) => set({ itemIds })}
          renderValue={(value, getItemProps) =>
            value.map((id, index) => {
              const { key, ...rest } = getItemProps({ index });
              return <Chip key={key} label={pool.find((i) => i.id === id)?.name} {...rest} />;
            })
          }
          renderInput={(params) => <TextField {...params} label="Ítems (en este orden)" />}
        />
      )}
      {c.source !== 'manual' && <SliderInput label="Cantidad máxima" value={c.limit} min={1} max={48} onChange={(limit) => set({ limit })} />}
    </Group>
  );
}

function ProductsEditor(props: EditorProps<'products'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <ItemSourceFields {...props} />
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: 'Cuadrícula' }, { value: 'carousel', label: 'Carrusel' }, { value: 'list', label: 'Lista' }]} />
        {c.layout !== 'list' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />}
        <SelectInput label="Estilo de tarjeta" value={c.cardStyle} onChange={(cardStyle) => set({ cardStyle })} options={cardStyleOptions} />
        <SwitchRow label="Imagen" checked={c.showImage} onChange={(showImage) => set({ showImage })} />
        <SwitchRow label="Precio" checked={c.showPrice} onChange={(showPrice) => set({ showPrice })} />
        <SwitchRow label="Descripción" checked={c.showDescription} onChange={(showDescription) => set({ showDescription })} />
      </Group>
      <Group title="Botón al final">
        <ButtonEditor label="Botón (ej. Ver todos)" value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
    </>
  );
}

function ServicesEditor(props: EditorProps<'services'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <ItemSourceFields {...props} />
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'cards', label: 'Tarjetas' }, { value: 'rows', label: 'Filas' }, { value: 'compact', label: 'Compacto' }]} />
        {c.layout === 'cards' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />}
        <SwitchRow label="Imagen" checked={c.showImage} onChange={(showImage) => set({ showImage })} />
        <SwitchRow label="Precio" checked={c.showPrice} onChange={(showPrice) => set({ showPrice })} />
        <SwitchRow label="Descripción" checked={c.showDescription} onChange={(showDescription) => set({ showDescription })} />
      </Group>
      <Group title="Botón al final">
        <ButtonEditor label="Botón" value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Catálogo completo */

function CatalogEditor(props: EditorProps<'catalog'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Qué mostrar">
        <Segmented label="Tipo" value={c.itemType} onChange={(itemType) => set({ itemType })} options={[{ value: 'any', label: 'Todo' }, { value: 'product', label: 'Productos' }, { value: 'service', label: 'Servicios' }]} />
        <SwitchRow label="Buscador" checked={c.showSearch} onChange={(showSearch) => set({ showSearch })} />
        <SwitchRow label="Menú de categorías" checked={c.showCategoryNav} onChange={(showCategoryNav) => set({ showCategoryNav })} />
        <SwitchRow label="Filtros" description="Productos/servicios y sólo disponibles." checked={c.showFilters} onChange={(showFilters) => set({ showFilters })} />
        <SwitchRow label="Destacados arriba" checked={c.showFeatured} onChange={(showFeatured) => set({ showFeatured })} />
        <SwitchRow label="Agrupar por categoría" checked={c.groupByCategory} onChange={(groupByCategory) => set({ groupByCategory })} />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: 'Cuadrícula' }, { value: 'list', label: 'Lista' }, { value: 'showcase', label: 'Vitrina' }]} />
        {c.layout !== 'list' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />}
        <SelectInput label="Estilo de tarjeta" value={c.cardStyle} onChange={(cardStyle) => set({ cardStyle })} options={cardStyleOptions} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Categorías */

function CategoriesEditor(props: EditorProps<'categories'>) {
  const set = useContent(props);
  const c = props.section.content;
  const categories = props.site.categories;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Presentación">
        <SelectInput label="Estilo" value={c.display} onChange={(display) => set({ display })} options={[{ value: 'cards', label: 'Tarjetas con imagen' }, { value: 'imageText', label: 'Imagen + texto encima' }, { value: 'grid', label: 'Cuadrícula de texto' }, { value: 'list', label: 'Lista' }]} />
        {c.display !== 'list' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />}
        <SwitchRow label="Descripción" checked={c.showDescription} onChange={(showDescription) => set({ showDescription })} />
        <SwitchRow label="Cantidad de ítems" checked={c.showCount} onChange={(showCount) => set({ showCount })} />
      </Group>
      <Group title="Contenido y enlace">
        <Autocomplete
          multiple
          options={categories.map((cat) => cat.id)}
          value={c.categoryIds.filter((id) => categories.some((cat) => cat.id === id))}
          getOptionLabel={(id) => categories.find((cat) => cat.id === id)?.name ?? 'Categoría'}
          onChange={(_, categoryIds) => set({ categoryIds })}
          renderInput={(params) => <TextField {...params} label="Categorías" placeholder={c.categoryIds.length ? '' : 'Todas (con ítems)'} />}
        />
        <SelectInput
          label="Al hacer clic, abrir"
          value={c.linkPageId}
          onChange={(linkPageId) => set({ linkPageId })}
          options={[{ value: '', label: 'No enlazar' }, ...props.pages.map((p) => ({ value: p.id, label: p.title }))]}
          helper="Elige la página con tu catálogo: se abrirá filtrada por la categoría."
        />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Banner */

function BannerEditor(props: EditorProps<'banner'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
        <ButtonEditor label="Botón" value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
      <Group title="Diseño" description="El fondo, overlay y color de texto están en la pestaña Estilo.">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'boxed', label: 'Caja' }, { value: 'full', label: 'Ancho completo' }, { value: 'split', label: 'Con imagen' }]} />
        <Segmented label="Altura" value={c.height} onChange={(height) => set({ height })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        <Segmented label="Alineación" value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
        {c.layout === 'split' && <MediaInput label="Imagen" value={c.image.path} onChange={(path) => set({ image: { path } })} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Galería */

function GalleryEditor(props: EditorProps<'gallery'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Imágenes">
        <ListEditor
          items={c.images}
          onChange={(images) => set({ images })}
          create={() => ({ path: '', caption: '' })}
          addLabel="Agregar imagen"
          max={40}
          itemTitle={(img, i) => img.caption || `Imagen ${i + 1}`}
          renderItem={(img, update) => (
            <>
              <MediaInput label="Imagen" value={img.path || null} onChange={(path) => update({ ...img, path: path ?? '' })} width={96} />
              <TextInput label="Leyenda (opcional)" value={img.caption} onChange={(caption) => update({ ...img, caption })} maxLength={160} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: 'Cuadrícula' }, { value: 'masonry', label: 'Mosaico' }, { value: 'slider', label: 'Carrusel' }]} />
        {c.layout !== 'masonry' && <Segmented label="Proporción" value={c.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: 'square', label: '1:1' }, { value: 'landscape', label: '4:3' }, { value: 'portrait', label: '3:4' }, { value: 'original', label: 'Original' }]} />}
        <Segmented label="Separación" value={c.gap} onChange={(gap) => set({ gap })} options={[{ value: 'none', label: 'Sin' }, { value: 'sm', label: 'Chica' }, { value: 'md', label: 'Normal' }]} />
        <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Beneficios */

function FeaturesEditor(props: EditorProps<'features'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Beneficios">
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: crypto.randomUUID(), icon: 'star' as const, title: 'Nuevo beneficio', text: '' })}
          addLabel="Agregar beneficio"
          itemTitle={(item) => item.title || 'Beneficio'}
          renderItem={(item, update) => (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <IconPicker value={item.icon} onChange={(icon) => update({ ...item, icon })} />
                <TextInput label="Título" value={item.title} onChange={(title) => update({ ...item, title })} maxLength={80} />
              </Stack>
              <TextInput label="Texto" value={item.text} onChange={(text) => update({ ...item, text })} multiline rows={2} maxLength={300} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: 'Cuadrícula' }, { value: 'list', label: 'Lista' }, { value: 'inline', label: 'En línea' }]} />
        <Segmented label="Ícono" value={c.iconStyle} onChange={(iconStyle) => set({ iconStyle })} options={[{ value: 'plain', label: 'Simple' }, { value: 'circle', label: 'Círculo' }, { value: 'square', label: 'Cuadro' }]} />
        <Segmented label="Alineación" value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
        {c.layout === 'grid' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Testimonios */

function TestimonialsEditor(props: EditorProps<'testimonials'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Testimonios">
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: crypto.randomUUID(), name: 'Nombre', role: '', text: '', photo: null, rating: 5 })}
          addLabel="Agregar testimonio"
          itemTitle={(t) => t.name || 'Testimonio'}
          renderItem={(t, update) => (
            <>
              <TextInput label="Testimonio" value={t.text} onChange={(text) => update({ ...t, text })} multiline rows={3} maxLength={600} />
              <TextInput label="Nombre" value={t.name} onChange={(name) => update({ ...t, name })} maxLength={80} />
              <TextInput label="Cargo o empresa (opcional)" value={t.role} onChange={(role) => update({ ...t, role })} maxLength={80} />
              <SliderInput label="Calificación" value={t.rating} min={0} max={5} format={(v) => (v ? '★'.repeat(v) : 'Sin estrellas')} onChange={(rating) => update({ ...t, rating })} />
              <MediaInput label="Foto (opcional)" value={t.photo} onChange={(photo) => update({ ...t, photo })} aspect="1 / 1" width={64} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: 'Cuadrícula' }, { value: 'slider', label: 'Carrusel' }, { value: 'single', label: 'Destacado' }]} />
        {c.layout === 'grid' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Contacto */

function ContactEditor(props: EditorProps<'contact'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group description="Los datos se toman de Configuración › Información de contacto: se actualizan solos en todo el sitio.">
        <Heading {...props} />
      </Group>
      <Group title="Qué mostrar">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'split', label: 'Con mapa' }, { value: 'cards', label: 'Tarjetas' }, { value: 'centered', label: 'Centrado' }]} />
        <SwitchRow label="WhatsApp" checked={c.showWhatsapp} onChange={(showWhatsapp) => set({ showWhatsapp })} />
        <SwitchRow label="Teléfono" checked={c.showPhone} onChange={(showPhone) => set({ showPhone })} />
        <SwitchRow label="Email" checked={c.showEmail} onChange={(showEmail) => set({ showEmail })} />
        <SwitchRow label="Dirección" checked={c.showAddress} onChange={(showAddress) => set({ showAddress })} />
        <SwitchRow label="Horarios" checked={c.showHours} onChange={(showHours) => set({ showHours })} />
        <SwitchRow label="Redes sociales" checked={c.showSocial} onChange={(showSocial) => set({ showSocial })} />
        <SwitchRow label="Botones de contacto" checked={c.showActions} onChange={(showActions) => set({ showActions })} />
        <SwitchRow label="Mapa" description="Usa la dirección del negocio (Google Maps, sin clave)." checked={c.showMap} onChange={(showMap) => set({ showMap })} />
      </Group>
    </>
  );
}

function SocialEditor(props: EditorProps<'social'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group description="Los perfiles se configuran en Configuración › Redes sociales.">
        <Heading {...props} />
      </Group>
      <Group title="Presentación">
        <Segmented label="Estilo" value={c.display} onChange={(display) => set({ display })} options={[{ value: 'icons', label: 'Íconos' }, { value: 'buttons', label: 'Botones' }, { value: 'cards', label: 'Tarjetas' }]} />
        <Segmented label="Alineación" value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
      </Group>
    </>
  );
}

function SpacerEditor(props: EditorProps<'spacer'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <Group>
      <Segmented label="Altura" value={c.height} onChange={(height) => set({ height })} options={[{ value: 'xs', label: 'XS' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
      <Segmented label="Divisor" value={c.divider} onChange={(divider) => set({ divider })} options={[{ value: 'none', label: 'Ninguno' }, { value: 'line', label: 'Línea' }, { value: 'dots', label: 'Puntos' }, { value: 'ornament', label: 'Ornamento' }]} />
    </Group>
  );
}

/** Registro de editores: TypeScript exige uno por cada tipo de sección. */
export const CONTENT_EDITORS: { [T in SectionType]: ComponentType<EditorProps<T>> } = {
  hero: HeroEditor,
  text: TextEditor,
  products: ProductsEditor,
  services: ServicesEditor,
  catalog: CatalogEditor,
  categories: CategoriesEditor,
  banner: BannerEditor,
  gallery: GalleryEditor,
  features: FeaturesEditor,
  testimonials: TestimonialsEditor,
  contact: ContactEditor,
  social: SocialEditor,
  spacer: SpacerEditor,
};
