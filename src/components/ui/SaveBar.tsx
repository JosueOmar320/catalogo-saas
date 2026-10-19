'use client';

import { Box, Button, Paper, Slide, Stack, Typography } from '@mui/material';
import { useT } from '@/i18n/client';

type Props = {
  visible: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave?: () => void;
  /** Si el botón guardar es submit de un <form>, indicar su id. */
  formId?: string;
  label?: string;
};

/** Barra fija inferior que aparece cuando hay cambios sin guardar. */
export function SaveBar({ visible, saving, onDiscard, onSave, formId, label }: Props) {
  const t = useT();
  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Box sx={{ position: 'fixed', bottom: 16, left: { xs: 16, md: 'calc(248px + 16px)' }, right: 16, zIndex: 1200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <Paper
          variant="outlined"
          sx={{ pointerEvents: 'auto', px: 2, py: 1.25, bgcolor: 'secondary.main', color: 'secondary.contrastText', borderColor: 'secondary.main', width: '100%', maxWidth: 560 }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{label ?? t('Tienes cambios sin guardar')}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={onDiscard} disabled={saving} sx={{ color: 'secondary.contrastText', opacity: 0.8 }}>
                {t('Descartar')}
              </Button>
              <Button variant="contained" onClick={onSave} type={formId ? 'submit' : 'button'} form={formId} disabled={saving}>
                {saving ? t('Guardando…') : t('Guardar')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Slide>
  );
}
