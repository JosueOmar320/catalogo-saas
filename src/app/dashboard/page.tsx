import { Alert, Box, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { CheckCircle2, Circle, FolderTree, Package, Palette, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { CopyField } from '@/components/ui/CopyField';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { listCategories, listItemsWithImages, listPages } from '@/features/catalog/queries';
import { requireBusinessContext } from '@/lib/auth/session';
import { parseContact } from '@/lib/business/profile';
import { catalogUrl } from '@/lib/catalog/view-model';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Inicio' };

export default async function DashboardHome({ searchParams }: PageProps<'/dashboard'>) {
  const ctx = await requireBusinessContext();
  const [{ welcome }, categories, items, pages] = await Promise.all([searchParams, listCategories(ctx), listItemsWithImages(ctx), listPages(ctx)]);
  const contact = parseContact(ctx.business.contact);
  const products = items.filter((i) => i.type === 'product').length;
  const services = items.length - products;
  const hidden = items.filter((i) => !i.is_visible).length;
  const published = ctx.catalog.status === 'published';

  const steps = [
    { done: Boolean(ctx.business.logo_path), label: 'Sube tu logo', href: '/dashboard/sitio?panel=design' },
    { done: ctx.catalog.theme !== null && (ctx.catalog.theme as { version?: number }).version === 2, label: 'Elige el diseño de tu sitio', href: '/dashboard/sitio?panel=design' },
    { done: Boolean(contact.whatsapp || contact.phone || contact.email), label: 'Agrega tus datos de contacto', href: '/dashboard/settings/contacto' },
    { done: categories.length > 0, label: 'Crea tu primera categoría', href: '/dashboard/catalog/categories' },
    { done: items.some((i) => i.images.length > 0), label: 'Agrega un producto o servicio con foto', href: '/dashboard/catalog/items/new?type=product' },
    { done: published, label: 'Publica tu catálogo', href: '/dashboard/settings/publicacion' },
  ];
  const completed = steps.filter((s) => s.done).length;

  const stats = [
    { label: 'Productos', value: products, icon: Package, href: '/dashboard/catalog/products' },
    { label: 'Servicios', value: services, icon: Wrench, href: '/dashboard/catalog/services' },
    { label: 'Categorías', value: categories.length, icon: FolderTree, href: '/dashboard/catalog/categories' },
  ];

  return (
    <>
      <PageHeader
        title={`Hola, ${ctx.business.name}`}
        description="Administra tu catálogo, personaliza su diseño y compártelo con tus clientes."
      />

      {welcome && (
        <Alert severity="success" sx={{ mb: 3 }}>
          ¡Tu negocio está listo! Sigue los pasos de abajo para completar tu catálogo.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="Primeros pasos"
            description={completed === steps.length ? 'Completaste la configuración inicial.' : `${completed} de ${steps.length} completados`}
          >
            <LinearProgress variant="determinate" value={(completed / steps.length) * 100} sx={{ height: 6, borderRadius: 3, mb: 2 }} />
            <Stack spacing={0.5}>
              {steps.map((step) => (
                <Stack key={step.label} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 0.75 }}>
                  <Box sx={{ color: step.done ? 'success.main' : 'text.disabled', display: 'flex' }}>
                    {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </Box>
                  <Typography variant="body2" sx={{ flex: 1, color: step.done ? 'text.secondary' : 'text.primary', textDecoration: step.done ? 'line-through' : 'none' }}>
                    {step.label}
                  </Typography>
                  {!step.done && (
                    <LinkButton href={step.href} variant="outlined" color="inherit">
                      Ir
                    </LinkButton>
                  )}
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2.5}>
            <SectionCard title="Tu catálogo" description={`Estado: ${STATUS_LABELS[ctx.catalog.status].label}`}>
              <CopyField value={catalogUrl(ctx.business.slug)} openable={published} />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {published && ctx.catalog.published_at
                  ? `Publicado el ${formatDate(ctx.catalog.published_at)}. Los cambios se reflejan al instante.`
                  : 'Publica el catálogo para que este enlace funcione.'}
              </Typography>
              {hidden > 0 && (
                <Typography variant="caption" color="text.secondary" component="p">
                  {hidden} ítem(s) ocultos no se muestran al público.
                </Typography>
              )}
            </SectionCard>

            <Grid container spacing={1.5}>
              {stats.map((stat) => (
                <Grid key={stat.label} size={4}>
                  <SectionCard sx={{ height: '100%' }}>
                    <Box sx={{ color: 'text.secondary', mb: 1, display: 'flex' }}><stat.icon size={16} /></Box>
                    <Typography variant="h2" component="p">{stat.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                  </SectionCard>
                </Grid>
              ))}
            </Grid>

            <SectionCard title="Tu sitio web" description={`${pages.length} página(s): ${pages.map((p) => p.title).join(', ') || 'ninguna'}.`}>
              <Stack direction="row" spacing={1}>
                <LinkButton href="/dashboard/sitio" variant="contained" startIcon={<Palette size={14} />}>
                  Abrir el editor
                </LinkButton>
                <LinkButton href="/dashboard/export/pdf" variant="outlined" color="inherit">
                  Catálogo en PDF
                </LinkButton>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
