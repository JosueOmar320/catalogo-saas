'use client';

import { Box, Button, ButtonBase, Chip, Divider, IconButton, ListItemIcon, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { Copy, Eye, EyeOff, Home, LayoutTemplate, MoreHorizontal, Plus, Settings2, Trash2, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { SortableList } from '@/components/ui/SortableList';
import { artDirect } from '@/lib/site/art-direction';
import { newPage } from '@/lib/site/pages';
import { withBrandGradients } from '@/lib/site/resolve';
import { SECTION_GROUPS, SECTION_META } from '@/lib/site/section-registry';
import { createSection, SECTION_TYPES, type Section } from '@/lib/site/section-schemas';
import { PAGE_BLUEPRINTS } from '@/lib/site/starter';
import { Icon } from '@/site-renderer/Icon';
import { useOptionalGarfield } from '@/features/assistant/components/GarfieldProvider';
import { GarfieldHint } from '@/features/assistant/components/GarfieldPanel';
import { useBuilder, useSelectedPage } from '../state';
import { SiteTemplatesDialog } from './SiteTemplatesDialog';
import { TemplateList } from './SectionTemplates';
import { useT } from '@/i18n/client';

/** Lista de páginas + secciones de la página seleccionada. */
export function PagesPanel() {
  const t = useT();
  const { state, dispatch } = useBuilder();
  const page = useSelectedPage();
  const confirm = useConfirm();
  const [menu, setMenu] = useState<{ anchor: HTMLElement; pageId: string } | null>(null);
  const [adding, setAdding] = useState<'page' | 'section' | null>(null);
  const [templates, setTemplates] = useState(false);
  const [polish, setPolish] = useState<HTMLElement | null>(null);
  const garfield = useOptionalGarfield();
  const navVisible = (pageId: string) => state.navigation.items.some((i) => i.kind === 'page' && i.pageId === pageId && i.visible);

  const removePage = async (pageId: string) => {
    setMenu(null);
    const target = state.pages.find((p) => p.id === pageId);
    const ok = await confirm({ title: t('¿Eliminar la página "{title}"?', { title: target?.title ?? '' }), description: t('Se quitará también del menú. Se aplica al guardar.'), confirmLabel: t('Eliminar'), destructive: true });
    if (ok) dispatch({ type: 'removePage', pageId });
  };

  return (
    <Box sx={{ pt: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="overline" color="text.secondary">{t('Páginas')}</Typography>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" color="inherit" startIcon={<LayoutTemplate size={14} />} onClick={() => setTemplates(true)}>{t('Plantillas')}</Button>
          <Button size="small" startIcon={<Plus size={14} />} onClick={() => setAdding(adding === 'page' ? null : 'page')}>{t('Nueva página')}</Button>
        </Stack>
      </Stack>
      <SiteTemplatesDialog open={templates} onClose={() => setTemplates(false)} />

      {adding === 'page' && (
        <Box sx={{ mb: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
          {garfield && (
            <Box sx={{ mb: 1 }}>
              <GarfieldHint text={t('O descríbela y Garfield la crea completa: «una página de servicios para mi empresa de limpieza».')} prompt="Créame una página nueva para mi negocio" action={t('Crear con Garfield')} />
            </Box>
          )}
          <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }}>{t('Elige un punto de partida')}</Typography>
            <IconButton size="small" onClick={() => setAdding(null)} aria-label={t('Cerrar')}><X size={14} /></IconButton>
          </Stack>
          {PAGE_BLUEPRINTS.map((bp) => (
            <ButtonBase
              key={bp.template + bp.title}
              onClick={() => {
                dispatch({ type: 'addPage', page: newPage(bp.title, bp.slug, withBrandGradients(bp.sections(), state.theme), bp.template), showInNav: true });
                setAdding(null);
              }}
              sx={{ display: 'block', width: '100%', textAlign: 'left', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(bp.title)}</Typography>
              <Typography variant="caption" color="text.secondary">{t(bp.description)}</Typography>
            </ButtonBase>
          ))}
        </Box>
      )}

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
        <SortableList
          items={state.pages}
          getId={(p) => p.id}
          onReorder={(next) => dispatch({ type: 'reorderPages', ids: next.map((p) => p.id) })}
          renderItem={(p) => (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <ButtonBase
                onClick={() => dispatch({ type: 'selectPage', pageId: p.id })}
                sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1, py: 0.5, px: 0.5, borderRadius: 1, bgcolor: p.id === page.id ? 'primary.light' : 'transparent' }}
              >
                {p.isHome ? <Home size={14} /> : <Box sx={{ width: 14 }} />}
                <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: p.id === page.id ? 700 : 500, color: p.isPublished ? 'text.primary' : 'text.disabled' }}>{p.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    /{p.isHome ? '' : p.slug}
                    {!p.isPublished && ` · ${t('oculta')}`}
                    {p.isPublished && !navVisible(p.id) && ` · ${t('fuera del menú')}`}
                  </Typography>
                </Box>
              </ButtonBase>
              <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, pageId: p.id })} aria-label={t('Opciones de {title}', { title: p.title })}>
                <MoreHorizontal size={15} />
              </IconButton>
            </Stack>
          )}
        />
      </Box>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu && [
          <MenuItem key="settings" onClick={() => { dispatch({ type: 'selectPage', pageId: menu.pageId }); dispatch({ type: 'editPageSettings', open: true }); setMenu(null); }}>
            <ListItemIcon><Settings2 size={15} /></ListItemIcon>{t('Configurar página')}
          </MenuItem>,
          <MenuItem key="home" disabled={state.pages.find((p) => p.id === menu.pageId)?.isHome} onClick={() => { dispatch({ type: 'setHome', pageId: menu.pageId }); setMenu(null); }}>
            <ListItemIcon><Home size={15} /></ListItemIcon>{t('Usar como inicio')}
          </MenuItem>,
          <MenuItem key="pub" disabled={state.pages.find((p) => p.id === menu.pageId)?.isHome} onClick={() => { const p = state.pages.find((x) => x.id === menu.pageId)!; dispatch({ type: 'updatePage', pageId: p.id, patch: { isPublished: !p.isPublished } }); setMenu(null); }}>
            <ListItemIcon>{state.pages.find((p) => p.id === menu.pageId)?.isPublished ? <EyeOff size={15} /> : <Eye size={15} />}</ListItemIcon>
            {state.pages.find((p) => p.id === menu.pageId)?.isPublished ? t('Ocultar página') : t('Activar página')}
          </MenuItem>,
          <MenuItem key="dup" onClick={() => { dispatch({ type: 'duplicatePage', pageId: menu.pageId }); setMenu(null); }}>
            <ListItemIcon><Copy size={15} /></ListItemIcon>{t('Duplicar')}
          </MenuItem>,
          <MenuItem key="del" disabled={state.pages.length <= 1} onClick={() => void removePage(menu.pageId)} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={15} /></ListItemIcon>{t('Eliminar')}
          </MenuItem>,
        ]}
      </Menu>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">{t('Secciones')}</Typography>
          <Typography variant="caption" color="text.secondary" component="p" noWrap>{t('de «{title}»', { title: page.title })}</Typography>
        </Box>
        <Stack direction="row">
          <Tooltip title={t('Darle más diseño a la página (fondos alternados, bandas de color, divisores)')}>
            <IconButton onClick={(e) => setPolish(e.currentTarget)} aria-label={t('Mejorar diseño de la página')}><Wand2 size={16} /></IconButton>
          </Tooltip>
          <Menu anchorEl={polish} open={Boolean(polish)} onClose={() => setPolish(null)}>
            {(['subtle', 'balanced', 'bold'] as const).map((intensity) => (
              <MenuItem
                key={intensity}
                onClick={() => {
                  setPolish(null);
                  const sections = artDirect(page.sections, state.theme, intensity);
                  dispatch({ type: 'reset', state: { ...state, pages: state.pages.map((p) => (p.id === page.id ? { ...p, sections } : p)), dirty: { ...state.dirty, pages: true } } });
                }}
                sx={{ whiteSpace: 'normal', maxWidth: 300 }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{{ subtle: t('Sutil'), balanced: t('Equilibrado'), bold: t('Llamativo') }[intensity]}</Typography>
                  <Typography variant="caption" color="text.secondary">{{ subtle: t('Pocos cambios: fondos suaves en beneficios y opiniones.'), balanced: t('Alterna fondos suaves y bandas de color de marca.'), bold: t('Además degradados, divisores con ondas y parallax.') }[intensity]}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>
          <Tooltip title={t('Configurar página (URL, fondo, SEO)')}>
            <IconButton onClick={() => dispatch({ type: 'editPageSettings', open: true })} aria-label={t('Configurar página')}><Settings2 size={16} /></IconButton>
          </Tooltip>
          <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setAdding(adding === 'section' ? null : 'section')}>{t('Sección')}</Button>
        </Stack>
      </Stack>

      {adding === 'section' && (
        <SectionPicker
          onPick={(section) => {
            dispatch({ type: 'addSection', section });
            setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {page.sections.length === 0 ? (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1.5 }}>
            {t('Esta página está vacía. Agrega tu primera sección.')}
          </Typography>
          {garfield && <GarfieldHint text={t('¿La armo por ti? Dime de qué trata o déjame proponer una estructura.')} prompt={`Arma la página «${page.title}» completa con las secciones adecuadas para mi negocio`} action={t('Pedirle a Garfield que la arme')} />}
        </Stack>
      ) : (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          <SortableList
            items={page.sections}
            getId={(s) => s.id}
            onReorder={(next) => dispatch({ type: 'reorderSections', ids: next.map((s) => s.id) })}
            renderItem={(section) => {
              const meta = SECTION_META[section.type];
              const title = section.name || ('title' in section.content && section.content.title) || t(meta.label);
              return (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <ButtonBase onClick={() => dispatch({ type: 'selectSection', sectionId: section.id })} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1, py: 0.5, px: 0.5, borderRadius: 1, opacity: section.visible ? 1 : 0.45 }}>
                    <Box sx={{ color: 'primary.main', display: 'flex' }}><Icon id={meta.icon} size={16} /></Box>
                    <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{title}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="p">{t(meta.label)}{section.style.background.type !== 'inherit' ? ` · ${t('fondo propio')}` : ''}</Typography>
                    </Box>
                  </ButtonBase>
                  <Tooltip title={section.visible ? t('Ocultar') : t('Mostrar')}>
                    <IconButton size="small" onClick={() => dispatch({ type: 'updateSection', section: { ...section, visible: !section.visible } })} aria-label={t('Visibilidad')}>
                      {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              );
            }}
          />
        </Box>
      )}
      {page.sections.some((s) => !s.visible) && (
        <Chip size="small" label={t('Las secciones ocultas no se publican')} sx={{ mt: 1 }} />
      )}
    </Box>
  );
}

function SectionPicker({ onPick, onClose }: { onPick: (section: Section) => void; onClose: () => void }) {
  const t = useT();
  return (
    <Box sx={{ mb: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }}>{t('Agregar sección')}</Typography>
        <IconButton size="small" onClick={onClose} aria-label={t('Cerrar')}><X size={14} /></IconButton>
      </Stack>
      <TemplateList onPick={onPick} />
      {SECTION_GROUPS.map((group) => (
        <Box key={group} sx={{ mt: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>{t(group)}</Typography>
          {SECTION_TYPES.filter((st) => SECTION_META[st].group === group).map((type) => (
            <ButtonBase key={type} onClick={() => onPick(createSection(type))} sx={{ display: 'flex', gap: 1.25, width: '100%', textAlign: 'left', alignItems: 'flex-start', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
              <Box sx={{ color: 'primary.main', mt: 0.25, display: 'flex' }}><Icon id={SECTION_META[type].icon} size={18} /></Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(SECTION_META[type].label)}</Typography>
                <Typography variant="caption" color="text.secondary">{t(SECTION_META[type].description)}</Typography>
              </Box>
            </ButtonBase>
          ))}
        </Box>
      ))}
    </Box>
  );
}
