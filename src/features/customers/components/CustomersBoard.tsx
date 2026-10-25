'use client';

import { Alert, Box, Button, Chip, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Download, MessageCircle, ReceiptText, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { CUSTOMER_SORTS, customerWhatsappLink, FREQUENT_FROM, type Customer, type CustomerSort } from '@/lib/orders/customers';
import { formatPrice, formatRelative } from '@/lib/utils/format';

type Props = {
  customers: Customer[];
  sort: CustomerSort;
  query: string;
  /** La bandeja de pedidos está activa (sin ella no se arman clientes nuevos). */
  inbox: boolean;
  askPhone: boolean;
  businessWhatsapp: string;
  locale: string;
  priceLocale: string;
  /** Momento del servidor (ms) para "hace 5 días": el mismo al renderizar y al hidratar. */
  now: number;
  pageSize: number;
};

/** Lista de clientes: buscar, ordenar, escribirles por WhatsApp, ver sus pedidos y descargarla. */
export function CustomersBoard({ customers, sort, query, inbox, askPhone, businessWhatsapp, locale, priceLocale, now, pageSize }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);

  const href = (patch: { orden?: string; q?: string }) => {
    const params = new URLSearchParams();
    const orden = patch.orden ?? sort.slug;
    const q = patch.q ?? query;
    if (orden !== CUSTOMER_SORTS[0].slug) params.set('orden', orden);
    if (q) params.set('q', q);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const exportHref = `/api/customers/export?${new URLSearchParams({ orden: sort.slug, ...(query ? { q: query } : {}) }).toString()}`;

  return (
    <Stack spacing={2}>
      {!inbox && (
        <Alert severity="info" action={<Button component={Link} href="/dashboard/settings/pedidos" size="small">{t('Activar')}</Button>}>
          {t('La lista se arma con los pedidos de tu bandeja, y la bandeja está apagada. Actívala en Configuración › Pedidos por WhatsApp.')}
        </Alert>
      )}
      {inbox && !askPhone && (
        <Alert severity="info" action={<Button component={Link} href="/dashboard/settings/pedidos" size="small">{t('Activar')}</Button>}>
          {t('Pide el WhatsApp del cliente en el pedido para poder escribirle y reconocerlo aunque cambie su nombre.')}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
        <Box component="form" sx={{ flex: 1 }} onSubmit={(event) => { event.preventDefault(); router.push(href({ q: search.trim() })); }}>
          <TextField size="small" fullWidth label={t('Buscar nombre o WhatsApp')} value={search} onChange={(event) => setSearch(event.target.value.slice(0, 60))} />
        </Box>
        <TextField select size="small" label={t('Ordenar por')} value={sort.slug} onChange={(event) => router.push(href({ orden: event.target.value }))} sx={{ minWidth: 200 }}>
          {CUSTOMER_SORTS.map((option) => <MenuItem key={option.slug} value={option.slug}>{t(option.label)}</MenuItem>)}
        </TextField>
        <Tooltip title={t('Descargar CSV (Excel)')}>
          <IconButton component="a" href={exportHref} aria-label={t('Descargar CSV (Excel)')}><Download size={18} /></IconButton>
        </Tooltip>
      </Stack>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? t('Ningún cliente coincide con «{query}».', { query }) : t('Todavía no hay clientes.')}
          description={query ? undefined : t('Aparecen aquí cuando te piden por WhatsApp desde tu sitio y dejan su nombre o su WhatsApp.')}
        />
      ) : (
        <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label={t('Clientes')}>
          {customers.map((customer) => {
            const name = customer.name ?? t('Sin nombre');
            const chat = customerWhatsappLink(customer.phone, businessWhatsapp, customer.name ? t('¡Hola, {name}!', { name: customer.name.split(/\s+/)[0] }) : '');
            const ordersQuery = customer.phone ?? customer.name ?? '';
            return (
              <Box component="li" key={customer.key} aria-label={name}>
                <SectionCard>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{name}</Typography>
                        {customer.orders >= FREQUENT_FROM && <Chip size="small" color="primary" variant="outlined" label={t('Cliente frecuente')} />}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {[
                          customer.phone ?? t('Sin WhatsApp'),
                          customer.orders === 1 ? t('1 pedido') : t('{count} pedidos', { count: customer.orders }),
                          formatPrice(customer.spent, customer.currency || 'MXN', priceLocale),
                          t('Último: {when}', { when: formatRelative(customer.lastOrderAt, locale, now) }),
                        ].join(' · ')}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                      {chat && (
                        <Button size="small" variant="outlined" startIcon={<MessageCircle size={14} />} href={chat} target="_blank" rel="noopener noreferrer" aria-label={t('Escribirle a {name} por WhatsApp', { name })}>
                          {t('WhatsApp')}
                        </Button>
                      )}
                      <Button size="small" color="inherit" startIcon={<ReceiptText size={14} />} component={Link} href={`/dashboard/pedidos?estado=todos&dias=90&q=${encodeURIComponent(ordersQuery)}`} aria-label={t('Ver los pedidos de {name}', { name })}>
                        {t('Pedidos')}
                      </Button>
                    </Stack>
                  </Stack>
                </SectionCard>
              </Box>
            );
          })}
        </Stack>
      )}
      {customers.length >= pageSize && (
        <Typography variant="body2" color="text.secondary">
          {t('Mostrando {count} clientes. Busca por nombre o WhatsApp para encontrar a otros.', { count: pageSize })}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('Los pedidos cancelados no cuentan. El nombre y el WhatsApp de cada pedido se borran a los 180 días.')}
      </Typography>
    </Stack>
  );
}
