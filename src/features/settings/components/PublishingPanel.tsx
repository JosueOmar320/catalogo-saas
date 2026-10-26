'use client';

import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Eye, EyeOff, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { QrCodeButton } from '@/components/dashboard/QrCodeButton';
import { CopyField } from '@/components/ui/CopyField';
import { SectionCard } from '@/components/ui/SectionCard';
import { publishCatalog, unpublishCatalog } from '@/features/catalog/actions';
import { useLocale, useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import type { CatalogStatus } from '@/types/database';

/** catalog = false: sitio web (se habla del sitio, sin ítems). */
type Props = { status: CatalogStatus; url: string; publishedAt: string | null; visibleItems: number; hiddenItems: number; businessName: string; slug: string; catalog?: boolean };

export function PublishingPanel({ status, url, publishedAt, visibleItems, hiddenItems, businessName, slug, catalog = true }: Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const { demo } = useDashboard();
  const published = status === 'published';

  return (
    <Stack spacing={2.5}>
      <SectionCard title={t('Estado de publicación')} action={<Chip label={t(STATUS_LABELS[status].label)} color={STATUS_LABELS[status].color} />}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {!catalog
              ? published
                ? t('Tu sitio es público. Cada cambio que guardes se refleja de inmediato.')
                : t('Tu sitio todavía no es público: nadie más puede verlo. Revisa la vista previa y publícalo cuando esté listo.')
              : published
              ? publishedAt
                ? t('Tu catálogo es público desde el {date}. Cada cambio que guardes se refleja de inmediato.', { date: new Date(publishedAt).toLocaleDateString(locale, { timeZone: 'UTC' }) })
                : t('Tu catálogo es público. Cada cambio que guardes se refleja de inmediato.')
              : status === 'draft'
                ? t('Tu catálogo todavía es un borrador: nadie más puede verlo. Revisa la vista previa y publícalo cuando esté listo.')
                : t('Tu catálogo está despublicado. El enlace muestra "catálogo no disponible".')}
          </Typography>
          {demo && <Alert severity="info">{t('En la cuenta de prueba el sitio no se publica. Usa «Vista previa» para verlo como tus clientes.')}</Alert>}
          {catalog && visibleItems === 0 && !published && <Alert severity="warning">{t('Aún no hay ítems visibles. Puedes publicar igual, pero tus clientes verán un catálogo vacío.')}</Alert>}
          <CopyField label={t('Enlace público')} value={url} openable={published} />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {published ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<EyeOff size={15} />}
                disabled={pending}
                onClick={async () => {
                  const ok = await confirm({ title: catalog ? t('¿Despublicar el catálogo?') : t('¿Despublicar el sitio?'), description: catalog ? t('El enlace dejará de mostrar tu catálogo hasta que lo vuelvas a publicar.') : t('El enlace dejará de mostrar tu sitio hasta que lo vuelvas a publicar.'), confirmLabel: t('Despublicar'), destructive: true });
                  if (ok) await run(unpublishCatalog, { onSuccess: () => router.refresh() });
                }}
              >
                {t('Despublicar')}
              </Button>
            ) : (
              <Button variant="contained" startIcon={<Rocket size={15} />} disabled={pending || demo} onClick={() => run(publishCatalog, { onSuccess: () => router.refresh() })}>
                {catalog ? t('Publicar catálogo') : t('Publicar sitio')}
              </Button>
            )}
            <Button variant="outlined" color="inherit" startIcon={<Eye size={15} />} href="/preview" target="_blank">
              {t('Vista previa')}
            </Button>
            <QrCodeButton url={url} businessName={businessName} slug={slug} published={published} />
          </Stack>
        </Stack>
      </SectionCard>

      {catalog && (
      <SectionCard title={t('¿Qué ven tus clientes?')}>
        <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', fontSize: 14, '& li': { mb: 0.5 } }}>
          <li>{hiddenItems ? t('{visible} ítem(s) visibles · {hidden} oculto(s) (sólo tú los ves).', { visible: visibleItems, hidden: hiddenItems }) : t('{count} ítem(s) visibles.', { count: visibleItems })}</li>
          <li>{t('Las categorías ocultas y sus ítems no se muestran.')}</li>
          <li>{t('La vista previa muestra exactamente lo que se publicará.')}</li>
        </Box>
      </SectionCard>
      )}
    </Stack>
  );
}
