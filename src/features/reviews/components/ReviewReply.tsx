'use client';

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { MessageSquareReply } from 'lucide-react';
import { useState } from 'react';
import { WriteWithGarfield } from '@/features/assistant/components/WriteWithGarfield';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { replyToReview } from '../actions';
import type { PanelReview } from '../queries';

const MAX = 1000;

/** Respuesta pública del negocio debajo de una reseña: escribirla (o pedírsela a Garfield), editarla o quitarla. */
export function ReviewReply({ review, onSaved }: { review: PanelReview; onSaved: (reply: string | null) => void }) {
  const t = useT();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply ?? '');

  const save = (value: string | null) => {
    void run(() => replyToReview({ id: review.id, reply: value ?? '' }), {
      onSuccess: () => {
        onSaved(value);
        setText(value ?? '');
        setEditing(false);
      },
    });
  };

  if (editing) {
    return (
      <Stack spacing={1} sx={{ mt: 1.5 }}>
        <TextField
          multiline
          minRows={2}
          size="small"
          label={t('Tu respuesta (pública)')}
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX))}
          helperText={`${text.length}/${MAX}`}
          autoFocus
        />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <Button size="small" variant="contained" disabled={pending || !text.trim()} onClick={() => save(text.trim())}>
            {t('Publicar respuesta')}
          </Button>
          <Button size="small" color="inherit" disabled={pending} onClick={() => { setText(review.reply ?? ''); setEditing(false); }}>
            {t('Cancelar')}
          </Button>
          <WriteWithGarfield
            kind="review_reply"
            getInput={() => ({ current: text, review: { name: review.name, rating: review.rating, body: review.body, item: review.item?.name ?? '' } })}
            onPick={setText}
          />
        </Stack>
      </Stack>
    );
  }

  if (review.reply) {
    return (
      <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: 3, borderColor: 'primary.main' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t('Tu respuesta')}
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {review.reply}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Button size="small" disabled={pending} onClick={() => setEditing(true)}>
            {t('Editar respuesta')}
          </Button>
          <Button size="small" color="inherit" disabled={pending} onClick={() => save(null)}>
            {t('Quitar respuesta')}
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Button size="small" startIcon={<MessageSquareReply size={14} />} sx={{ mt: 1 }} onClick={() => setEditing(true)} aria-label={t('Responder a {name}', { name: review.name })}>
      {t('Responder')}
    </Button>
  );
}
