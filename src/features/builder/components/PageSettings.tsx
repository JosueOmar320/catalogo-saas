'use client';

import { Box, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { slugify, slugifyLive } from '@/lib/utils/slug';
import { useBuilder, useSelectedPage } from '../state';
import { BackgroundEditor, Group, MediaInput, SwitchRow, TextInput } from './controls';
import { useT } from '@/i18n/client';

/** Configuración de la página: nombre, URL, menú, fondo propio y SEO. */
export function PageSettings({ baseUrl }: { baseUrl: string }) {
  const t = useT();
  const { state, dispatch } = useBuilder();
  const page = useSelectedPage();
  const update = (patch: Partial<typeof page>) => dispatch({ type: 'updatePage', pageId: page.id, patch });
  const navItem = state.navigation.items.find((i) => i.kind === 'page' && i.pageId === page.id);
  const slugTaken = state.pages.some((p) => p.id !== page.id && p.slug === page.slug);

  const setInNav = (visible: boolean) => {
    const items = navItem
      ? state.navigation.items.map((i) => (i.id === navItem.id ? { ...i, visible } : i))
      : [...state.navigation.items, { id: crypto.randomUUID(), kind: 'page' as const, pageId: page.id, label: '', url: '', visible, style: 'link' as const, newTab: false }];
    dispatch({ type: 'setNavigation', navigation: { items } });
  };
  const setNavLabel = (label: string) => {
    if (!navItem) return;
    dispatch({ type: 'setNavigation', navigation: { items: state.navigation.items.map((i) => (i.id === navItem.id ? { ...i, label } : i)) } });
  };

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pt: 1.5 }}>
        <IconButton onClick={() => dispatch({ type: 'editPageSettings', open: false })} aria-label={t('Volver')}><ArrowLeft size={16} /></IconButton>
        <Typography variant="h3" noWrap>{t('Página «{title}»', { title: page.title })}</Typography>
      </Stack>
      <Group title={t('General')}>
        <TextInput label={t('Nombre')} value={page.title} onChange={(title) => update({ title })} maxLength={80} />
        <TextField
          label={t('Dirección')}
          value={page.isHome ? '' : page.slug}
          disabled={page.isHome}
          placeholder={page.isHome ? t('Página de inicio') : ''}
          onChange={(e) => update({ slug: slugifyLive(e.target.value, 60) })}
          onBlur={() => update({ slug: slugify(page.slug, 60) || 'pagina' })}
          error={slugTaken || page.slug === 'p'}
          helperText={page.isHome ? t('La página de inicio vive en la raíz del sitio.') : slugTaken ? t('Otra página usa esta dirección.') : page.slug === 'p' ? t('Dirección reservada.') : ' '}
          slotProps={{ inputLabel: { shrink: true }, input: { startAdornment: <InputAdornment position="start">{baseUrl.replace(/^https?:\/\//, '')}/</InputAdornment> } }}
        />
        <SwitchRow label={t('Página activa')} description={t('Si la desactivas deja de ser visible en el sitio publicado.')} checked={page.isPublished || page.isHome} onChange={(isPublished) => update({ isPublished })} />
        <SwitchRow label={t('Mostrar en el menú')} checked={Boolean(navItem?.visible)} onChange={setInNav} />
        {navItem?.visible && <TextInput label={t('Texto en el menú')} value={navItem.label} placeholder={page.title} onChange={setNavLabel} maxLength={40} />}
      </Group>
      <Group title={t('Fondo de la página')} description={t('Sobrescribe el fondo global sólo en esta página.')}>
        <BackgroundEditor value={page.style.background} onChange={(background) => update({ style: { ...page.style, background } })} inheritLabel={t('Global')} />
      </Group>
      <Group title={t('SEO de la página')} description={t('Vacío = se usan los datos del sitio.')}>
        <TextInput label={t('Título SEO')} value={page.seo.title} placeholder={page.title} onChange={(title) => update({ seo: { ...page.seo, title } })} maxLength={70} />
        <TextInput label={t('Meta descripción')} value={page.seo.description} onChange={(description) => update({ seo: { ...page.seo, description } })} multiline rows={2} maxLength={160} />
        <MediaInput label={t('Imagen para compartir')} description="1200 × 630 px" value={page.seo.ogImagePath} onChange={(ogImagePath) => update({ seo: { ...page.seo, ogImagePath } })} aspect="1200 / 630" width={140} />
        <SwitchRow label={t('Ocultar de buscadores')} checked={page.seo.noindex} onChange={(noindex) => update({ seo: { ...page.seo, noindex } })} />
      </Group>
    </Box>
  );
}
