'use client';

import { Alert, Button, Stack } from '@mui/material';
import { Eye, LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { endDemo } from '@/features/demo/actions';
import { useT } from '@/i18n/client';

/** Aviso fijo arriba del panel en la cuenta de prueba: qué es y cuándo se borra. */
export function DemoBanner({ hoursLeft }: { hoursLeft: number }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Alert
      severity="info"
      variant="outlined"
      sx={{ mb: 2.5, alignItems: 'center', '& .MuiAlert-action': { pt: 0 } }}
      action={
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Lo que vale la pena hacer en la prueba va primero; salir es la acción terciaria. */}
          <Button color="inherit" size="small" variant="outlined" startIcon={<Eye size={15} />} href="/preview" target="_blank">
            {t('Ver como cliente')}
          </Button>
          <Button color="inherit" size="small" startIcon={<LogOut size={15} />} disabled={pending} onClick={() => startTransition(() => endDemo())} sx={{ opacity: 0.85 }}>
            {t('Salir y borrar')}
          </Button>
        </Stack>
      }
    >
      <strong>{t('Cuenta de prueba.')}</strong>{' '}
      {hoursLeft < 1
        ? t('Cambia lo que quieras: nada de esto es público y se borra en menos de una hora.')
        : t('Cambia lo que quieras: nada de esto es público y se borra en {hours} h.', { hours: hoursLeft })}
    </Alert>
  );
}
