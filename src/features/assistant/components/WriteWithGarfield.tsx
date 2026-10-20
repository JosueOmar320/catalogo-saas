'use client';

import { Alert, Box, Button, CircularProgress, Popover, Stack, TextField, Typography } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import type { WriteKind, WriteRequest } from '@/lib/assistant/writer';
import { GarfieldAvatar } from './GarfieldAvatar';
import { useT } from '@/i18n/client';

type Input = Omit<WriteRequest, 'kind' | 'instruction'>;
type State = { status: 'idle' } | { status: 'loading' } | { status: 'done'; options: string[]; basic: boolean; notice: string | null } | { status: 'error'; message: string };

/**
 * "Escribir con Garfield" junto a un campo: propone 2–3 textos y el usuario
 * elige uno (queda en el campo para editarlo; se guarda con el formulario).
 */
export function WriteWithGarfield({ kind, getInput, onPick, label }: { kind: WriteKind; getInput: () => Input; onPick: (text: string) => void; label?: string }) {
  const t = useT();
  const titleId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [instruction, setInstruction] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  const generate = async () => {
    setState({ status: 'loading' });
    try {
      const response = await fetch('/api/assistant/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, instruction, ...getInput() }),
      });
      const data = (await response.json().catch(() => ({}))) as { options?: string[]; mode?: string; notice?: string | null; error?: string };
      if (!response.ok || !data.options) return setState({ status: 'error', message: data.error ?? t('Garfield se enredó con la madeja. Intenta de nuevo.') });
      setState({ status: 'done', options: data.options, basic: data.mode === 'basic', notice: data.notice ?? null });
    } catch {
      setState({ status: 'error', message: t('Algo salió mal. Revisa tu conexión e intenta de nuevo.') });
    }
  };

  const open = (event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
    if (state.status === 'idle') void generate();
  };

  return (
    <>
      <Button size="small" onClick={open} startIcon={<Sparkles size={14} />} sx={{ alignSelf: 'flex-start', textTransform: 'none' }} aria-haspopup="dialog">
        {label ?? t('Escribir con Garfield')}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { role: 'dialog', 'aria-labelledby': titleId, sx: { width: 380, maxWidth: 'calc(100vw - 24px)', p: 2 } } }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <GarfieldAvatar size={28} ring={false} mood={state.status === 'loading' ? 'thinking' : state.status === 'error' ? 'worried' : 'happy'} />
          <Typography id={titleId} variant="subtitle2">{t('Garfield te propone')}</Typography>
        </Stack>

        <Stack spacing={1.25} aria-live="polite" aria-busy={state.status === 'loading'}>
          {state.status === 'loading' && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 2, justifyContent: 'center' }}>
              <CircularProgress size={18} aria-label={t('Escribiendo…')} />
              <Typography variant="body2" color="text.secondary">{t('Escribiendo…')}</Typography>
            </Stack>
          )}
          {state.status === 'error' && <Alert severity="warning">{state.message}</Alert>}
          {state.status === 'done' && (
            <>
              {state.notice && <Alert severity="info">{state.notice}</Alert>}
              {state.basic && !state.notice && <Typography variant="caption" color="text.secondary">{t('Sin IA: textos de partida armados con tus datos para que los ajustes.')}</Typography>}
              {state.options.map((option, index) => (
                <Box key={index} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 1 }}>{option}</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      onPick(option);
                      setAnchor(null);
                    }}
                    aria-label={t('Usar la opción {n}', { n: index + 1 })}
                  >
                    {t('Usar este')}
                  </Button>
                </Box>
              ))}
            </>
          )}
          <TextField
            size="small"
            label={t('Pedido (opcional)')}
            placeholder={t('ej. más corto, tono formal, menciona que es artesanal')}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void generate();
              }
            }}
          />
          <Button variant="contained" onClick={() => void generate()} disabled={state.status === 'loading'}>
            {state.status === 'done' ? t('Otras opciones') : t('Proponer textos')}
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
