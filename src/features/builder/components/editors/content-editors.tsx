'use client';

import { Autocomplete, Button, Stack, TextField, Typography } from '@mui/material';
import { Images } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { ColumnsSectionEditor } from './columns-editor';
import { MediaLibraryDialog } from '@/features/media/components/MediaLibraryDialog';
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
import { CODE_EDITORS } from './code-editors';
import { EXTRA_EDITORS } from './extra-editors';
import { CollectionEditor, PresentationEditor } from './presentation-editors';
import { useT } from '@/i18n/client';

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
  const t = useT();
  const set = useContent(props);
  const c = (props.section as unknown as { content: { eyebrow: string; title: string; subtitle: string } }).content;
  return (
    <>
      <TextInput label={t('Título')} value={c.title} placeholder={props.titlePlaceholder} onChange={(title) => set({ title } as never)} maxLength={160} />
      <TextInput label={props.subtitleLabel ?? t('Subtítulo')} value={c.subtitle} onChange={(subtitle) => set({ subtitle } as never)} multiline rows={2} maxLength={500} />
      <TextInput label={t('Antetítulo (opcional)')} value={c.eyebrow} placeholder={t('Ej. NOVEDADES')} onChange={(eyebrow) => set({ eyebrow } as never)} maxLength={80} />
    </>
  );
}

/* ------------------------------------------------------------ Hero */

function HeroEditor(props: EditorProps<'hero'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} titlePlaceholder={t('Vacío = {name}', { name: props.site.business.name })} subtitleLabel={t('Subtítulo (vacío = slogan del negocio)')} />
      </Group>
      <Group title={t('Diseño')}>
        <Segmented label={t('Composición')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'centered', label: t('Centrado') }, { value: 'left', label: t('Izquierda') }, { value: 'split', label: t('Con imagen') }]} />
        <Segmented label={t('Altura')} value={c.height} onChange={(height) => set({ height })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'screen', label: t('Pantalla') }]} />
        {c.layout === 'split' && <MediaInput label={t('Imagen lateral')} value={c.image.path} onChange={(path) => set({ image: { path } })} />}
        <SwitchRow label={t('Mostrar logo')} checked={c.showLogo} onChange={(showLogo) => set({ showLogo })} />
      </Group>
      <Group title={t('Botones')}>
        <ButtonEditor label={t('Botón principal')} value={c.primaryButton} onChange={(primaryButton) => set({ primaryButton })} pages={props.pages} />
        <ButtonEditor label={t('Botón secundario')} value={c.secondaryButton} onChange={(secondaryButton) => set({ secondaryButton })} pages={props.pages} />
      </Group>
      <Advanced title={t('Video de fondo')}>
        <TextInput label={t('URL de video (.mp4)')} value={c.videoUrl} placeholder="https://…/video.mp4" helper={t('Se reproduce en silencio y en bucle detrás del texto. Usa el Estilo para oscurecerlo.')} onChange={(videoUrl) => set({ videoUrl })} />
      </Advanced>
    </>
  );
}

/* ------------------------------------------------------------ Texto */

function TextEditor(props: EditorProps<'text'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
        <RichTextInput label={t('Texto')} value={c.body} onChange={(body) => set({ body })} />
      </Group>
      <Group title={t('Imagen')}>
        <Segmented label={t('Posición')} value={c.imagePosition} onChange={(imagePosition) => set({ imagePosition })} options={[{ value: 'none', label: t('Sin') }, { value: 'left', label: t('Izq.') }, { value: 'right', label: t('Der.') }, { value: 'top', label: t('Arriba') }]} />
        {c.imagePosition !== 'none' && <MediaInput label={t('Imagen')} value={c.image.path} onChange={(path) => set({ image: { path } })} />}
      </Group>
      <Group title={t('Diseño')}>
        <Segmented label={t('Alineación')} value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
        <Segmented label={t('Ancho del texto')} value={c.width} onChange={(width) => set({ width })} options={[{ value: 'narrow', label: t('Angosto') }, { value: 'normal', label: t('Normal') }, { value: 'wide', label: t('Ancho') }]} />
        <ButtonEditor label={t('Botón')} value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Productos / Servicios */

function ProductsEditor(props: EditorProps<'products'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <CollectionEditor value={c.collection} onChange={(collection) => set({ collection })} site={props.site} />
      <PresentationEditor value={c.presentation} onChange={(presentation) => set({ presentation })} />
      <Group title={t('Botón al final')}>
        <ButtonEditor label={t('Botón (ej. Ver todos)')} value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
    </>
  );
}

function ServicesEditor(props: EditorProps<'services'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <CollectionEditor value={c.collection} onChange={(collection) => set({ collection })} site={props.site} />
      <PresentationEditor value={c.presentation} onChange={(presentation) => set({ presentation })} />
      <Group title={t('Botón al final')}>
        <ButtonEditor label={t('Botón')} value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Catálogo completo */

function CatalogEditor(props: EditorProps<'catalog'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  const setFilters = (patch: Partial<typeof c.filters>) => set({ filters: { ...c.filters, ...patch } });
  const filterable = props.site.attributeDefs.filter((d) => d.filterable);
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Qué mostrar')}>
        <Segmented label={t('Tipo')} value={c.itemType} onChange={(itemType) => set({ itemType })} options={[{ value: 'any', label: t('Todo') }, { value: 'product', label: t('Productos') }, { value: 'service', label: t('Servicios') }]} />
        <SwitchRow label={t('Destacados arriba')} checked={c.showFeatured} onChange={(showFeatured) => set({ showFeatured })} />
        <SwitchRow label={t('Agrupar por categoría')} description={t('Con el orden personalizado y sin búsqueda activa.')} checked={c.groupByCategory} onChange={(groupByCategory) => set({ groupByCategory })} />
      </Group>
      <PresentationEditor value={c.presentation} onChange={(presentation) => set({ presentation })} />
      <Group title={t('Búsqueda y filtros')} description={t('Los visitantes sólo ven los filtros que tienen sentido para tus ítems.')}>
        <SwitchRow label={t('Buscador')} description={t('Por nombre, código, etiquetas y atributos.')} checked={c.filters.search} onChange={(search) => setFilters({ search })} />
        <SwitchRow label={t('Categorías')} checked={c.filters.categories} onChange={(categories) => setFilters({ categories })} />
        <SwitchRow label={t('Productos / servicios')} checked={c.filters.types} onChange={(types) => setFilters({ types })} />
        <SwitchRow label={t('Rango de precio')} checked={c.filters.price} onChange={(price) => setFilters({ price })} />
        <SwitchRow label={t('Destacados, nuevos, ofertas')} checked={c.filters.badges} onChange={(badges) => setFilters({ badges })} />
        <SwitchRow label={t('Sólo disponibles')} checked={c.filters.availability} onChange={(availability) => setFilters({ availability })} />
        <SwitchRow
          label={t('Por atributos')}
          description={filterable.length === 0 ? t('Marca atributos como "filtrables" en Catálogo › Atributos.') : t('Usa los atributos marcados como filtrables.')}
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
            renderInput={(params) => <TextField {...params} label={t('Atributos')} placeholder={c.filters.attributes.length ? '' : t('Todos los filtrables')} />}
          />
        )}
      </Group>
      <Group title={t('Orden y paginación')}>
        <SelectInput label={t('Orden por defecto')} value={c.sort.default} onChange={(value) => set({ sort: { ...c.sort, default: value } })} options={SORT_OPTIONS.map((o) => ({ value: o, label: t(SORT_LABELS[o]) }))} />
        <SwitchRow label={t('El visitante puede cambiar el orden')} checked={c.sort.allowUserSort} onChange={(allowUserSort) => set({ sort: { ...c.sort, allowUserSort } })} />
        <SelectInput
          label={t('Paginación')}
          value={c.pagination.mode}
          onChange={(mode) => set({ pagination: { ...c.pagination, mode } })}
          options={[
            { value: 'all', label: t('Mostrar todo') },
            { value: 'pages', label: t('Páginas numeradas') },
            { value: 'loadMore', label: t('Botón "Ver más"') },
            { value: 'infinite', label: t('Scroll infinito') },
          ]}
        />
        {c.pagination.mode !== 'all' && <SliderInput label={t('Ítems por página')} value={c.pagination.perPage} min={4} max={100} onChange={(perPage) => set({ pagination: { ...c.pagination, perPage } })} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Pedido rápido */

function QuickOrderEditor(props: EditorProps<'quickorder'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  const categories = props.site.categories;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Productos')} description={t('Los que tienen opciones o extras llevan a su ficha para elegir. Necesita los pedidos por WhatsApp activos.')}>
        <SelectInput
          label={t('Mostrar')}
          value={c.categoryId}
          onChange={(categoryId) => set({ categoryId })}
          options={[{ value: '', label: t('Todos los productos') }, ...categories.map((cat) => ({ value: cat.id, label: cat.name }))]}
        />
        <SwitchRow label={t('Agrupar por categoría')} checked={c.groupByCategory} onChange={(groupByCategory) => set({ groupByCategory })} />
        <SwitchRow label={t('Fotos')} checked={c.showImages} onChange={(showImages) => set({ showImages })} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Categorías */

function CategoriesEditor(props: EditorProps<'categories'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  const categories = props.site.categories;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Presentación')}>
        <SelectInput label={t('Estilo')} value={c.display} onChange={(display) => set({ display })} options={[{ value: 'cards', label: t('Tarjetas con imagen') }, { value: 'imageText', label: t('Imagen + texto encima') }, { value: 'grid', label: t('Cuadrícula de texto') }, { value: 'list', label: t('Lista') }]} />
        {c.display !== 'list' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />}
        <SwitchRow label={t('Descripción')} checked={c.showDescription} onChange={(showDescription) => set({ showDescription })} />
        <SwitchRow label={t('Cantidad de ítems')} checked={c.showCount} onChange={(showCount) => set({ showCount })} />
      </Group>
      <Group title={t('Contenido y enlace')}>
        <Autocomplete
          multiple
          options={categories.map((cat) => cat.id)}
          value={c.categoryIds.filter((id) => categories.some((cat) => cat.id === id))}
          getOptionLabel={(id) => categories.find((cat) => cat.id === id)?.name ?? t('Categoría')}
          onChange={(_, categoryIds) => set({ categoryIds })}
          renderInput={(params) => <TextField {...params} label={t('Categorías')} placeholder={c.categoryIds.length ? '' : t('Todas (con ítems)')} />}
        />
        <SelectInput
          label={t('Al hacer clic, abrir')}
          value={c.linkPageId}
          onChange={(linkPageId) => set({ linkPageId })}
          options={[{ value: '', label: t('No enlazar') }, ...props.pages.map((p) => ({ value: p.id, label: p.title }))]}
          helper={t('Elige la página con tu catálogo: se abrirá filtrada por la categoría.')}
        />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Banner */

function BannerEditor(props: EditorProps<'banner'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
        <ButtonEditor label={t('Botón')} value={c.button} onChange={(button) => set({ button })} pages={props.pages} />
      </Group>
      <Group title={t('Diseño')} description={t('El fondo, overlay y color de texto están en la pestaña Estilo.')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'boxed', label: t('Caja') }, { value: 'full', label: t('Ancho completo') }, { value: 'split', label: t('Con imagen') }]} />
        <Segmented label={t('Altura')} value={c.height} onChange={(height) => set({ height })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        <Segmented label={t('Alineación')} value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
        {c.layout === 'split' && <MediaInput label={t('Imagen')} value={c.image.path} onChange={(path) => set({ image: { path } })} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Galería */

function GalleryEditor(props: EditorProps<'gallery'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Imágenes')}>
        <GalleryFromLibrary onAdd={(paths) => set({ images: [...c.images, ...paths.filter((p) => !c.images.some((i) => i.path === p)).map((path) => ({ path, caption: '' }))].slice(0, 40) })} />
        <ListEditor
          items={c.images}
          onChange={(images) => set({ images })}
          create={() => ({ path: '', caption: '' })}
          addLabel={t('Agregar imagen')}
          max={40}
          itemTitle={(img, i) => img.caption || t('Imagen {n}', { n: i + 1 })}
          renderItem={(img, update) => (
            <>
              <MediaInput label={t('Imagen')} value={img.path || null} onChange={(path) => update({ ...img, path: path ?? '' })} width={96} />
              <TextInput label={t('Leyenda (opcional)')} value={img.caption} onChange={(caption) => update({ ...img, caption })} maxLength={160} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: t('Cuadrícula') }, { value: 'masonry', label: t('Mosaico') }, { value: 'slider', label: t('Carrusel') }]} />
        {c.layout !== 'masonry' && <Segmented label={t('Proporción')} value={c.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: 'square', label: '1:1' }, { value: 'landscape', label: '4:3' }, { value: 'portrait', label: '3:4' }, { value: 'original', label: t('Original') }]} />}
        <Segmented label={t('Separación')} value={c.gap} onChange={(gap) => set({ gap })} options={[{ value: 'none', label: t('Sin') }, { value: 'sm', label: t('Chica') }, { value: 'md', label: t('Normal') }]} />
        <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />
      </Group>
    </>
  );
}

/** Agregar varias imágenes de la biblioteca a la vez (sin subirlas de nuevo). */
function GalleryFromLibrary({ onAdd }: { onAdd: (paths: string[]) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" color="inherit" size="small" startIcon={<Images size={14} />} onClick={() => setOpen(true)} sx={{ alignSelf: 'flex-start' }}>
        {t('Agregar varias desde la biblioteca')}
      </Button>
      <MediaLibraryDialog open={open} onClose={() => setOpen(false)} multiple onSelectMany={(records) => onAdd(records.map((r) => r.path))} />
    </>
  );
}

/* ------------------------------------------------------------ Beneficios */

function FeaturesEditor(props: EditorProps<'features'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Beneficios')}>
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: crypto.randomUUID(), icon: 'star' as const, title: 'Nuevo beneficio', text: '' })}
          addLabel={t('Agregar beneficio')}
          itemTitle={(item) => item.title || t('Beneficio')}
          renderItem={(item, update) => (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <IconPicker value={item.icon} onChange={(icon) => update({ ...item, icon })} />
                <TextInput label={t('Título')} value={item.title} onChange={(title) => update({ ...item, title })} maxLength={80} />
              </Stack>
              <TextInput label={t('Texto')} value={item.text} onChange={(text) => update({ ...item, text })} multiline rows={2} maxLength={300} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: t('Cuadrícula') }, { value: 'list', label: t('Lista') }, { value: 'inline', label: t('En línea') }]} />
        <Segmented label={t('Ícono')} value={c.iconStyle} onChange={(iconStyle) => set({ iconStyle })} options={[{ value: 'plain', label: t('Simple') }, { value: 'circle', label: t('Círculo') }, { value: 'square', label: t('Cuadro') }]} />
        <Segmented label={t('Alineación')} value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
        {c.layout === 'grid' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Testimonios */

function TestimonialsEditor(props: EditorProps<'testimonials'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Testimonios')}>
        <Segmented
          label={t('Origen')}
          value={c.source}
          onChange={(source) => set({ source })}
          options={[
            { value: 'manual', label: t('Escritos por ti') },
            { value: 'reviews', label: t('Reseñas de clientes') },
          ]}
        />
        {c.source === 'reviews' ? (
          <Typography variant="caption" color="text.secondary">
            {t('Se muestran las reseñas que apruebes en Reseñas (panel), las más recientes primero, con un botón para dejar una opinión.')}
          </Typography>
        ) : (
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: crypto.randomUUID(), name: 'Nombre', role: '', text: '', photo: null, rating: 5 })}
          addLabel={t('Agregar testimonio')}
          itemTitle={(item) => item.name || t('Testimonio')}
          renderItem={(item, update) => (
            <>
              <TextInput label={t('Testimonio')} value={item.text} onChange={(text) => update({ ...item, text })} multiline rows={3} maxLength={600} />
              <TextInput label={t('Nombre')} value={item.name} onChange={(name) => update({ ...item, name })} maxLength={80} />
              <TextInput label={t('Cargo o empresa (opcional)')} value={item.role} onChange={(role) => update({ ...item, role })} maxLength={80} />
              <SliderInput label={t('Calificación')} value={item.rating} min={0} max={5} format={(v) => (v ? '★'.repeat(v) : t('Sin estrellas'))} onChange={(rating) => update({ ...item, rating })} />
              <MediaInput label={t('Foto (opcional)')} value={item.photo} onChange={(photo) => update({ ...item, photo })} aspect="1 / 1" width={64} />
            </>
          )}
        />
        )}
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: t('Cuadrícula') }, { value: 'slider', label: t('Carrusel') }, { value: 'single', label: t('Destacado') }]} />
        {c.layout === 'grid' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Contacto */

function ContactEditor(props: EditorProps<'contact'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group description={t('Los datos se toman de Configuración › Información de contacto: se actualizan solos en todo el sitio.')}>
        <Heading {...props} />
      </Group>
      <Group title={t('Qué mostrar')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'split', label: t('Con mapa') }, { value: 'cards', label: t('Tarjetas') }, { value: 'centered', label: t('Centrado') }]} />
        <SwitchRow label="WhatsApp" checked={c.showWhatsapp} onChange={(showWhatsapp) => set({ showWhatsapp })} />
        <SwitchRow label={t('Teléfono')} checked={c.showPhone} onChange={(showPhone) => set({ showPhone })} />
        <SwitchRow label={t('Email')} checked={c.showEmail} onChange={(showEmail) => set({ showEmail })} />
        <SwitchRow label={t('Dirección')} checked={c.showAddress} onChange={(showAddress) => set({ showAddress })} />
        <SwitchRow label={t('Horarios')} checked={c.showHours} onChange={(showHours) => set({ showHours })} />
        <SwitchRow label={t('Redes sociales')} checked={c.showSocial} onChange={(showSocial) => set({ showSocial })} />
        <SwitchRow label={t('Botones de contacto')} checked={c.showActions} onChange={(showActions) => set({ showActions })} />
        <SwitchRow label={t('Mapa')} description={t('Usa el enlace de Google Maps del negocio o, si no hay, su dirección.')} checked={c.showMap} onChange={(showMap) => set({ showMap })} />
      </Group>
    </>
  );
}

function SocialEditor(props: EditorProps<'social'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group description={t('Los perfiles se configuran en Configuración › Redes sociales.')}>
        <Heading {...props} />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Estilo')} value={c.display} onChange={(display) => set({ display })} options={[{ value: 'icons', label: t('Íconos') }, { value: 'buttons', label: t('Botones') }, { value: 'cards', label: t('Tarjetas') }]} />
        <Segmented label={t('Alineación')} value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
      </Group>
    </>
  );
}

function SpacerEditor(props: EditorProps<'spacer'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <Group>
      <Segmented label={t('Altura')} value={c.height} onChange={(height) => set({ height })} options={[{ value: 'xs', label: 'XS' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
      <Segmented label={t('Divisor')} value={c.divider} onChange={(divider) => set({ divider })} options={[{ value: 'none', label: t('Ninguno') }, { value: 'line', label: t('Línea') }, { value: 'dots', label: t('Puntos') }, { value: 'ornament', label: t('Ornamento') }]} />
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
  quickorder: QuickOrderEditor,
  columns: ColumnsSectionEditor,
  ...CODE_EDITORS,
};
