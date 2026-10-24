import { Alert } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomersBoard } from '@/features/customers/components/CustomersBoard';
import { CUSTOMERS_PAGE, listCustomers } from '@/features/customers/queries';
import { getLocale, getT } from '@/i18n/server';
import { requireCatalogSite } from '@/lib/auth/session';
import { parseContact } from '@/lib/business/profile';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { findSort } from '@/lib/orders/customers';

/** Momento del render (ms) para "hace 5 días". Server Component: una vez por petición, y el cliente lo reutiliza al hidratar. */
const requestNow = () => Date.now();

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Clientes') };
}

export default async function CustomersPage({ searchParams }: PageProps<'/dashboard/clientes'>) {
  const ctx = await requireCatalogSite();
  const { orden, q } = await searchParams;
  const sort = findSort(orden);
  const query = typeof q === 'string' ? q.slice(0, 60) : '';
  const [t, locale, customers] = await Promise.all([getT(), getLocale(), listCustomers(ctx, { sort, query })]);
  const settings = parseCatalogSettings(ctx.catalog.settings);

  return (
    <>
      <PageHeader title={t('Clientes')} description={t('Quién te compra, cuántas veces y cuánto: se arma solo con los pedidos de tu bandeja.')} />
      {customers === null ? (
        <Alert severity="warning">{t('No se pudieron cargar los clientes. Intenta de nuevo en unos minutos.')}</Alert>
      ) : (
        <CustomersBoard
          key={`${sort.slug}:${query}`}
          customers={customers}
          sort={sort}
          query={query}
          inbox={settings.order.enabled && settings.order.inbox}
          askPhone={settings.order.askPhone}
          businessWhatsapp={parseContact(ctx.business.contact).whatsapp}
          locale={locale}
          priceLocale={settings.locale}
          now={requestNow()}
          pageSize={CUSTOMERS_PAGE}
        />
      )}
    </>
  );
}
