'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { WriteWithGarfield } from '@/features/assistant/components/WriteWithGarfield';
import { ImageField } from '@/components/form/ImageField';
import { SwitchControl, TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { saveSeo } from '@/features/catalog/actions';
import { seoSchema, type CatalogSeo } from '@/lib/catalog/settings';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { publicStorageUrl } from '@/lib/utils/storage';

type Props = { seo: CatalogSeo; fallbackTitle: string; fallbackDescription: string; url: string };

export function SeoForm({ seo, fallbackTitle, fallbackDescription, url }: Props) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, reset, formState, getValues, setValue } = useForm<CatalogSeo>({ resolver: zodResolver(seoSchema) as Resolver<CatalogSeo>, defaultValues: seo });
  const title = useWatch({ control, name: 'title' }) || fallbackTitle;
  const description = useWatch({ control, name: 'description' }) || fallbackDescription;

  return (
    <SectionCard title={t('SEO y redes')} description={t('Cómo aparece tu catálogo en Google y al compartirlo por WhatsApp o redes. Si dejas campos vacíos, se usan el nombre y la descripción del negocio.')}>
      <Stack component="form" spacing={2} onSubmit={handleSubmit((values) => run(() => saveSeo(values), { onSuccess: () => { reset(values); router.refresh(); } }))}>
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary" noWrap component="p">{url}</Typography>
          <Typography sx={(theme) => ({ color: '#1a0dab', ...theme.applyStyles('dark', { color: '#8ab4f8' }), fontSize: 18, lineHeight: 1.3 })} noWrap>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</Typography>
        </Box>
        <TextFieldControl control={control} name="title" label={t('Título')} placeholder={fallbackTitle} helperText={t('Recomendado: hasta 60 caracteres.')} />
        <WriteWithGarfield kind="seo_title" getInput={() => ({ current: getValues('title') })} onPick={(text) => setValue('title', text, { shouldDirty: true, shouldValidate: true })} />
        <TextFieldControl control={control} name="description" label={t('Descripción')} placeholder={fallbackDescription} multiline minRows={2} helperText={t('Recomendado: 120 a 160 caracteres.')} />
        <WriteWithGarfield kind="seo_description" getInput={() => ({ current: getValues('description') })} onPick={(text) => setValue('description', text, { shouldDirty: true, shouldValidate: true })} />
        <Controller
          control={control}
          name="ogImagePath"
          render={({ field }) => (
            <ImageField label={t('Imagen para compartir')} description={t('1200 × 630 px. Si no subes una, se usa la portada.')} kind="og" value={publicStorageUrl(field.value)} onChange={(path) => field.onChange(path)} width={160} aspectRatio="1200 / 630" />
          )}
        />
        <SwitchControl control={control} name="noindex" label={t('Ocultar de buscadores')} description={t('Útil si sólo compartes el enlace de forma privada.')} />
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={pending || !formState.isDirty}>{t('Guardar')}</Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
