'use client';

import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Eye, EyeOff, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { CopyField } from '@/components/ui/CopyField';
import { SectionCard } from '@/components/ui/SectionCard';
import { publishCatalog, unpublishCatalog } from '@/features/catalog/actions';
import { useAction } from '@/lib/hooks/use-action';
import type { CatalogStatus } from '@/types/database';

type Props = { status: CatalogStatus; url: string; publishedAt: string | null; visibleItems: number; hiddenItems: number };

export function PublishingPanel({ status, url, publishedAt, visibleItems, hiddenItems }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const published = status === 'published';

  return (
    <Stack spacing={2.5}>
      <SectionCard title="Estado de publicación" action={<Chip label={STATUS_LABELS[status].label} color={STATUS_LABELS[status].color} />}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {published
              ? `Tu catálogo es público${publishedAt ? ` desde el ${new Date(publishedAt).toLocaleDateString('es')}` : ''}. Cada cambio que guardes se refleja de inmediato.`
              : status === 'draft'
                ? 'Tu catálogo todavía es un borrador: nadie más puede verlo. Revisa la vista previa y publícalo cuando esté listo.'
                : 'Tu catálogo está despublicado. El enlace muestra "catálogo no disponible".'}
          </Typography>
          {visibleItems === 0 && !published && <Alert severity="warning">Aún no hay ítems visibles. Puedes publicar igual, pero tus clientes verán un catálogo vacío.</Alert>}
          <CopyField label="Enlace público" value={url} openable={published} />
          <Stack direction="row" spacing={1}>
            {published ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<EyeOff size={15} />}
                disabled={pending}
                onClick={async () => {
                  const ok = await confirm({ title: '¿Despublicar el catálogo?', description: 'El enlace dejará de mostrar tu catálogo hasta que lo vuelvas a publicar.', confirmLabel: 'Despublicar', destructive: true });
                  if (ok) await run(unpublishCatalog, { onSuccess: () => router.refresh() });
                }}
              >
                Despublicar
              </Button>
            ) : (
              <Button variant="contained" startIcon={<Rocket size={15} />} disabled={pending} onClick={() => run(publishCatalog, { onSuccess: () => router.refresh() })}>
                Publicar catálogo
              </Button>
            )}
            <Button variant="outlined" color="inherit" startIcon={<Eye size={15} />} href="/preview" target="_blank">
              Vista previa
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title="¿Qué ven tus clientes?">
        <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', fontSize: 14, '& li': { mb: 0.5 } }}>
          <li>{visibleItems} ítem(s) visibles{hiddenItems ? ` · ${hiddenItems} oculto(s) (sólo tú los ves)` : ''}.</li>
          <li>Las categorías ocultas y sus ítems no se muestran.</li>
          <li>La vista previa muestra exactamente lo que se publicará.</li>
        </Box>
      </SectionCard>
    </Stack>
  );
}
