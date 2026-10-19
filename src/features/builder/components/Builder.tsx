'use client';

import { Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useReducer, useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useAction } from '@/lib/hooks/use-action';
import { slugify } from '@/lib/utils/slug';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import type { SiteViewModel } from '@/lib/site/view-model';
import { GarfieldProvider } from '@/features/assistant/components/GarfieldProvider';
import { GarfieldLauncher, GarfieldPanel, GarfieldPreviewBanner } from '@/features/assistant/components/GarfieldPanel';
import { saveSite } from '../actions';
import { BuilderContext, builderReducer, type BuilderPanel, type BuilderState } from '../state';
import { BuilderPreview, type Device } from './BuilderPreview';
import { DesignPanel, type IdentityImages } from './DesignPanel';
import { NavigationPanel } from './NavigationPanel';
import { PageSettings } from './PageSettings';
import { PagesPanel } from './PagesPanel';
import { SectionEditor } from './SectionEditor';
import { useT } from '@/i18n/client';

type Props = {
  site: SiteViewModel;
  persistedPageIds: string[];
  isStarter: boolean;
  usesSampleItems: boolean;
  identity: IdentityImages;
  initialPanel: BuilderPanel;
  initialDesignTab?: 'theme' | 'colors' | 'type' | 'style' | 'background' | 'cards';
  canManage: boolean;
  /** Endpoint de Garfield AI (por defecto /api/assistant). */
  assistantEndpoint?: string;
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
  const t = useT();
  const [state, dispatch] = useReducer(builderReducer, props, initialState);
  const [device, setDevice] = useState<Device>('desktop');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  // Vista previa de un plan de Garfield: se muestra en lugar del borrador sin modificarlo.
  const [assistantPreview, setAssistantPreview] = useState<BuilderState | null>(null);
  const shown = assistantPreview ?? state;
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
  const shownSite = useMemo<SiteViewModel>(
    () => (assistantPreview ? { ...props.site, theme: assistantPreview.theme, navigation: assistantPreview.navigation, pages: assistantPreview.pages } : draftSite),
    [assistantPreview, draftSite, props.site],
  );
  // La preview se actualiza con prioridad baja: los controles nunca se traban.
  const previewSite = useDeferredValue(shownSite);

  const save = () => {
    const saved = { theme: state.theme, navigation: state.navigation, pages: state.pages, deletedPageIds: state.deletedPageIds };
    return run(
      () =>
        saveSite({
          theme: state.dirty.theme ? saved.theme : undefined,
          navigation: state.dirty.navigation ? saved.navigation : undefined,
          pages: state.dirty.pages ? saved.pages.map((p) => ({ ...p, slug: slugify(p.slug, 60) || 'pagina' })) : undefined,
          deletedPageIds: saved.deletedPageIds,
        }),
      {
        onSuccess: () => {
          dispatch({ type: 'saved', saved });
          router.refresh();
        },
      },
    );
  };

  const discard = async () => {
    const ok = await confirm({ title: t('¿Descartar los cambios?'), description: t('Se perderán los cambios que no guardaste.'), confirmLabel: t('Descartar'), destructive: true });
    if (ok) dispatch({ type: 'reset', state: initialState(props) });
  };

  const left = (
    <Paper variant="outlined" sx={{ px: 2, pb: 3, height: { lg: '100%' }, overflowY: { lg: 'auto' } }}>
      <Tabs value={state.panel} onChange={(_, panel) => dispatch({ type: 'setPanel', panel })} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
        <Tab value="pages" label={t('Páginas')} />
        <Tab value="navigation" label={t('Navegación')} />
        <Tab value="design" label={t('Diseño')} />
      </Tabs>
      {state.panel === 'pages' &&
        (state.selectedSectionId ? <SectionEditor site={draftSite} /> : state.editingPageSettings ? <PageSettings baseUrl={props.site.url} /> : <PagesPanel />)}
      {state.panel === 'navigation' && <NavigationPanel />}
      {state.panel === 'design' && <DesignPanel identity={props.identity} initialTab={props.initialDesignTab} />}
    </Paper>
  );

  const notice = props.isStarter
    ? t('Preparamos un sitio inicial para ti. Revísalo y guarda para crearlo.')
    : props.usesSampleItems
      ? t('Mostrando productos de ejemplo: aparecerán los tuyos cuando los agregues.')
      : null;

  const preview = (
    <BuilderPreview
      site={previewSite}
      pageId={shown.selectedPageId}
      selectedSectionId={shown.selectedSectionId}
      device={device}
      onDevice={setDevice}
      onNavigate={(pageId) => dispatch({ type: 'selectPage', pageId })}
      onSelectSection={(sectionId) => !assistantPreview && dispatch({ type: 'selectSection', sectionId })}
      notice={notice}
      banner={<GarfieldPreviewBanner />}
    />
  );

  return (
    <BuilderContext.Provider value={{ state, dispatch }}>
      <GarfieldProvider state={state} dispatch={dispatch} site={props.site} onPreview={setAssistantPreview} endpoint={props.assistantEndpoint}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: { lg: 'calc(100vh - 56px - 32px)' } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h1">{t('Editor del sitio')}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{t('Páginas, secciones, navegación y diseño. Los cambios se ven al instante.')}</Typography>
            </Box>
            {dirty && <Chip label={t('Cambios sin guardar')} color="warning" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
            <Button color="inherit" onClick={discard} disabled={!dirty || pending}>{t('Descartar')}</Button>
            <Button variant="contained" onClick={save} disabled={!dirty || pending || !props.canManage}>
              {pending ? t('Guardando…') : t('Guardar cambios')}
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
                <Tab value="edit" label={t('Editar')} />
                <Tab value="preview" label={t('Vista previa')} />
              </Tabs>
              {mobileView === 'edit' ? left : <Box sx={{ height: '78vh' }}>{preview}</Box>}
            </>
          )}
        </Box>
        {props.canManage && (
          <>
            <GarfieldLauncher />
            <GarfieldPanel />
          </>
        )}
      </GarfieldProvider>
    </BuilderContext.Provider>
  );
}
