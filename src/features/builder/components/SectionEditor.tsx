'use client';

import { Box, IconButton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowLeft, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Section, SectionType } from '@/lib/site/section-schemas';
import { SECTION_META } from '@/lib/site/section-registry';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Icon } from '@/site-renderer/Icon';
import { useBuilder, useSelectedPage } from '../state';
import { CONTENT_EDITORS, type EditorProps } from './editors/content-editors';
import { StyleEditor } from './editors/StyleEditor';

/** Panel de edición de una sección: Contenido | Estilo. */
export function SectionEditor({ site }: { site: SiteViewModel }) {
  const { state, dispatch } = useBuilder();
  const page = useSelectedPage();
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const section = page.sections.find((s) => s.id === state.selectedSectionId);
  if (!section) return null;
  const meta = SECTION_META[section.type];
  const update = (next: Section) => dispatch({ type: 'updateSection', section: next });
  const Editor = CONTENT_EDITORS[section.type] as React.ComponentType<EditorProps<SectionType>>;

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pt: 1.5 }}>
        <IconButton onClick={() => dispatch({ type: 'selectSection', sectionId: null })} aria-label="Volver a las secciones">
          <ArrowLeft size={16} />
        </IconButton>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>
          <Icon id={meta.icon} size={16} />
        </Box>
        <Typography variant="h3" sx={{ flex: 1 }} noWrap>{meta.label}</Typography>
        <Tooltip title={section.visible ? 'Ocultar sección' : 'Mostrar sección'}>
          <IconButton onClick={() => update({ ...section, visible: !section.visible })} aria-label="Visibilidad">
            {section.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Duplicar">
          <IconButton onClick={() => dispatch({ type: 'duplicateSection', sectionId: section.id })} aria-label="Duplicar"><Copy size={16} /></IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton onClick={() => dispatch({ type: 'removeSection', sectionId: section.id })} aria-label="Eliminar"><Trash2 size={16} /></IconButton>
        </Tooltip>
      </Stack>
      <TextField
        size="small"
        placeholder={`Nombre interno (ej. "${meta.label} de verano")`}
        value={section.name}
        onChange={(e) => update({ ...section, name: e.target.value.slice(0, 60) })}
        sx={{ mt: 1 }}
        slotProps={{ htmlInput: { 'aria-label': 'Nombre interno de la sección' } }}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="content" label="Contenido" />
        <Tab value="style" label="Estilo" />
      </Tabs>
      {tab === 'content' ? (
        <Editor section={section} onChange={update} pages={state.pages} site={site} />
      ) : (
        <StyleEditor section={section} onChange={update} />
      )}
    </Box>
  );
}
