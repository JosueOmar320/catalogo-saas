'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ChevronDown, Package, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { GalleryField } from '@/components/form/GalleryField';
import { SelectControl, SwitchControl, TextFieldControl } from '@/components/form/fields';
import { PageHeader } from '@/components/ui/PageHeader';
import { SaveBar } from '@/components/ui/SaveBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { CURRENCIES } from '@/lib/catalog/settings';
import type { SiteViewModel } from '@/lib/site/view-model';
import { ColorField } from '@/components/form/ColorField';
import { useAction } from '@/lib/hooks/use-action';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import { saveItem } from '../actions';
import { ITEM_TYPE_LABELS, itemFormSchema, type ItemFormValues } from '../schema';
import { ItemAttributesFields } from './ItemAttributesFields';
import { ItemCardPreview } from './ItemCardPreview';
import { VariantsField } from './VariantsField';

type Props = {
  itemId: string | null;
  defaultValues: ItemFormValues;
  categories: { id: string; name: string }[];
  previewSite: SiteViewModel;
};

const FORM_ID = 'item-form';

export function ItemForm({ itemId, defaultValues, categories, previewSite }: Props) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema), defaultValues });
  const { control, handleSubmit, reset, setError, formState } = form;
  const values = useWatch({ control }) as ItemFormValues;
  const labels = ITEM_TYPE_LABELS[values.type];
  const isNew = itemId === null;
  useUnsavedChangesWarning(formState.isDirty);

  const submit = (addAnother: boolean) =>
    handleSubmit((data) =>
      run(() => saveItem(itemId, data), {
        setError,
        onSuccess: ({ id }) => {
          if (addAnother) {
            reset({ ...defaultValues, type: data.type, categoryId: data.categoryId, currency: data.currency });
            return;
          }
          reset(data);
          if (isNew) router.replace(`/dashboard/catalog/items/${id}`);
          router.refresh();
        },
      }),
    );

  const listHref = values.type === 'service' ? '/dashboard/catalog/services' : '/dashboard/catalog/products';
  const [attributesHintBefore, attributesHintAfter] = t('Define atributos como Marca, Material, Tamaño o Duración en {link} para completarlos aquí, filtrar por ellos y compararlos en el PDF.').split('{link}');

  return (
    <Box component="form" id={FORM_ID} onSubmit={submit(false)} noValidate>
      <PageHeader
        title={isNew ? t(labels.newLabel) : values.name || t(labels.singular)}
        back={{ href: listHref, label: t(labels.plural) }}
        actions={
          <>
            {isNew && (
              <Button variant="outlined" color="inherit" onClick={submit(true)} disabled={pending}>
                {t('Guardar y agregar otro')}
              </Button>
            )}
            <Button type="submit" variant="contained" disabled={pending || (!isNew && !formState.isDirty)}>
              {pending ? t('Guardando…') : isNew ? t('Crear') : t('Guardar')}
            </Button>
          </>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <SectionCard>
              <Stack spacing={2}>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <ToggleButtonGroup exclusive size="small" value={field.value} onChange={(_, v) => v && field.onChange(v)} aria-label={t('Tipo')}>
                      <ToggleButton value="product" sx={{ gap: 0.75, px: 1.5, textTransform: 'none' }}>
                        <Package size={15} /> {t('Producto')}
                      </ToggleButton>
                      <ToggleButton value="service" sx={{ gap: 0.75, px: 1.5, textTransform: 'none' }}>
                        <Wrench size={15} /> {t('Servicio')}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
                <TextFieldControl control={control} name="name" label={t('Nombre')} required autoFocus={isNew} />
                <TextFieldControl
                  control={control}
                  name="shortDescription"
                  label={t('Descripción corta')}
                  multiline
                  minRows={2}
                  helperText={t('Se muestra en la tarjeta. {count}/300', { count: values.shortDescription?.length ?? 0 })}
                />
              </Stack>
            </SectionCard>

            <SectionCard title={t('Imágenes')} description={t('La primera es la imagen principal.')}>
              <Controller control={control} name="images" render={({ field }) => <GalleryField value={field.value} onChange={field.onChange} />} />
            </SectionCard>

            <SectionCard title={t('Precio')} description={values.type === 'service' ? t('Déjalo vacío si el precio es a cotizar.') : undefined}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl
                    control={control}
                    name="price"
                    label={t('Precio')}
                    inputMode="decimal"
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl
                    control={control}
                    name="compareAtPrice"
                    label={t('Precio anterior')}
                    inputMode="decimal"
                    helperText={t('Opcional. Muestra una oferta.')}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <SelectControl control={control} name="currency" label={t('Moneda')} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextFieldControl
                    control={control}
                    name="priceNote"
                    label={t('Nota del precio')}
                    placeholder={values.type === 'service' ? t('desde, por hora, por sesión…') : t('por kg, c/u, paquete…')}
                  />
                </Grid>
              </Grid>
            </SectionCard>

            {values.type === 'product' && (
              <SectionCard title={t('Opciones')}>
                <VariantsField control={control} basePrice={values.price ?? ''} />
              </SectionCard>
            )}

            <SectionCard
              title={t('Atributos')}
              description={previewSite.attributeDefs.length ? t('Datos propios de tu catálogo. Se muestran en tarjetas, ficha y PDF según cada atributo.') : undefined}
            >
              {previewSite.attributeDefs.length ? (
                <Controller control={control} name="attributeValues" render={({ field }) => <ItemAttributesFields defs={previewSite.attributeDefs} value={field.value} onChange={field.onChange} />} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {attributesHintBefore}
                  <Link href="/dashboard/catalog/attributes">{t('Catálogo › Atributos')}</Link>
                  {attributesHintAfter}
                </Typography>
              )}
            </SectionCard>

            <Accordion variant="outlined" disableGutters defaultExpanded={Boolean(defaultValues.description || defaultValues.sku || defaultValues.tags.length)} sx={{ '&:before': { display: 'none' }, borderRadius: 1.5 }}>
              <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ px: 2.5 }}>
                <Box>
                  <Typography variant="h3">{t('Más detalles')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('Descripción completa, código y etiquetas.')}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
                <Stack spacing={2}>
                  <TextFieldControl control={control} name="description" label={t('Descripción completa')} multiline minRows={4} helperText={t('Se muestra en la página del ítem.')} />
                  <TextFieldControl control={control} name="sku" label={t('Código / SKU')} sx={{ maxWidth: 280 }} />
                  <Controller
                    control={control}
                    name="tags"
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        multiple
                        freeSolo
                        options={[]}
                        value={field.value}
                        onChange={(_, v) => field.onChange((v as string[]).map((tag) => tag.trim()).filter(Boolean))}
                        renderValue={(value, getItemProps) =>
                          value.map((option, index) => {
                            const { key, ...itemProps } = getItemProps({ index });
                            return <Chip key={key} label={option} {...itemProps} />;
                          })
                        }
                        renderInput={(params) => (
                          <TextField {...params} label={t('Etiquetas')} placeholder={t('Escribe y presiona Enter')} error={Boolean(fieldState.error)} helperText={fieldState.error?.message ? t(fieldState.error.message) : t('Ayudan a encontrar el ítem con el buscador.')} />
                        )}
                      />
                    )}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 80 } }}>
            <SectionCard title={t('Estado')}>
              <Stack spacing={0.5}>
                <SwitchControl control={control} name="isVisible" label={t('Visible en el catálogo')} description={t('Si lo apagas, sólo tú lo ves.')} />
                <SwitchControl control={control} name="isAvailable" label={t('Disponible')} description={t('Si no, se muestra como agotado.')} />
                <SwitchControl control={control} name="isFeatured" label={t('Destacado')} description={t('Aparece en la sección Destacados.')} />
              </Stack>
            </SectionCard>
            <SectionCard title={t('Badges')} description={t('Etiquetas sobre la foto. Oferta y Agotado son automáticos.')}>
              <Controller
                control={control}
                name="badges"
                render={({ field }) => (
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    {(['new', 'popular', 'featured'] as const).map((key) => {
                      const active = field.value.includes(key);
                      const label = previewSite.theme.badges[key].label;
                      return (
                        <Chip
                          key={key}
                          label={label}
                          color={active ? 'primary' : 'default'}
                          variant={active ? 'filled' : 'outlined'}
                          onClick={() => field.onChange(active ? field.value.filter((b) => b !== key) : [...field.value, key])}
                        />
                      );
                    })}
                  </Stack>
                )}
              />
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <TextFieldControl control={control} name="customBadgeLabel" label={t('Badge personalizado')} placeholder={t('Ej. Sin gluten')} helperText={t('Opcional. Máximo 20 caracteres.')} />
                {values.customBadgeLabel && (
                  <Controller control={control} name="customBadgeColor" render={({ field }) => <ColorField label={t('Color del badge')} value={field.value} onChange={field.onChange} />} />
                )}
              </Stack>
            </SectionCard>
            <SectionCard title={t('Categoría')}>
              <SelectControl
                control={control}
                name="categoryId"
                label={t('Categoría')}
                options={[{ value: '', label: t('Sin categoría') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                <Box component={Link} href="/dashboard/catalog/categories" sx={{ color: 'primary.main' }}>
                  {t('Administrar categorías')}
                </Box>
              </Typography>
            </SectionCard>
            <ItemCardPreview site={previewSite} values={values} categoryName={categories.find((c) => c.id === values.categoryId)?.name} />
          </Stack>
        </Grid>
      </Grid>

      {!isNew && <SaveBar visible={formState.isDirty} saving={pending} onDiscard={() => reset()} formId={FORM_ID} />}
    </Box>
  );
}
