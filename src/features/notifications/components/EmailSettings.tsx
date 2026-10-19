'use client';

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { Eye, Send } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { sendTestReviewEmail } from '../actions';

/** Vista previa del aviso semanal y envío de prueba al correo del administrador. */
export function EmailSettings({ previewHtml, subject, canSend }: { previewHtml: string; subject: string; canSend: boolean }) {
  const t = useT();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button variant="outlined" color="inherit" startIcon={<Eye size={14} />} onClick={() => setOpen(true)}>
          {t('Ver el correo de ejemplo')}
        </Button>
        <Button variant="contained" startIcon={<Send size={14} />} disabled={!canSend || pending} onClick={() => void run(() => sendTestReviewEmail())}>
          {pending ? t('Enviando…') : t('Enviarme una prueba')}
        </Button>
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{subject}</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {/* sandbox: el HTML del correo no ejecuta nada ni navega dentro del panel. */}
          <Box component="iframe" title={t('Vista previa del correo')} srcDoc={previewHtml} sandbox="" sx={{ display: 'block', width: '100%', height: 560, border: 0, bgcolor: '#f4f4f5' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('Cerrar')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
