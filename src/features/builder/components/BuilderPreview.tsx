'use client';

import { Box, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, IconButton, Alert } from '@mui/material';
import { ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useEffect, useRef, type MouseEvent } from 'react';
import type { SiteViewModel } from '@/lib/site/view-model';
import { SiteView } from '@/site-renderer';

export type Device = 'desktop' | 'tablet' | 'mobile';
const WIDTH: Record<Device, number | '100%'> = { desktop: '100%', tablet: 820, mobile: 390 };

type Props = {
  site: SiteViewModel;
  pageId: string;
  selectedSectionId: string | null;
  device: Device;
  onDevice: (device: Device) => void;
  onNavigate: (pageId: string) => void;
  onSelectSection: (sectionId: string) => void;
  notice?: string | null;
  /** Aviso extra sobre la preview (p. ej. vista previa de Garfield). */
  banner?: React.ReactNode;
};

/**
 * Preview en vivo: el MISMO renderer del sitio público. Los clics en el menú
 * navegan entre páginas dentro del editor; un clic en una sección la abre
 * en el panel de edición. Container queries → tablet y móvil reales.
 */
export function BuilderPreview({ site, pageId, selectedSectionId, device, onDevice, onNavigate, onSelectSection, notice, banner }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];

  useEffect(() => {
    if (!selectedSectionId) return;
    frame.current?.querySelector(`[data-section-id="${selectedSectionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedSectionId]);

  useEffect(() => {
    frame.current?.scrollTo({ top: 0 });
  }, [pageId]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      event.preventDefault();
      const id = anchor.getAttribute('data-page-id');
      if (id && site.pages.some((p) => p.id === id)) onNavigate(id);
      return;
    }
    if (target.closest('button, input, label, iframe')) return;
    const section = target.closest('[data-section-id]');
    if (section) onSelectSection(section.getAttribute('data-section-id')!);
  };

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <TextField select size="small" value={page.id} onChange={(e) => onNavigate(e.target.value)} sx={{ width: 220 }} slotProps={{ htmlInput: { 'aria-label': 'Página en la vista previa' } }}>
          {site.pages.map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.title}{p.isHome ? ' (inicio)' : ''}{p.isPublished ? '' : ' · oculta'}</MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={device} onChange={(_, v) => v && onDevice(v)} aria-label="Dispositivo">
          <ToggleButton value="desktop" aria-label="Escritorio" sx={{ px: 1 }}><Monitor size={15} /></ToggleButton>
          <ToggleButton value="tablet" aria-label="Tablet" sx={{ px: 1 }}><Tablet size={15} /></ToggleButton>
          <ToggleButton value="mobile" aria-label="Móvil" sx={{ px: 1 }}><Smartphone size={15} /></ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title="Abrir vista previa guardada en otra pestaña">
          <IconButton href={page.isHome ? '/preview' : `/preview/${page.slug}`} target="_blank" aria-label="Abrir vista previa"><ExternalLink size={16} /></IconButton>
        </Tooltip>
      </Stack>
      {banner}
      {notice && <Alert severity="info" sx={{ mb: 1.5, py: 0 }}>{notice}</Alert>}
      <Box sx={{ flex: 1, minHeight: 0, bgcolor: '#E9E9EE', borderRadius: 2, p: device === 'desktop' ? 0 : 2, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <Box
          ref={frame}
          onClickCapture={handleClick}
          sx={{
            width: WIDTH[device],
            maxWidth: '100%',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: 'background.paper',
            borderRadius: device === 'mobile' ? 5 : 2,
            border: 1,
            borderColor: 'divider',
            transition: 'width .2s ease',
            '& [data-section-id]': { cursor: 'pointer' },
            '& [data-section-id]:hover': { outline: '2px dashed rgba(47,84,214,.55)', outlineOffset: '-2px' },
            ...(selectedSectionId ? { [`& [data-section-id="${selectedSectionId}"]`]: { outline: '2px solid #2F54D6', outlineOffset: '-2px' } } : {}),
          }}
        >
          <SiteView site={site} page={page} env={{ mode: 'preview', basePath: '/preview', currentPageId: page.id }} />
        </Box>
      </Box>
    </Stack>
  );
}
