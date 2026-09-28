'use client';

import { Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useReducer, useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useAction } from '@/lib/hooks/use-action';
import { slugify } from '@/lib/utils/slug';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import type { SiteViewModel } from '@/lib/site/view-model';
import { saveSite } from '../actions';
import { BuilderContext, builderReducer, type BuilderPanel, type BuilderState } from '../state';
import { BuilderPreview, type Device } from './BuilderPreview';
import { DesignPanel, type IdentityImages } from './DesignPanel';
import { NavigationPanel } from './NavigationPanel';
import { PageSettings } from './PageSettings';
import { PagesPanel } from './PagesPanel';
import { SectionEditor } from './SectionEditor';

type Props = {
  site: SiteViewModel;
  persistedPageIds: string[];
  isStarter: boolean;
  usesSampleItems: boolean;
  identity: IdentityImages;
  initialPanel: BuilderPanel;
  initialDesignTab?: 'theme' | 'colors' | 'type' | 'style' | 'background' | 'cards';
  canManage: boolean;
};

function initialState(props: Props): BuilderState {
  const home = props.site.pages.find((p) => p.isHome) ?? props.site.pages[0];
  return {
    theme: props.site.theme,
    navigation: props.site.navigation,
    pages: props.site.pages,
    persistedPageIds: props.persistedPageIds,
    deletedPageIds: [],
    selectedPageId: home.id,
    selectedSectionId: null,
    editingPageSettings: false,
    panel: props.initialPanel,
    // Un sitio inicial (sin guardar) cuenta como cambio pendiente.
    dirty: { theme: false, navigation: props.isStarter, pages: props.isStarter },
  };
}

/**
 * Editor visual del sitio: Páginas / Navegación / Diseño a la izquierda y
 * preview en vivo a la derecha. Todo se edita en memoria y se guarda de una
 * vez (transacción atómica en la base de datos).
 */
export function Builder(props: Props) {
  const [state, dispatch] = useReducer(builderReducer, props, initialState);
  const [device, setDevice] = useState<Device>('desktop');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const muiTheme = useTheme();
  const wide = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const dirty = state.dirty.theme || state.dirty.navigation || state.dirty.pages;
  useUnsavedChangesWarning(dirty);

  const draftSite = useMemo<SiteViewModel>(
    () => ({ ...props.site, theme: state.theme, navigation: state.navigation, pages: state.pages }),
    [props.site, state.theme, state.navigation, state.pages],
  );
  // La preview se actualiza con prioridad baja: los controles nunca se traban.
  const previewSite = useDeferredValue(draftSite);

  const save = () =>
    run(
      () =>
        saveSite({
          theme: state.dirty.theme ? state.theme : undefined,
          navigation: state.dirty.navigation ? state.navigation : undefined,
          pages: state.dirty.pages ? state.pages.map((p) => ({ ...p, slug: slugify(p.slug, 60) || 'pagina' })) : undefined,
          deletedPageIds: state.deletedPageIds,
        }),
      {
        onSuccess: () => {
          dispatch({ type: 'saved', persistedPageIds: state.pages.map((p) => p.id) });
          router.refresh();
        },
      },
    );

  const discard = async () => {
    const ok = await confirm({ title: '¿Descartar los cambios?', description: 'Se perderán los cambios que no guardaste.', confirmLabel: 'Descartar', destructive: true });
    if (ok) dispatch({ type: 'reset', state: initialState(props) });
  };

  const left = (
    <Paper variant="outlined" sx={{ px: 2, pb: 3, height: { lg: '100%' }, overflowY: { lg: 'auto' } }}>
      <Tabs value={state.panel} onChange={(_, panel) => dispatch({ type: 'setPanel', panel })} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
        <Tab value="pages" label="Páginas" />
        <Tab value="navigation" label="Navegación" />
        <Tab value="design" label="Diseño" />
      </Tabs>
      {state.panel === 'pages' &&
        (state.selectedSectionId ? <SectionEditor site={draftSite} /> : state.editingPageSettings ? <PageSettings baseUrl={props.site.url} /> : <PagesPanel />)}
      {state.panel === 'navigation' && <NavigationPanel />}
      {state.panel === 'design' && <DesignPanel identity={props.identity} initialTab={props.initialDesignTab} />}
    </Paper>
  );

  const notice = props.isStarter
    ? 'Preparamos un sitio inicial para ti. Revísalo y guarda para crearlo.'
    : props.usesSampleItems
      ? 'Mostrando productos de ejemplo: aparecerán los tuyos cuando los agregues.'
      : null;

  const preview = (
    <BuilderPreview
      site={previewSite}
      pageId={state.selectedPageId}
      selectedSectionId={state.selectedSectionId}
      device={device}
      onDevice={setDevice}
      onNavigate={(pageId) => dispatch({ type: 'selectPage', pageId })}
      onSelectSection={(sectionId) => dispatch({ type: 'selectSection', sectionId })}
      notice={notice}
    />
  );

  return (
    <BuilderContext.Provider value={{ state, dispatch }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: { lg: 'calc(100vh - 56px - 32px)' } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h1">Editor del sitio</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>Páginas, secciones, navegación y diseño. Los cambios se ven al instante.</Typography>
          </Box>
          {dirty && <Chip label="Cambios sin guardar" color="warning" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
          <Button color="inherit" onClick={discard} disabled={!dirty || pending}>Descartar</Button>
          <Button variant="contained" onClick={save} disabled={!dirty || pending || !props.canManage}>
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </Stack>

        {wide ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr)', gap: 2, flex: 1, minHeight: 0 }}>
            {left}
            {preview}
          </Box>
        ) : (
          <>
            <Tabs value={mobileView} onChange={(_, v) => setMobileView(v)} sx={{ mb: 1.5 }}>
              <Tab value="edit" label="Editar" />
              <Tab value="preview" label="Vista previa" />
            </Tabs>
            {mobileView === 'edit' ? left : <Box sx={{ height: '78vh' }}>{preview}</Box>}
          </>
        )}
      </Box>
    </BuilderContext.Provider>
  );
}
