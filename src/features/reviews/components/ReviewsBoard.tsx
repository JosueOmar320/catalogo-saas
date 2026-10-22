'use client';

import { Box, Button, Chip, FormControlLabel, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import { Check, MessageSquareText, RotateCcw, Star, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateCatalogSettings } from '@/features/catalog/actions';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { useAction } from '@/lib/hooks/use-action';
import { formatDate, formatRelative } from '@/lib/utils/format';
import type { ReviewStatus } from '@/types/database';
import { deleteReview, moderateReview } from '../actions';
import { REVIEW_TABS } from '../tabs';
import type { PanelReview } from '../queries';
import { ReviewInviteCard } from './ReviewInviteCard';
import { ReviewReply } from './ReviewReply';

const EMPTY: Record<ReviewStatus, string> = {
  pending: msg('No hay reseñas por revisar.'),
  approved: msg('Todavía no has publicado reseñas.'),
  rejected: msg('No hay reseñas rechazadas.'),
};

type Props = {
  status: ReviewStatus;
  reviews: PanelReview[];
  pending: number;
  enabled: boolean;
  canManage: boolean;
  locale: string;
  /** Momento del servidor (ms) para "hace 5 min": el mismo al renderizar y al hidratar. */
  now: number;
  /** Tope de filas de la consulta: al llegar a él se avisa que hay más. */
  pageSize: number;
  /** Enlace `?opinar` del sitio y datos para su QR. */
  invite: { url: string; businessName: string; slug: string; published: boolean };
};


export function ReviewsBoard({ status, reviews: initial, pending, enabled: initialEnabled, canManage, locale, now, pageSize, invite }: Props) {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending: busy } = useAction();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [reviews, setReviews] = useState(initial);
  // Sincroniza con datos frescos del servidor tras router.refresh().
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setReviews(initial);
  }

  const toggleEnabled = (value: boolean) => {
    setEnabled(value);
    void run(() => updateCatalogSettings({ reviews: { enabled: value } }), {
      successToast: false,
      onSuccess: () => router.refresh(),
    }).then((result) => {
      if (!result?.ok) setEnabled(!value);
    });
  };

  const moderate = (review: PanelReview, next: ReviewStatus) => {
    setReviews((list) => list.filter((r) => r.id !== review.id));
    void run(() => moderateReview({ id: review.id, status: next }), { onSuccess: () => router.refresh() }).then((result) => {
      if (!result?.ok) setReviews(initial);
    });
  };

  const remove = async (review: PanelReview) => {
    const yes = await confirm({
      title: t('¿Eliminar la reseña de {name}?', { name: review.name }),
      description: t('Se borra para siempre. Para que no se publique basta con rechazarla.'),
      confirmLabel: t('Eliminar'),
      destructive: true,
    });
    if (!yes) return;
    setReviews((list) => list.filter((r) => r.id !== review.id));
    void run(() => deleteReview(review.id), { onSuccess: () => router.refresh() }).then((result) => {
      if (!result?.ok) setReviews(initial);
    });
  };

  const setReply = (review: PanelReview, reply: string | null) => setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, reply } : r)));

  return (
    <Stack spacing={2.5}>
      <SectionCard title={t('Recibir reseñas')} description={t('Tus clientes califican con estrellas y dejan un comentario en tu sitio. Sólo se publican las que apruebes.')}>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch checked={enabled} disabled={!canManage || busy} onChange={(event) => toggleEnabled(event.target.checked)} />}
            label={t('Pedir opiniones en la ficha de cada producto')}
          />
          {!canManage && (
            <Typography variant="caption" color="text.secondary">
              {t('Sólo el dueño o un administrador puede cambiar esto.')}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('Para mostrar las del negocio en tu página de inicio, agrega una sección de Testimonios y elige «Reseñas de clientes».')}{' '}
            <Link href="/dashboard/sitio">{t('Ir al sitio web')}</Link>
          </Typography>
        </Stack>
      </SectionCard>

      {enabled && <ReviewInviteCard {...invite} />}

      <SectionCard flush>
        <Tabs value={status} variant="scrollable" sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }} aria-label={t('Estado de las reseñas')}>
          {REVIEW_TABS.map((tab) => (
            <Tab
              key={tab.status}
              value={tab.status}
              component={Link}
              href={tab.status === 'pending' ? '/dashboard/resenas' : `/dashboard/resenas?estado=${tab.slug}`}
              label={
                tab.status === 'pending' && pending > 0 ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <span>{t(tab.label)}</span>
                    <Chip size="small" color="warning" label={pending} />
                  </Stack>
                ) : (
                  t(tab.label)
                )
              }
            />
          ))}
        </Tabs>
        {reviews.length === 0 ? (
          <EmptyState icon={MessageSquareText} title={t(EMPTY[status])} description={status === 'pending' && !enabled ? t('Activa las reseñas para empezar a recibirlas.') : undefined} />
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {reviews.map((review) => (
              <Box component="li" key={review.id} sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                      <Box component="span" role="img" aria-label={t('{rating} de 5 estrellas', { rating: review.rating })} sx={{ display: 'inline-flex', color: '#f5a524' }}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={15} fill={i < review.rating ? 'currentColor' : 'none'} aria-hidden />
                        ))}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {review.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <time dateTime={review.createdAt} title={formatDate(review.createdAt, locale)}>
                          {formatRelative(review.createdAt, locale, now)}
                        </time>
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
                      {review.item ? (review.item.name ? t('Sobre {item}', { item: review.item.name }) : t('Producto eliminado')) : t('Sobre tu negocio')}
                    </Typography>
                    {review.body ? (
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                        {review.body}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                        {t('Sin comentario')}
                      </Typography>
                    )}
                    {status !== 'rejected' && <ReviewReply key={review.reply ?? ''} review={review} onSaved={(reply) => setReply(review, reply)} />}
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    {status !== 'approved' && (
                      <Button size="small" variant="contained" startIcon={<Check size={14} />} disabled={busy} onClick={() => moderate(review, 'approved')}>
                        {t('Publicar')}
                      </Button>
                    )}
                    {status === 'pending' && (
                      <Button size="small" variant="outlined" color="inherit" startIcon={<X size={14} />} disabled={busy} onClick={() => moderate(review, 'rejected')}>
                        {t('Rechazar')}
                      </Button>
                    )}
                    {status === 'approved' && (
                      <Button size="small" variant="outlined" color="inherit" startIcon={<RotateCcw size={14} />} disabled={busy} onClick={() => moderate(review, 'pending')}>
                        {t('Ocultar')}
                      </Button>
                    )}
                    <Button size="small" color="error" startIcon={<Trash2 size={14} />} disabled={busy} onClick={() => void remove(review)} aria-label={t('Eliminar la reseña de {name}', { name: review.name })}>
                      {t('Eliminar')}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        )}
        {reviews.length >= pageSize && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 1.5 }}>
            {t('Mostrando las últimas {count} reseñas.', { count: pageSize })}
          </Typography>
        )}
      </SectionCard>
    </Stack>
  );
}
