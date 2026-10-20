import { Alert, Avatar, Box, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { AlertCircle, ArrowRight, CheckCircle2, Circle, ExternalLink, FileText, FolderTree, ImageIcon, LayoutTemplate, MessageCircle, Package, Palette, Plus, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { QrCodeButton } from '@/components/dashboard/QrCodeButton';
import { ShareKitButton } from '@/components/dashboard/ShareKitButton';
import { parseTheme } from '@/lib/design/theme';
import { CopyField } from '@/components/ui/CopyField';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { LinkCard } from '@/components/ui/LinkCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { itemThumbnail, listCategories, listItemsWithImages, listPages } from '@/features/catalog/queries';
import { countReview, REVIEW_FILTERS, REVIEW_ORDER, type ReviewFilter } from '@/features/items/review';
import { OrderStatsChart } from '@/features/orders/components/OrderStatsChart';
import { getOrderStats } from '@/features/orders/queries';
import { countPendingReviews } from '@/features/reviews/queries';
import { getViewStats } from '@/features/views/queries';
import { getLocale, getT } from '@/i18n/server';
import { requireBusinessContext } from '@/lib/auth/session';
import { parseContact } from '@/lib/business/profile';
import { parseItemAttributes } from '@/lib/catalog/item-attributes';
import { isSaleOver } from '@/lib/catalog/sale';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { catalogUrl } from '@/lib/catalog/view-model';
import { formatDate, formatPrice, formatRelative } from '@/lib/utils/format';
import { ordersPer100Views } from '@/lib/views/stats';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Inicio') };
}

const RECENT_COUNT = 5;

export default async function DashboardHome({ searchParams }: PageProps<'/dashboard'>) {
  const ctx = await requireBusinessContext();
  const [{ welcome }, categories, items, pages, t, locale, orderStats, viewStats, pendingReviews] = await Promise.all([
    searchParams,
    listCategories(ctx),
    listItemsWithImages(ctx),
    listPages(ctx),
    getT(),
    getLocale(),
    getOrderStats(ctx),
    getViewStats(ctx),
    countPendingReviews(ctx),
  ]);
  const contact = parseContact(ctx.business.contact);
  const settings = parseCatalogSettings(ctx.catalog.settings);
  const products = items.filter((i) => i.type === 'product');
  const services = items.length - products.length;
  const published = ctx.catalog.status === 'published';
  const now = new Date();
  const url = catalogUrl(ctx.business.slug);

  const steps = [
    { done: Boolean(ctx.business.logo_path), label: t('Sube tu logo'), href: '/dashboard/sitio?panel=design' },
    { done: ctx.catalog.theme !== null && (ctx.catalog.theme as { version?: number }).version === 2, label: t('Elige el diseño de tu sitio'), href: '/dashboard/sitio?panel=design' },
    { done: Boolean(contact.whatsapp || contact.phone || contact.email), label: t('Agrega tus datos de contacto'), href: '/dashboard/settings/contacto' },
    { done: categories.length > 0, label: t('Crea tu primera categoría'), href: '/dashboard/catalog/categories' },
    { done: items.some((i) => i.images.length > 0), label: t('Agrega un producto o servicio con foto'), href: '/dashboard/catalog/items/new?type=product' },
    { done: published, label: t('Publica tu catálogo'), href: '/dashboard/settings/publicacion' },
  ];
  const completed = steps.filter((s) => s.done).length;
  const setupDone = completed === steps.length;

  // Revisión: lo que conviene completar, con enlace a la lista (productos o servicios) donde hay más casos.
  const review = countReview(
    items.map((i) => ({
      type: i.type,
      hasImage: i.images.length > 0,
      hasPrice: i.price !== null,
      categoryId: i.category_id,
      isAvailable: i.is_available,
      isVisible: i.is_visible,
      hasDescription: Boolean(i.short_description || i.description),
      saleOver: i.compare_at_price !== null && isSaleOver(parseItemAttributes(i.attributes).saleEnds, now),
    })),
    categories.length > 0,
  );
  const issues = REVIEW_ORDER.filter((filter) => review[filter].count > 0).map((filter) => {
    const { count, products } = review[filter];
    return { filter, count, href: `/dashboard/catalog/${products >= count - products ? 'products' : 'services'}?revisar=${filter}` };
  });
  const ISSUE_TEXT: Record<ReviewFilter, (count: number) => string> = {
    'sin-foto': (count) => t('{count} sin foto: las fotos son lo primero que miran tus clientes.', { count }),
    'sin-precio': (count) => t('{count} producto(s) sin precio.', { count }),
    'sin-categoria': (count) => t('{count} sin categoría: no aparecen al filtrar por categoría.', { count }),
    agotados: (count) => t('{count} marcado(s) como agotados.', { count }),
    ocultos: (count) => t('{count} oculto(s): no se muestran al público.', { count }),
    'oferta-vencida': (count) => t('{count} con la oferta vencida: ya se muestran a su precio normal; quita el precio anterior o pon otra fecha.', { count }),
    'sin-descripcion': (count) => t('{count} sin descripción: unas líneas ayudan a decidir.', { count }),
  };

  const recent = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, RECENT_COUNT);

  const maxItems = ctx.entitlements.limits.max_items;
  const usage = maxItems ? Math.min(100, (items.length / maxItems) * 100) : null;

  const stats = [
    { label: t('Productos'), value: products.length, icon: Package, href: '/dashboard/catalog/products' },
    { label: t('Servicios'), value: services, icon: Wrench, href: '/dashboard/catalog/services' },
    { label: t('Categorías'), value: categories.length, icon: FolderTree, href: '/dashboard/catalog/categories' },
    { label: t('Páginas'), value: pages.length, icon: LayoutTemplate, href: '/dashboard/sitio' },
  ];

  const ordersOn = settings.order.enabled && (Boolean(contact.whatsapp) || settings.order.branches.length > 0);
  const itemNames = new Map(items.map((i) => [i.id, i.name]));
  const money = (value: number) => formatPrice(value, settings.currency, settings.locale, settings.priceFormat);

  return (
    <>
      <PageHeader
        title={t('Hola, {name}', { name: ctx.business.name })}
        description={t('Administra tu catálogo, personaliza su diseño y compártelo con tus clientes.')}
        actions={
          <>
            {published && (
              <LinkButton href={url} target="_blank" rel="noopener noreferrer" variant="outlined" color="inherit" startIcon={<ExternalLink size={14} />}>
                {t('Ver sitio')}
              </LinkButton>
            )}
            <LinkButton href="/dashboard/catalog/items/new?type=product" variant="contained" startIcon={<Plus size={15} />}>
              {t('Nuevo producto')}
            </LinkButton>
          </>
        }
      />

      {welcome && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('¡Tu negocio está listo! Sigue los pasos de abajo para completar tu catálogo.')}
        </Alert>
      )}

      {pendingReviews ? (
        <Alert
          severity="info"
          sx={{ mb: 3, alignItems: 'center' }}
          action={
            <LinkButton href="/dashboard/resenas" size="small" color="inherit" endIcon={<ArrowRight size={14} />}>
              {t('Revisar')}
            </LinkButton>
          }
        >
          {pendingReviews === 1 ? t('Tienes 1 reseña nueva por revisar.') : t('Tienes {count} reseñas nuevas por revisar.', { count: pendingReviews })}
        </Alert>
      ) : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            {!setupDone && (
              <SectionCard title={t('Primeros pasos')} description={t('{completed} de {total} completados', { completed, total: steps.length })}>
                <LinearProgress
                  variant="determinate"
                  value={(completed / steps.length) * 100}
                  aria-label={t('Progreso de la configuración')}
                  sx={{ height: 6, borderRadius: 3, mb: 2 }}
                />
                <Stack component="ol" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {steps.map((step) => (
                    <Stack component="li" key={step.label} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 0.75 }}>
                      <Box sx={{ color: step.done ? 'success.main' : 'text.disabled', display: 'flex' }}>
                        {step.done ? <CheckCircle2 size={18} aria-label={t('Completado')} /> : <Circle size={18} aria-label={t('Pendiente')} />}
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1, color: step.done ? 'text.secondary' : 'text.primary', textDecoration: step.done ? 'line-through' : 'none' }}>
                        {step.label}
                      </Typography>
                      {!step.done && (
                        <LinkButton href={step.href} variant="outlined" color="inherit" aria-label={t('Ir: {step}', { step: step.label })}>
                          {t('Ir')}
                        </LinkButton>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            )}

            {items.length > 0 && (
              <SectionCard
                title={t('Revisa tu catálogo')}
                description={issues.length ? t('Detalles que mejoran cómo se ve tu catálogo.') : t('Todo en orden: tus productos y servicios están completos.')}
              >
                {issues.length === 0 ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'success.main' }}>
                    <CheckCircle2 size={18} aria-hidden />
                    <Typography variant="body2">{t('Sin pendientes.')}</Typography>
                  </Stack>
                ) : (
                  <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {issues.map((issue) => (
                      <Stack component="li" key={issue.filter} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Box sx={{ color: issue.filter === 'ocultos' || issue.filter === 'agotados' ? 'text.secondary' : 'warning.main', display: 'flex' }}>
                          <AlertCircle size={17} aria-hidden />
                        </Box>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {ISSUE_TEXT[issue.filter](issue.count)}
                        </Typography>
                        <LinkButton href={issue.href} size="small" color="inherit" endIcon={<ArrowRight size={14} />} aria-label={t('Revisar: {issue}', { issue: t(REVIEW_FILTERS[issue.filter].label) })}>
                          {t('Revisar')}
                        </LinkButton>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            )}

            {orderStats && (
              <SectionCard title={t('Pedidos por WhatsApp')} description={t('Últimos 30 días')}>
                {!ordersOn ? (
                  <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('Activa los pedidos para que tus clientes armen su lista y te la envíen por WhatsApp. Aquí verás cuántos recibes y qué es lo más pedido.')}
                    </Typography>
                    <LinkButton href="/dashboard/settings/contacto" variant="outlined" color="inherit" startIcon={<MessageCircle size={14} />}>
                      {t('Activar pedidos por WhatsApp')}
                    </LinkButton>
                  </Stack>
                ) : orderStats.orders === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('Todavía no hay pedidos en estos días. Comparte el enlace de tu catálogo en WhatsApp, redes y tu bio.')}
                  </Typography>
                ) : (
                  <Stack spacing={2.5}>
                    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, m: 0 }}>
                      {[
                        { label: t('Pedidos'), value: String(orderStats.orders) },
                        { label: t('Unidades'), value: String(orderStats.units) },
                        { label: t('Valor estimado'), value: money(orderStats.value) },
                      ].map((stat) => (
                        <Box key={stat.label}>
                          <Typography component="dt" variant="caption" color="text.secondary">{stat.label}</Typography>
                          <Typography component="dd" variant="h2" sx={{ m: 0, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{stat.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <OrderStatsChart days={orderStats.days.map((d) => ({ day: d.day, count: d.orders }))} locale={locale} />
                    {orderStats.top.length > 0 && (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{t('Lo más pedido')}</Typography>
                        <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                          {orderStats.top.map((top) => (
                            <Typography component="li" variant="body2" key={top.itemId}>
                              {itemNames.get(top.itemId) ?? t('Producto eliminado')}
                              <Typography component="span" variant="body2" color="text.secondary">{' · '}{top.units === 1 ? t('1 unidad') : t('{count} unidades', { count: top.units })}</Typography>
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {t('Se cuenta cada vez que un cliente envía su pedido desde tu sitio. El valor usa los precios del catálogo; el total final lo acuerdas por WhatsApp.')}
                    </Typography>
                  </Stack>
                )}
              </SectionCard>
            )}

            {viewStats && (
              <SectionCard title={t('Visitas a tu sitio')} description={t('Últimos 30 días')}>
                {!published ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('Publica tu catálogo para empezar a contar las visitas.')}
                  </Typography>
                ) : viewStats.views === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('Todavía no hay visitas en estos días. Comparte el enlace o el código QR de tu catálogo.')}
                  </Typography>
                ) : (
                  <Stack spacing={2.5}>
                    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, m: 0 }}>
                      {[
                        { label: t('Visitas'), value: String(viewStats.views) },
                        { label: t('Fichas vistas'), value: String(viewStats.itemViews) },
                        ...(ordersOn && orderStats
                          ? [{ label: t('Pedidos por cada 100 visitas'), value: String(ordersPer100Views(orderStats.orders, viewStats.views) ?? 0) }]
                          : []),
                      ].map((stat) => (
                        <Box key={stat.label}>
                          <Typography component="dt" variant="caption" color="text.secondary">{stat.label}</Typography>
                          <Typography component="dd" variant="h2" sx={{ m: 0, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{stat.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <OrderStatsChart days={viewStats.days} locale={locale} kind="views" />
                    {viewStats.top.length > 0 && (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{t('Lo más visto')}</Typography>
                        <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                          {viewStats.top.map((top) => (
                            <Typography component="li" variant="body2" key={top.itemId}>
                              {itemNames.get(top.itemId) ?? t('Producto eliminado')}
                              <Typography component="span" variant="body2" color="text.secondary">{' · '}{top.views === 1 ? t('1 visita') : t('{count} visitas', { count: top.views })}</Typography>
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {t('Se cuenta cada página que se abre en tu sitio publicado (no la vista previa ni la demo). No se guarda nada de tus visitantes.')}
                    </Typography>
                  </Stack>
                )}
              </SectionCard>
            )}

            <SectionCard
              title={t('Editado recientemente')}
              flush={recent.length > 0}
              action={recent.length > 0 && <LinkButton href="/dashboard/catalog/products" size="small" color="inherit">{t('Ver todo')}</LinkButton>}
            >
              {recent.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={t('Aún no tienes productos ni servicios')}
                  description={t('Crear uno toma menos de un minuto: nombre, precio y una foto.')}
                  action={
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                      <LinkButton href="/dashboard/catalog/items/new?type=product" variant="contained" startIcon={<Plus size={15} />}>{t('Nuevo producto')}</LinkButton>
                      <LinkButton href="/dashboard/catalog/items/new?type=service" variant="outlined" color="inherit">{t('Nuevo servicio')}</LinkButton>
                    </Stack>
                  }
                />
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {recent.map((item) => (
                    <Box component="li" key={item.id} sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                      <LinkCard href={`/dashboard/catalog/items/${item.id}`} sx={{ border: 0, borderRadius: 0, py: 1.25, px: 2.5 }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Avatar variant="rounded" src={itemThumbnail(item) ?? undefined} alt="" sx={{ width: 40, height: 40, bgcolor: 'action.hover', color: 'text.disabled' }}>
                            <ImageIcon size={16} />
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{item.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap component="p">
                              {[item.type === 'product' ? t('Producto') : t('Servicio'), !item.is_visible && t('Oculto')].filter(Boolean).join(' · ')}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            <time dateTime={item.updated_at} title={formatDate(item.updated_at, locale)}>{formatRelative(item.updated_at, locale)}</time>
                          </Typography>
                        </Stack>
                      </LinkCard>
                    </Box>
                  ))}
                </Box>
              )}
            </SectionCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <SectionCard title={t('Tu catálogo')} description={t('Estado: {status}', { status: t(STATUS_LABELS[ctx.catalog.status].label) })}>
              <CopyField value={url} openable={published} />
              <Box sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <QrCodeButton url={url} businessName={ctx.business.name} slug={ctx.business.slug} published={published} />
                  <ShareKitButton
                    url={url}
                    businessName={ctx.business.name}
                    slogan={ctx.business.slogan ?? null}
                    color={parseTheme(ctx.catalog.theme).colors.accent}
                    slug={ctx.business.slug}
                    published={published}
                  />
                </Stack>
              </Box>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {published && ctx.catalog.published_at
                  ? t('Publicado el {date}. Los cambios se reflejan al instante.', { date: formatDate(ctx.catalog.published_at, locale) })
                  : t('Publica el catálogo para que este enlace funcione.')}
              </Typography>
              {setupDone && (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 1.5, color: 'success.main' }}>
                  <CheckCircle2 size={15} aria-hidden />
                  <Typography variant="caption">{t('Completaste la configuración inicial.')}</Typography>
                </Stack>
              )}
            </SectionCard>

            <Grid container spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('Resumen')}>
              {stats.map((stat) => (
                <Grid key={stat.label} size={6} component="li">
                  <LinkCard href={stat.href} sx={{ height: '100%' }}>
                    <Box sx={{ color: 'text.secondary', mb: 1, display: 'flex' }}><stat.icon size={16} aria-hidden /></Box>
                    <Typography variant="h2" component="p">{stat.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                  </LinkCard>
                </Grid>
              ))}
            </Grid>

            <SectionCard title={t('Plan {plan}', { plan: ctx.entitlements.planName })}>
              {maxItems === null || usage === null ? (
                <Typography variant="body2" color="text.secondary">{t('{count} productos y servicios. Sin límite en tu plan.', { count: items.length })}</Typography>
              ) : (
                <>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="body2">{t('Productos y servicios')}</Typography>
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t('{count} de {max}', { count: items.length, max: maxItems })}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={usage}
                    color={usage >= 100 ? 'error' : usage >= 80 ? 'warning' : 'primary'}
                    aria-label={t('Uso del plan')}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                  {usage >= 80 && (
                    <Typography variant="caption" color={usage >= 100 ? 'error.main' : 'warning.main'} component="p" sx={{ mt: 1 }}>
                      {usage >= 100 ? t('Llegaste al límite de tu plan. Pide al administrador ampliarlo para agregar más.') : t('Te estás acercando al límite de tu plan.')}
                    </Typography>
                  )}
                </>
              )}
            </SectionCard>

            <SectionCard title={t('Accesos rápidos')}>
              <Stack spacing={1}>
                <LinkButton href="/dashboard/sitio" variant="contained" startIcon={<Palette size={14} />} fullWidth>
                  {t('Abrir el editor')}
                </LinkButton>
                {ctx.entitlements.features.pdf_export && (
                  <LinkButton href="/dashboard/export/pdf" variant="outlined" color="inherit" startIcon={<FileText size={14} />} fullWidth>
                    {t('Catálogo en PDF')}
                  </LinkButton>
                )}
                <LinkButton href="/dashboard/settings/contacto" variant="outlined" color="inherit" startIcon={<MessageCircle size={14} />} fullWidth>
                  {ordersOn ? t('Pedidos por WhatsApp: activos') : t('Activar pedidos por WhatsApp')}
                </LinkButton>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
