import { Alert, Box } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { OrdersBoard } from '@/features/orders/components/OrdersBoard';
import { OrderAlertsCard } from '@/features/push/components/OrderAlertsCard';
import { isPushConfigured } from '@/features/push/server';
import { orderCountsByCustomer } from '@/features/customers/queries';
import { countNewOrders, listOrders, PAGE } from '@/features/orders/inbox-queries';
import { getLocale, getT } from '@/i18n/server';
import { canManageCatalog, requireCatalogFeature } from '@/lib/auth/session';
import { parseContact } from '@/lib/business/profile';
import { reviewInviteUrl } from '@/lib/catalog/reviews';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { catalogUrl } from '@/lib/catalog/view-model';
import { findTab, parseRange } from '@/lib/orders/inbox';

/** Momento del render (ms) para "hace 5 min". Server Component: una vez por petición, y el cliente lo reutiliza al hidratar. */
const requestNow = () => Date.now();

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Pedidos') };
}

export default async function OrdersPage({ searchParams }: PageProps<'/dashboard/pedidos'>) {
  const ctx = await requireCatalogFeature('orders');
  const { estado, dias, q } = await searchParams;
  const tab = findTab(estado);
  const days = parseRange(dias);
  const query = typeof q === 'string' ? q.slice(0, 60) : '';
  const [t, locale, orders, newCount] = await Promise.all([getT(), getLocale(), listOrders(ctx, { statuses: tab.statuses, days, query }), countNewOrders(ctx)]);
  const settings = parseCatalogSettings(ctx.catalog.settings);
  const customerOrders = orders ? await orderCountsByCustomer(ctx, orders.map((order) => order.customer_key)) : {};

  return (
    <>
      <PageHeader title={t('Pedidos')} description={t('Cada pedido que tus clientes envían por WhatsApp desde tu sitio. Confírmalo, márcalo listo y entregado.')} />
      {settings.order.enabled && settings.order.inbox && (
        <Box sx={{ mb: 2 }}>
          <OrderAlertsCard vapidPublicKey={isPushConfigured() ? (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? null) : null} />
        </Box>
      )}
      {orders === null ? (
        <Alert severity="warning">{t('No se pudieron cargar los pedidos. Intenta de nuevo en unos minutos.')}</Alert>
      ) : (
        <OrdersBoard
          key={`${tab.slug}:${days}:${query}`}
          tab={tab}
          days={days}
          query={query}
          orders={orders}
          newCount={newCount}
          enabled={settings.order.enabled && settings.order.inbox}
          canManage={canManageCatalog(ctx)}
          locale={locale}
          priceLocale={settings.locale}
          now={requestNow()}
          pageSize={PAGE}
          businessName={ctx.business.name}
          businessWhatsapp={parseContact(ctx.business.contact).whatsapp}
          customerOrders={customerOrders}
          reviewInvite={settings.reviews.enabled ? { url: reviewInviteUrl(catalogUrl(ctx.business.slug)), businessName: ctx.business.name } : null}
        />
      )}
    </>
  );
}
