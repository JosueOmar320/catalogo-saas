'use client';

import { Box, IconButton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowLeft, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Section, SectionType } from '@/lib/site/section-schemas';
import { SECTION_META } from '@/lib/site/section-registry';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Icon } from '@/site-renderer/Icon';
import { GarfieldAvatar } from '@/features/assistant/components/GarfieldAvatar';
import { useOptionalGarfield } from '@/features/assistant/components/GarfieldProvider';
import { useBuilder, useSelectedPage } from '../state';
import { CONTENT_EDITORS, type EditorProps } from './editors/content-editors';
import { StyleEditor } from './editors/StyleEditor';
import { useT } from '@/i18n/client';

/** Panel de edición de una sección: Contenido | Estilo. */
export function SectionEditor({ site }: { site: SiteViewModel }) {
  const t = useT();
  const { state, dispatch } = useBuilder();
  const page = useSelectedPage();
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const garfield = useOptionalGarfield();
  const section = page.sections.find((s) => s.id === state.selectedSectionId);
  if (!section) return null;
  const meta = SECTION_META[section.type];
  const update = (next: Section) => dispatch({ type: 'updateSection', section: next });
  const Editor = CONTENT_EDITORS[section.type] as React.ComponentType<EditorProps<SectionType>>;

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pt: 1.5 }}>
        <IconButton onClick={() => dispatch({ type: 'selectSection', sectionId: null })} aria-label={t('Volver a las secciones')}>
          <ArrowLeft size={16} />
        </IconButton>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>
          <Icon id={meta.icon} size={16} />
        </Box>
        <Typography variant="h3" sx={{ flex: 1 }} noWrap>{t(meta.label)}</Typography>
        <Tooltip title={section.visible ? t('Ocultar sección') : t('Mostrar sección')}>
          <IconButton onClick={() => update({ ...section, visible: !section.visible })} aria-label={t('Visibilidad')}>
            {section.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconButton>
        </Tooltip>
        {garfield && (
          <Tooltip title={t('Pedir cambios a Garfield')}>
            <IconButton onClick={() => garfield.setOpen(true)} aria-label={t('Pedir cambios a Garfield')} sx={{ p: 0.5 }}>
              <GarfieldAvatar size={24} ring={false} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={t('Duplicar')}>
          <IconButton onClick={() => dispatch({ type: 'duplicateSection', sectionId: section.id })} aria-label={t('Duplicar')}><Copy size={16} /></IconButton>
        </Tooltip>
        <Tooltip title={t('Eliminar')}>
          <IconButton onClick={() => dispatch({ type: 'removeSection', sectionId: section.id })} aria-label={t('Eliminar')}><Trash2 size={16} /></IconButton>
        </Tooltip>
      </Stack>
      <TextField
        size="small"
        placeholder={t('Nombre interno (ej. "{section} de verano")', { section: t(meta.label) })}
        value={section.name}
        onChange={(e) => update({ ...section, name: e.target.value.slice(0, 60) })}
        sx={{ mt: 1 }}
        slotProps={{ htmlInput: { 'aria-label': t('Nombre interno de la sección') } }}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="content" label={t('Contenido')} />
        <Tab value="style" label={t('Estilo')} />
      </Tabs>
      {tab === 'content' ? (
        <Editor section={section} onChange={update} pages={state.pages} site={site} />
      ) : (
        <StyleEditor section={section} onChange={update} />
      )}
    </Box>
  );
}
