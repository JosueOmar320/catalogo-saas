'use client';

import { Alert, Button } from '@mui/material';
import { LogOut } from 'lucide-react';
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
      sx={{ mb: 2.5, alignItems: 'center' }}
      action={
        <Button color="inherit" size="small" startIcon={<LogOut size={15} />} disabled={pending} onClick={() => startTransition(() => endDemo())}>
          {t('Salir y borrar')}
        </Button>
      }
    >
      <strong>{t('Cuenta de prueba.')}</strong>{' '}
      {hoursLeft < 1
        ? t('Cambia lo que quieras: nada de esto es público y se borra en menos de una hora.')
        : t('Cambia lo que quieras: nada de esto es público y se borra en {hours} h.', { hours: hoursLeft })}
    </Alert>
  );
}
