'use client';

import { Box, Button, Chip, CircularProgress, Drawer, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowRight, Send, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { findArea } from '@/lib/assistant/panel-guide';
import { GarfieldAvatar } from './GarfieldAvatar';
import { useT } from '@/i18n/client';

/** Otro componente (la búsqueda rápida) puede abrir la ayuda con una pregunta. */
export const OPEN_HELP_EVENT = 'open-garfield-help';
export const askGarfield = (question?: string) => window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT, { detail: question }));

/** El editor del sitio y el estudio de PDF tienen su propio Garfield (que además hace los cambios). */
const HAS_OWN_GARFIELD = ['/dashboard/sitio', '/dashboard/export/pdf'];

type Message = { role: 'user' | 'assistant'; content: string; links?: string[] };

/**
 * Garfield en todo el panel: responde dónde y cómo se hace algo y lleva al
 * lugar (sólo a las áreas de la guía). La conversación sigue al navegar.
 */
export function PanelGarfield() {
  const t = useT();
  const pathname = usePathname() ?? '/dashboard';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const hidden = HAS_OWN_GARFIELD.some((path) => pathname.startsWith(path));

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    const history: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    setSuggestions([]);
    setError(null);
    setPending(true);
    try {
      const response = await fetch('/api/assistant/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })), path: pathname }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; links?: string[]; suggestions?: string[]; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error ?? t('Garfield se enredó con la madeja. Intenta de nuevo.'));
      setMessages([...history, { role: 'assistant', content: data.message, links: data.links ?? [] }]);
      setSuggestions(data.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Algo salió mal. Revisa tu conexión e intenta de nuevo.'));
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      setOpen(true);
      const question = (event as CustomEvent<string | undefined>).detail;
      if (question) void ask(question);
      else setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener(OPEN_HELP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HELP_EVENT, onOpen);
  });

  // Llaves: scrollIntoView devuelve una promesa en Chromium y un efecto sólo puede devolver su limpieza.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, pending]);

  if (hidden) return null;
  const starters = [t('¿Cómo creo un cupón de descuento?'), t('¿Dónde cambio mi horario?'), t('¿Cómo subo varios productos a la vez?')];

  return (
    <>
      <Tooltip title={t('Preguntar a Garfield')}>
        <IconButton onClick={() => askGarfield()} aria-label={t('Preguntar a Garfield')} sx={{ p: 0.5 }}>
          <GarfieldAvatar size={28} ring={false} />
        </IconButton>
      </Tooltip>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 }, display: 'flex', flexDirection: 'column' }, role: 'dialog', 'aria-label': t('Ayuda de Garfield') } }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <GarfieldAvatar size={36} mood={pending ? 'thinking' : error ? 'worried' : 'idle'} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Garfield</Typography>
            <Typography variant="caption" color="text.secondary">{t('Te digo dónde está cada cosa y te llevo.')}</Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} aria-label={t('Cerrar')}><X size={18} /></IconButton>
        </Stack>

        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }} aria-live="polite">
          {messages.length === 0 && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">{t('Pregúntame cómo hacer algo en el panel. Por ejemplo:')}</Typography>
              {starters.map((starter) => (
                <Chip key={starter} label={starter} variant="outlined" onClick={() => void ask(starter)} sx={{ alignSelf: 'flex-start', height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }} />
              ))}
            </Stack>
          )}
          <Stack spacing={1.5}>
            {messages.map((message, index) => (
              <Box key={index} sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: message.role === 'user' ? 'primary.main' : 'action.hover', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{message.content}</Typography>
                </Box>
                {message.links && message.links.length > 0 && (
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {message.links.flatMap((id) => {
                      const area = findArea(id);
                      return area
                        ? [
                            <Button key={id} component={Link} href={area.href} size="small" variant="outlined" endIcon={<ArrowRight size={14} />} sx={{ alignSelf: 'flex-start', textTransform: 'none' }} onClick={() => window.innerWidth < 600 && setOpen(false)}>
                              {t('Ir a {area}', { area: t(area.title) })}
                            </Button>,
                          ]
                        : [];
                    })}
                  </Stack>
                )}
              </Box>
            ))}
            {pending && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={16} aria-label={t('Garfield está pensando…')} />
                <Typography variant="caption" color="text.secondary">{t('Garfield está pensando…')}</Typography>
              </Stack>
            )}
            {error && <Typography variant="body2" color="error">{error}</Typography>}
            {suggestions.length > 0 && !pending && (
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {suggestions.map((suggestion) => (
                  <Chip key={suggestion} size="small" label={suggestion} variant="outlined" onClick={() => void ask(suggestion)} />
                ))}
              </Stack>
            )}
            <div ref={endRef} />
          </Stack>
        </Box>

        <Stack
          component="form"
          direction="row"
          spacing={1}
          sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}
          onSubmit={(event) => {
            event.preventDefault();
            void ask(input);
          }}
        >
          <TextField inputRef={inputRef} size="small" fullWidth placeholder={t('Escribe tu pregunta…')} value={input} onChange={(e) => setInput(e.target.value.slice(0, 2000))} slotProps={{ htmlInput: { 'aria-label': t('Pregunta para Garfield') } }} />
          <IconButton type="submit" color="primary" disabled={!input.trim() || pending} aria-label={t('Enviar')}><Send size={18} /></IconButton>
        </Stack>
      </Drawer>
    </>
  );
}
