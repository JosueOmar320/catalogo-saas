'use client';

import { Button, Stack, Typography } from '@mui/material';
import { Check, Copy, Send } from 'lucide-react';
import { useState } from 'react';
import { QrCodeButton } from '@/components/dashboard/QrCodeButton';
import { CopyField } from '@/components/ui/CopyField';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { reviewInviteMessage } from '../invite';

/** "Pide reseñas": el enlace que abre el formulario, un mensaje listo para WhatsApp y su QR para el mostrador. */
export function ReviewInviteCard({ url, businessName, slug, published }: { url: string; businessName: string; slug: string; published: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const message = reviewInviteMessage(t, businessName, url);

  const copy = async () => {
    const done = await navigator.clipboard.writeText(message).then(() => true, () => false);
    if (!done) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <SectionCard title={t('Pide reseñas')} description={t('Comparte este enlace con tus clientes: abre tu sitio con el formulario de opinión listo.')}>
      <Stack spacing={1.5}>
        <CopyField value={url} label={t('Enlace para opinar')} />
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
          {message}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Button size="small" variant="outlined" startIcon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>
            {copied ? t('Copiado') : t('Copiar mensaje')}
          </Button>
          <Button size="small" variant="outlined" startIcon={<Send size={14} />} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            {t('Enviar por WhatsApp')}
          </Button>
          <QrCodeButton url={url} businessName={businessName} slug={slug} published={published} source="reviews" />
        </Stack>
      </Stack>
    </SectionCard>
  );
}
