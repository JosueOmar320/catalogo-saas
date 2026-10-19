'use client';

import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { getPreset } from '@/lib/design/presets';
import { applySiteTemplate, SITE_TEMPLATE_IDS, SITE_TEMPLATES, type SiteTemplateId } from '@/lib/site/templates';
import { useBuilder } from '../state';
import { useT } from '@/i18n/client';

/**
 * Plantillas de sitio: tema + páginas + secciones con textos de ejemplo.
 * "Reemplazar" deja el sitio sólo con las páginas de la plantilla (se aplica
 * al guardar; se puede descartar); "Agregar" suma las páginas que falten.
 */
export function SiteTemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { state, dispatch } = useBuilder();
  const [selected, setSelected] = useState<SiteTemplateId>('restaurant');
  const [mode, setMode] = useState<'replace' | 'add'>('replace');
  const [topic, setTopic] = useState('');
  const [keepTheme, setKeepTheme] = useState(false);

  const apply = () => {
    const result = applySiteTemplate({ theme: state.theme, pages: state.pages, navigation: state.navigation }, selected, { mode, topic, keepTheme });
    const removed = result.removedPageIds.filter((id) => state.persistedPageIds.includes(id));
    const home = result.pages.find((p) => p.isHome) ?? result.pages[0];
    dispatch({
      type: 'reset',
      state: {
        ...state,
        theme: result.theme,
        pages: result.pages,
        navigation: result.navigation,
        deletedPageIds: [...new Set([...state.deletedPageIds, ...removed])],
        selectedPageId: mode === 'add' ? state.selectedPageId : home.id,
        selectedSectionId: null,
        dirty: { theme: !keepTheme || state.dirty.theme, navigation: true, pages: true },
      },
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('Plantillas de sitio')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('Cada plantilla combina un diseño, páginas y secciones con textos de ejemplo. Todo queda editable (y también se lo puedes pedir a Garfield).')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.25 }} role="radiogroup" aria-label={t('Plantillas')}>
          {SITE_TEMPLATE_IDS.map((id) => {
            const template = SITE_TEMPLATES[id];
            const preset = getPreset(template.preset);
            const active = id === selected;
            return (
              <ButtonBase
                key={id}
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(id)}
                sx={{ display: 'block', textAlign: 'left', borderRadius: 2, border: 1, borderColor: active ? 'primary.main' : 'divider', boxShadow: active ? (th) => `0 0 0 2px ${th.palette.primary.main}` : 'none', overflow: 'hidden' }}
              >
                <Stack direction="row" sx={{ height: 34 }}>
                  {[preset.theme.colors?.primary, preset.theme.colors?.accent, preset.theme.colors?.background, preset.theme.colors?.text].map((c, i) => <Box key={i} sx={{ flex: 1, bgcolor: c ?? '#ddd' }} />)}
                </Stack>
                <Box sx={{ p: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{t(template.label)}</Typography>
                  <Typography variant="caption" color="text.secondary" component="p">{t(template.description)}</Typography>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>{template.pages.length === 1 ? t('1 página · tema {theme}', { theme: t(preset.name) }) : t('{count} páginas · tema {theme}', { count: template.pages.length, theme: t(preset.name) })}</Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
        <Stack spacing={1.5} sx={{ mt: 2.5 }}>
          <TextField size="small" label={t('¿De qué es tu negocio? (opcional)')} placeholder={t('Ej. cafetería de especialidad')} value={topic} onChange={(e) => setTopic(e.target.value)} helperText={t('Ajusta algunos textos de ejemplo.')} />
          <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'add')}>
            <FormControlLabel value="replace" control={<Radio size="small" />} label={t('Reemplazar mi sitio')} />
            <FormControlLabel value="add" control={<Radio size="small" />} label={t('Sólo agregar las páginas que falten')} />
          </RadioGroup>
          <FormControlLabel control={<Switch size="small" checked={keepTheme} onChange={(e) => setKeepTheme(e.target.checked)} />} label={t('Conservar mi diseño actual (colores y tipografía)')} />
          {mode === 'replace' && <Alert severity="warning">{t('Las páginas actuales se reemplazan. Nada se guarda hasta pulsar «Guardar cambios», y puedes «Descartar».')}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>{t('Cancelar')}</Button>
        <Button variant="contained" onClick={apply}>{t('Usar plantilla')}</Button>
      </DialogActions>
    </Dialog>
  );
}
