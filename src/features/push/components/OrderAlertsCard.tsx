'use client';

import { Alert, Button, Stack, Typography } from '@mui/material';
import { BellOff, BellRing, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { vapidKeyBytes } from '@/lib/push/core';
import { removePushSubscription, savePushSubscription, sendTestNotification } from '../actions';

type Status = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const SCOPE = '/dashboard/';

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SCOPE)) ?? navigator.serviceWorker.register('/sw.js', { scope: SCOPE });
}

/**
 * "Avisos de pedidos": cada usuario los activa en cada dispositivo (el
 * navegador pide permiso). Llegan aunque el panel esté cerrado.
 */
export function OrderAlertsCard({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useT();
  const { run, pending } = useAction();
  const [status, setStatus] = useState<Status>('loading');
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'ios-install' : 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      const subscription = await (await registration()).pushManager.getSubscription();
      if (!subscription) return 'off';
      // El dispositivo es de quien tiene la sesión abierta: se vuelve a registrar a su nombre.
      setEndpoint(subscription.endpoint);
      void savePushSubscription(subscription.toJSON());
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
    if (!vapidPublicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return setStatus(permission === 'denied' ? 'denied' : 'off');
    const reg = await registration();
    const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(vapidPublicKey) }));
    void run(() => savePushSubscription(subscription.toJSON()), {
      onSuccess: () => {
        setEndpoint(subscription.endpoint);
        setStatus('on');
      },
    });
  };

  const disable = async () => {
    const subscription = await (await registration()).pushManager.getSubscription();
    const current = subscription?.endpoint ?? endpoint ?? '';
    await subscription?.unsubscribe().catch(() => false);
    void run(() => removePushSubscription(current), {
      onSuccess: () => {
        setEndpoint(null);
        setStatus('off');
      },
    });
  };

  return (
    <SectionCard title={t('Avisos de pedidos')} description={t('Recibe una notificación en este dispositivo en cuanto llega un pedido, aunque tengas el panel cerrado.')}>
      <Stack spacing={1.5}>
        {!vapidPublicKey ? (
          <Alert severity="info">{t('Los avisos todavía no están configurados en el servidor. Pídeselo al administrador de la plataforma.')}</Alert>
        ) : status === 'ios-install' ? (
          <Alert severity="info">{t('En iPhone, primero agrega el panel a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrelo desde ahí para activar los avisos.')}</Alert>
        ) : status === 'unsupported' ? (
          <Alert severity="info">{t('Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizados.')}</Alert>
        ) : status === 'denied' ? (
          <Alert severity="warning">{t('Los avisos están bloqueados para este sitio. Permítelos en la configuración del navegador y vuelve a intentarlo.')}</Alert>
        ) : status === 'on' ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Typography variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: 600, mr: 1 }} role="status">
              <BellRing size={16} aria-hidden /> {t('Activados en este dispositivo')}
            </Typography>
            <Button size="small" variant="outlined" startIcon={<Send size={14} />} disabled={pending || !endpoint} onClick={() => endpoint && void run(() => sendTestNotification(endpoint))}>
              {t('Probar aviso')}
            </Button>
            <Button size="small" color="inherit" startIcon={<BellOff size={14} />} disabled={pending} onClick={() => void disable()}>
              {t('Desactivar')}
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" startIcon={<BellRing size={16} />} disabled={pending || status === 'loading'} onClick={() => void enable()} sx={{ alignSelf: 'flex-start' }}>
            {t('Activar avisos en este dispositivo')}
          </Button>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('Cada persona del equipo los activa en sus dispositivos. El aviso dice el folio, el cliente y el total.')}
        </Typography>
      </Stack>
    </SectionCard>
  );
}
