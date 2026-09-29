'use client';

import { Autocomplete, Stack, TextField } from '@mui/material';
import type { ComponentType } from 'react';
import { SORT_LABELS, SORT_OPTIONS } from '@/lib/catalog/collections';
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
import { EXTRA_EDITORS } from './extra-editors';
import { CollectionEditor, PresentationEditor } from './presentation-editors';

export type EditorProps<T extends SectionType> = {
  section: SectionOf<T>;
  onChange: (section: SectionOf<T>) => void;
  pages: SitePage[];
  site: SiteViewModel;
};

/** Actualiza campos del contenido conservando el resto. */
export function useContent<T extends SectionType>({ section, onChange }: EditorProps<T>) {
  const content = (section as { content: object }).content;
  return (patch: Partial<SectionOf<T>['content']>) => onChange({ ...section, content: { ...content, ...patch } } as SectionOf<T>);
}

export function Heading<T extends Exclude<SectionType, 'spacer'>>(
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

function ProductsEditor(props: EditorProps<'products'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <CollectionEditor value={c.collection} onChange={(collection) => set({ collection })} site={props.site} />
      <PresentationEditor value={c.presentation} onChange={(presentation) => set({ presentation })} />
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
      <CollectionEditor value={c.collection} onChange={(collection) => set({ collection })} site={props.site} />
      <PresentationEditor value={c.presentation} onChange={(presentation) => set({ presentation })} />
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
  const setFilters = (patch: Partial<typeof c.filters>) => set({ filters: { ...c.filters, ...patch } });
  const filterable = props.site.attributeDefs.filter((d) => d.filterable);
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Qué mostrar">
        <Segmented label="Tipo" value={c.itemType} onChange={(itemType) => set({ itemType })} options={[{ value: 'any', label: 'Todo' }, { value: 'product', label: 'Productos' }, { value: 'service', label: 'Servicios' }]} />
        <SwitchRow label="Destacados arriba" checked={c.showFeatured} onChange={(showFeatured) => set({ showFeatured })} />
        <SwitchRow label="Agrupar por categoría" description="Con el orden personalizado y sin búsqueda activa." checked={c.groupByCategory} onChange={(groupByCategory) => set({ groupByCategory })} />
      </Group>
      <PresentationEditor value={c.presentation} onChange={(presentation) => set({ presentation })} />
      <Group title="Búsqueda y filtros" description="Los visitantes sólo ven los filtros que tienen sentido para tus ítems.">
        <SwitchRow label="Buscador" description="Por nombre, código, etiquetas y atributos." checked={c.filters.search} onChange={(search) => setFilters({ search })} />
        <SwitchRow label="Categorías" checked={c.filters.categories} onChange={(categories) => setFilters({ categories })} />
        <SwitchRow label="Productos / servicios" checked={c.filters.types} onChange={(types) => setFilters({ types })} />
        <SwitchRow label="Rango de precio" checked={c.filters.price} onChange={(price) => setFilters({ price })} />
        <SwitchRow label="Destacados, nuevos, ofertas" checked={c.filters.badges} onChange={(badges) => setFilters({ badges })} />
        <SwitchRow label="Sólo disponibles" checked={c.filters.availability} onChange={(availability) => setFilters({ availability })} />
        <SwitchRow
          label="Por atributos"
          description={filterable.length === 0 ? 'Marca atributos como "filtrables" en Catálogo › Atributos.' : 'Usa los atributos marcados como filtrables.'}
          checked={c.filters.byAttributes}
          onChange={(byAttributes) => setFilters({ byAttributes })}
        />
        {c.filters.byAttributes && filterable.length > 1 && (
          <Autocomplete
            multiple
            options={filterable.map((d) => d.id)}
            value={c.filters.attributes.filter((id) => filterable.some((d) => d.id === id))}
            getOptionLabel={(id) => filterable.find((d) => d.id === id)?.name ?? id}
            onChange={(_, attributes) => setFilters({ attributes })}
            renderInput={(params) => <TextField {...params} label="Atributos" placeholder={c.filters.attributes.length ? '' : 'Todos los filtrables'} />}
          />
        )}
      </Group>
      <Group title="Orden y paginación">
        <SelectInput label="Orden por defecto" value={c.sort.default} onChange={(value) => set({ sort: { ...c.sort, default: value } })} options={SORT_OPTIONS.map((o) => ({ value: o, label: SORT_LABELS[o] }))} />
        <SwitchRow label="El visitante puede cambiar el orden" checked={c.sort.allowUserSort} onChange={(allowUserSort) => set({ sort: { ...c.sort, allowUserSort } })} />
        <SelectInput
          label="Paginación"
          value={c.pagination.mode}
          onChange={(mode) => set({ pagination: { ...c.pagination, mode } })}
          options={[
            { value: 'all', label: 'Mostrar todo' },
            { value: 'pages', label: 'Páginas numeradas' },
            { value: 'loadMore', label: 'Botón "Ver más"' },
            { value: 'infinite', label: 'Scroll infinito' },
          ]}
        />
        {c.pagination.mode !== 'all' && <SliderInput label="Ítems por página" value={c.pagination.perPage} min={4} max={100} onChange={(perPage) => set({ pagination: { ...c.pagination, perPage } })} />}
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
        <SwitchRow label="Mapa" description="Usa el enlace de Google Maps del negocio o, si no hay, su dirección." checked={c.showMap} onChange={(showMap) => set({ showMap })} />
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
  ...EXTRA_EDITORS,
};
