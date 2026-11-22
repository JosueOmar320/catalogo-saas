'use client';

import { Box, Button, Paper, Slide, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useT } from '@/i18n/client';

type Props = {
  visible: boolean;
  saving: boolean;
  /** Sin onDiscard no se muestra «Descartar» (p. ej. al crear, cuando aún no hay nada que descartar). */
  onDiscard?: () => void;
  onSave?: () => void;
  /** Si el botón guardar es submit de un <form>, indicar su id. */
  formId?: string;
  label?: string;
  /** Texto del botón principal («Guardar» por defecto; «Crear» al dar de alta). */
  saveLabel?: string;
  /** Acción secundaria junto al botón principal (p. ej. «Guardar y agregar otro»). */
  extra?: ReactNode;
};

/** Barra fija inferior que aparece cuando hay cambios sin guardar. */
export function SaveBar({ visible, saving, onDiscard, onSave, formId, label, saveLabel, extra }: Props) {
  const t = useT();
  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Box sx={{ position: 'fixed', bottom: 16, left: { xs: 16, md: 'calc(248px + 16px)' }, right: 16, zIndex: 1200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <Paper
          variant="outlined"
          sx={{ pointerEvents: 'auto', px: 2, py: 1.25, bgcolor: 'secondary.main', color: 'secondary.contrastText', borderColor: 'secondary.main', width: '100%', maxWidth: 560 }}
        >
          <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{label ?? t('Tienes cambios sin guardar')}</Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', ml: 'auto' }}>
              {onDiscard && (
                <Button onClick={onDiscard} disabled={saving} sx={{ color: 'secondary.contrastText', opacity: 0.8 }}>
                  {t('Descartar')}
                </Button>
              )}
              {extra}
              <Button variant="contained" onClick={onSave} type={formId ? 'submit' : 'button'} form={formId} disabled={saving}>
                {saving ? t('Guardando…') : (saveLabel ?? t('Guardar'))}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Slide>
  );
}
