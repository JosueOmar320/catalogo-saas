'use client';

import { Box, Button, Paper, Stack, Switch, Typography } from '@mui/material';
import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { vapidKeyBytes } from '@/lib/push/core';
import { removePushSubscription, savePushSubscription, sendTestNotification } from '../actions';

type Status = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const SCOPE = '/dashboard/';
/** Último endpoint registrado desde este dispositivo: se vuelve a registrar sólo si cambió. */
const REGISTERED_KEY = 'vitrina:push-endpoint';

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SCOPE)) ?? navigator.serviceWorker.register('/sw.js', { scope: SCOPE });
}

const readRegistered = () => {
  try {
    return window.localStorage.getItem(REGISTERED_KEY);
  } catch {
    return null;
  }
};
const writeRegistered = (endpoint: string | null) => {
  try {
    if (endpoint) window.localStorage.setItem(REGISTERED_KEY, endpoint);
    else window.localStorage.removeItem(REGISTERED_KEY);
  } catch {
    /* sin almacenamiento (modo privado): se registra en la próxima visita */
  }
};

/**
 * «Avisos en este dispositivo»: una fila compacta bajo las pestañas de pedidos.
 * Cada usuario los activa en cada dispositivo (el navegador pide permiso) y
 * llegan aunque el panel esté cerrado. Sólo se muestra con push configurado.
 */
export function OrderAlertsCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  const t = useT();
  const { run, pending } = useAction();
  const [status, setStatus] = useState<Status>('loading');
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'ios-install' : 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      const subscription = await (await registration()).pushManager.getSubscription();
      if (!subscription) return 'off';
      setEndpoint(subscription.endpoint);
      // El dispositivo es de quien tiene la sesión abierta: se registra a su nombre si aún no se hizo (o cambió el endpoint).
      if (readRegistered() !== subscription.endpoint) {
        const result = await savePushSubscription(subscription.toJSON());
        if (result.ok) writeRegistered(subscription.endpoint);
      }
      return 'on';
    };
    check()
      .then((next) => !cancelled && setStatus(next))
      .catch(() => !cancelled && setStatus('unsupported'));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setStatus(permission === 'denied' ? 'denied' : 'off');
      const reg = await registration();
      const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(vapidPublicKey) }));
      const result = await run(() => savePushSubscription(subscription.toJSON()), { successToast: false });
      if (!result?.ok) return setError(t('No se pudieron activar los avisos. Intenta de nuevo.'));
      writeRegistered(subscription.endpoint);
      setEndpoint(subscription.endpoint);
      setStatus('on');
    } catch {
      // Falló el service worker o la suscripción (red, navegador): se avisa y el interruptor sigue disponible.
      setError(t('No se pudieron activar los avisos. Intenta de nuevo.'));
      setStatus('off');
    }
  };

  const disable = async () => {
    setError(null);
    const subscription = await (await registration()).pushManager.getSubscription().catch(() => null);
    const current = subscription?.endpoint ?? endpoint ?? '';
    await subscription?.unsubscribe().catch(() => false);
    void run(() => removePushSubscription(current), {
      successToast: false,
      onSuccess: () => {
        writeRegistered(null);
        setEndpoint(null);
        setStatus('off');
      },
    });
  };

  const blocked = status === 'loading' || status === 'unsupported' || status === 'ios-install' || status === 'denied';
  const helper = error
    ? error
    : status === 'ios-install'
      ? t('En iPhone, primero agrega el panel a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrelo desde ahí para activar los avisos.')
      : status === 'unsupported'
        ? t('Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizados.')
        : status === 'denied'
          ? t('Los avisos están bloqueados para este sitio. Permítelos en la configuración del navegador y vuelve a intentarlo.')
          : status === 'on'
            ? t('Activados en este dispositivo')
            : t('Recibe una notificación en este dispositivo en cuanto llega un pedido, aunque tengas el panel cerrado.');

  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ display: 'flex', color: status === 'on' ? 'success.main' : 'text.secondary' }} aria-hidden>
          <BellRing size={16} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} id="order-alerts-label">
            {t('Avisos en este dispositivo')}
          </Typography>
          <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'} component="p" role={error ? 'alert' : status === 'on' ? 'status' : undefined}>
            {helper}
          </Typography>
        </Box>
        {status === 'on' && (
          <Button size="small" color="inherit" disabled={pending || !endpoint} onClick={() => endpoint && void run(() => sendTestNotification(endpoint))} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            {t('Probar aviso')}
          </Button>
        )}
        <Switch
          size="small"
          checked={status === 'on'}
          disabled={pending || blocked}
          onChange={(event) => void (event.target.checked ? enable() : disable())}
          slotProps={{ input: { 'aria-labelledby': 'order-alerts-label' } }}
        />
      </Stack>
    </Paper>
  );
}
