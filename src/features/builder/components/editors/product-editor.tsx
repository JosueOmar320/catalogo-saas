'use client';

import { resolveSpotlightItem } from '@/lib/site/resolve';
import { useT } from '@/i18n/client';
import { Group, Segmented, SwitchRow, TextInput } from '../controls';
import { useContent, type EditorProps } from './content-editors';
import { ItemSelect } from './presentation-editors';

/** Sección Producto: un ítem en específico y cómo se presenta. */
export function ProductEditor(props: EditorProps<'product'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  const item = resolveSpotlightItem(c, props.site.items);
  const banner = c.layout === 'banner';
  return (
    <>
      <Group title={t('Qué producto')}>
        <ItemSelect
          label={t('Producto o servicio')}
          items={props.site.items}
          value={c.itemId}
          emptyLabel={t('Automático: el primer destacado')}
          helper={!c.itemId && item ? t('Ahora se muestra: {name}', { name: item.name }) : undefined}
          onChange={(itemId) => set({ itemId })}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Diseño')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'split', label: t('Ficha') }, { value: 'card', label: t('Tarjeta') }, { value: 'banner', label: t('Banner') }]} />
        <Segmented label={banner ? t('Texto') : t('Foto')} value={c.imageSide} onChange={(imageSide) => set({ imageSide })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'right', label: t('Derecha') }]} />
        {!banner && <SwitchRow label={t('Galería de fotos')} description={t('Miniaturas para cambiar de imagen.')} checked={c.gallery} onChange={(gallery) => set({ gallery })} />}
        <SwitchRow label={t('Etiquetas (Nuevo, Oferta…)')} checked={c.showBadges} onChange={(showBadges) => set({ showBadges })} />
        {!banner && <SwitchRow label={t('Descripción completa')} checked={c.showDescription} onChange={(showDescription) => set({ showDescription })} />}
        {!banner && <SwitchRow label={t('Características')} description={t('Los atributos de la ficha (talla, material, duración…).')} checked={c.showSpecs} onChange={(showSpecs) => set({ showSpecs })} />}
        <SwitchRow label={t('Botón para pedir o consultar')} description={banner ? undefined : t('Con sus opciones y extras, si tiene.')} checked={c.showOrder} onChange={(showOrder) => set({ showOrder })} />
        <SwitchRow label={t('Enlace «Ver detalles»')} checked={c.showDetailsLink} onChange={(showDetailsLink) => set({ showDetailsLink })} />
      </Group>
      <Group title={t('Textos')} description={t('Vacíos: se usan la categoría, el nombre y la descripción corta del producto.')}>
        <TextInput label={t('Antetítulo (opcional)')} value={c.eyebrow} placeholder={t('ej. Producto del mes')} onChange={(eyebrow) => set({ eyebrow })} maxLength={80} />
        <TextInput label={t('Título')} value={c.title} placeholder={item?.name} onChange={(title) => set({ title })} maxLength={160} />
        <TextInput label={t('Texto')} value={c.subtitle} placeholder={item?.shortDescription ?? undefined} onChange={(subtitle) => set({ subtitle })} multiline rows={2} maxLength={500} />
      </Group>
    </>
  );
}
