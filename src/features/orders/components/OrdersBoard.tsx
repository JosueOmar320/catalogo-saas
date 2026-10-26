'use client';

import { Alert, Box, Button, Chip, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Download, MapPin, MessageCircle, MessageSquareText, ShoppingBag, Store, Trash2, Utensils } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { reviewInviteMessage } from '@/features/reviews/invite';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { useAction } from '@/lib/hooks/use-action';
import { customerWhatsappLink, FREQUENT_FROM, orderUpdateMessage } from '@/lib/orders/customers';
import { FULFILLMENT_LABELS, NEXT_STATUS, ORDER_RANGES, ORDER_STATUS_LABELS, ORDER_TABS, paymentLabel, type OrderTab } from '@/lib/orders/inbox';
import { formatPrice, formatRelative } from '@/lib/utils/format';
import type { OrderStatus } from '@/types/database';
import { changeOrderStatus, deleteOrder } from '../actions';
import type { PanelOrder } from '../inbox-queries';

const STATUS_COLOR: Record<OrderStatus, 'warning' | 'info' | 'primary' | 'success' | 'default'> = { new: 'warning', confirmed: 'info', ready: 'primary', delivered: 'success', cancelled: 'default' };
const FULFILLMENT_ICON = { pickup: Store, delivery: MapPin, table: Utensils } as const;
const RANGE_LABELS: Record<number, string> = { 1: msg('Hoy'), 7: msg('7 días'), 30: msg('30 días'), 90: msg('90 días') };
/** La lista se actualiza sola mientras la pestaña está a la vista. */
const REFRESH_MS = 30_000;

type Props = {
  tab: OrderTab;
  days: number;
  query: string;
  orders: PanelOrder[];
  newCount: number;
  enabled: boolean;
  canManage: boolean;
  locale: string;
  priceLocale: string;
  /** Momento del servidor (ms) para "hace 5 min": el mismo al renderizar y al hidratar. Se renueva con cada refresh. */
  now: number;
  /** Tope de filas de la consulta: al llegar a él se avisa que hay más. */
  pageSize: number;
  /** Con reseñas activas: enlace `?opinar` para pedirle una al cliente cuando recibe su pedido. */
  reviewInvite: { url: string; businessName: string } | null;
  businessName: string;
  /** WhatsApp del negocio: su lada completa el número del cliente si lo escribió sin ella. */
  businessWhatsapp: string;
  /** Pedidos (no cancelados) de cada cliente de la lista, por customer_key. */
  customerOrders: Record<string, number>;
};

export function OrdersBoard({ tab, days, query, orders: initial, newCount, enabled, canManage, locale, priceLocale, now, pageSize, reviewInvite, businessName, businessWhatsapp, customerOrders }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [orders, setOrders] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setOrders(initial);
  }
  const [search, setSearch] = useState(query);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `${pathname}?${params.toString()}`;
  };

  const setStatus = (order: PanelOrder, status: OrderStatus) => {
    const previous = orders;
    // Fuera de esta pestaña, el pedido sale de la lista; si no, cambia de estado aquí mismo.
    setOrders((list) => ((tab.statuses as readonly OrderStatus[]).includes(status) ? list.map((o) => (o.id === order.id ? { ...o, status } : o)) : list.filter((o) => o.id !== order.id)));
    void run(() => changeOrderStatus(order.id, status), { onSuccess: () => router.refresh() }).then((result) => {
      if (!result?.ok) setOrders(previous);
    });
  };

  const remove = async (order: PanelOrder) => {
    const ok = await confirm({ title: t('¿Borrar el pedido {reference}?', { reference: order.reference }), description: t('Se quita de la bandeja. Las estadísticas de pedidos no cambian.'), confirmLabel: t('Borrar'), destructive: true });
    if (ok) void run(() => deleteOrder(order.id), { onSuccess: () => setOrders((list) => list.filter((o) => o.id !== order.id)) });
  };

  const money = (order: PanelOrder, value: number | null) => (value === null ? '—' : formatPrice(Number(value), order.currency || 'MXN', priceLocale));

  return (
    <Stack spacing={2}>
      {!enabled && (
        <Alert severity="info" action={<Button component={Link} href="/dashboard/settings/pedidos" size="small">{t('Activar')}</Button>}>
          {t('La bandeja está apagada: los pedidos nuevos no se guardan aquí. Actívala en Configuración › Pedidos por WhatsApp.')}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
        <Tabs value={tab.slug} variant="scrollable" scrollButtons={false} sx={{ flex: 1, minHeight: 40 }}>
          {ORDER_TABS.map((item) => (
            <Tab
              key={item.slug}
              value={item.slug}
              component={Link}
              href={href({ estado: item.slug === 'nuevos' ? '' : item.slug })}
              label={item.slug === 'nuevos' && newCount > 0 ? `${t(item.label)} (${newCount})` : t(item.label)}
              sx={{ minHeight: 40 }}
            />
          ))}
        </Tabs>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField select size="small" label={t('Periodo')} value={days} onChange={(e) => router.push(href({ dias: e.target.value === '30' ? '' : e.target.value }))} sx={{ width: 130 }}>
            {ORDER_RANGES.map((range) => <MenuItem key={range} value={range}>{t(RANGE_LABELS[range])}</MenuItem>)}
          </TextField>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); router.push(href({ q: search.trim() })); }}>
            <TextField size="small" label={t('Buscar folio o nombre')} value={search} onChange={(e) => setSearch(e.target.value.slice(0, 60))} sx={{ width: 190 }} />
          </Box>
          <Tooltip title={t('Descargar CSV (Excel)')}>
            <IconButton component="a" href={`/api/orders/export?estado=${tab.slug}&dias=${days}`} aria-label={t('Descargar CSV (Excel)')}><Download size={18} /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={tab.slug === 'nuevos' ? t('No hay pedidos nuevos.') : t('No hay pedidos en este periodo.')} description={t('Cuando un cliente envíe su pedido por WhatsApp desde tu sitio, aparecerá aquí.')} />
      ) : (
        <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label={t('Pedidos')}>
          {orders.map((order) => {
            const next = NEXT_STATUS[order.status];
            const FulfillmentIcon = order.fulfillment ? FULFILLMENT_ICON[order.fulfillment] : null;
            const visits = order.customer_key ? (customerOrders[order.customer_key] ?? 0) : 0;
            const notify = customerWhatsappLink(order.customer_phone, businessWhatsapp, orderUpdateMessage(t, order.status, { name: order.customer_name, reference: order.reference, business: businessName }));
            const reviewText = reviewInvite && reviewInviteMessage(t, reviewInvite.businessName, reviewInvite.url);
            const reviewHref = reviewText && (customerWhatsappLink(order.customer_phone, businessWhatsapp, reviewText) ?? `https://wa.me/?text=${encodeURIComponent(reviewText)}`);
            const details = [
              order.fulfillment && `${t(FULFILLMENT_LABELS[order.fulfillment])}${order.zone ? ` · ${order.zone}` : ''}`,
              order.address,
              order.table_label && t('Mesa {table}', { table: order.table_label }),
              order.branch && t('Sucursal: {branch}', { branch: order.branch }),
              order.scheduled_for && t('Para: {when}', { when: order.scheduled_for }),
              order.payment && t('Pago: {method}', { method: paymentLabel(t, order.payment) }),
              order.coupon && t('Cupón: {code}', { code: order.coupon }),
            ].filter(Boolean);
            return (
              <Box component="li" key={order.id} aria-label={t('Pedido {reference}', { reference: order.reference })}>
              <SectionCard>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>#{order.reference}</Typography>
                    <Chip size="small" color={STATUS_COLOR[order.status]} label={t(ORDER_STATUS_LABELS[order.status])} />
                    {FulfillmentIcon && <FulfillmentIcon size={15} aria-hidden />}
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                      {order.customer_name || (order.personal_data_cleared ? t('Datos del cliente borrados (180 días)') : t('Sin nombre'))}
                      {order.customer_phone && ` · ${order.customer_phone}`} · {formatRelative(order.created_at, locale, now)}
                    </Typography>
                    {visits >= FREQUENT_FROM && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        component={Link}
                        href={`/dashboard/clientes?q=${encodeURIComponent(order.customer_phone ?? order.customer_name ?? '')}`}
                        clickable
                        label={t('Cliente frecuente · {count} pedidos', { count: visits })}
                      />
                    )}
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {money(order, order.total)}
                      {order.partial && <Typography component="span" variant="caption" color="text.secondary"> {t('+ por confirmar')}</Typography>}
                    </Typography>
                  </Stack>

                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {order.lines.map((line, index) => (
                      <Typography key={index} component="li" variant="body2">
                        {line.qty} × {line.name}
                        {line.unitPrice !== null && <Typography component="span" variant="body2" color="text.secondary"> — {money(order, line.unitPrice * line.qty)}</Typography>}
                        {line.note && <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('Nota: {note}', { note: line.note })}</Typography>}
                      </Typography>
                    ))}
                  </Box>

                  {Boolean(order.discount || order.delivery_fee || order.tip) && (
                    <Typography variant="caption" color="text.secondary">
                      {[order.subtotal !== null && t('Subtotal: {amount}', { amount: money(order, order.subtotal) }), order.discount && t('Descuento: −{amount}', { amount: money(order, order.discount) }), order.delivery_fee && t('Envío: {amount}', { amount: money(order, order.delivery_fee) }), order.tip && t('Propina: {amount}', { amount: money(order, order.tip) })].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                  {details.length > 0 && <Typography variant="body2">{details.join(' · ')}</Typography>}
                  {order.note && <Typography variant="body2" color="text.secondary">{t('Nota: {note}', { note: order.note })}</Typography>}

                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    {next && <Button size="small" variant="contained" disabled={pending} onClick={() => setStatus(order, next.status)}>{t(next.label)}</Button>}
                    {order.status !== 'cancelled' && order.status !== 'delivered' && <Button size="small" color="inherit" disabled={pending} onClick={() => setStatus(order, 'cancelled')}>{t('Cancelar pedido')}</Button>}
                    {(order.status === 'cancelled' || order.status === 'delivered') && <Button size="small" color="inherit" disabled={pending} onClick={() => setStatus(order, 'new')}>{t('Volver a nuevo')}</Button>}
                    {notify && order.status !== 'delivered' && (
                      <Button size="small" color="inherit" startIcon={<MessageCircle size={14} />} href={notify} target="_blank" rel="noopener noreferrer">
                        {t('Avisar por WhatsApp')}
                      </Button>
                    )}
                    {order.status === 'delivered' && reviewHref && (
                      <Button size="small" color="inherit" startIcon={<MessageSquareText size={14} />} href={reviewHref} target="_blank" rel="noopener noreferrer">
                        {t('Pedir reseña')}
                      </Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    {canManage && (
                      <IconButton size="small" onClick={() => void remove(order)} aria-label={t('Borrar el pedido {reference}', { reference: order.reference })}><Trash2 size={16} /></IconButton>
                    )}
                  </Stack>
                </Stack>
              </SectionCard>
              </Box>
            );
          })}
        </Stack>
      )}
      {orders.length >= pageSize && (
        <Typography variant="body2" color="text.secondary">
          {t('Mostrando los últimos {count} pedidos. Acota el periodo o busca por folio para ver otros.', { count: pageSize })}
        </Typography>
      )}
    </Stack>
  );
}
