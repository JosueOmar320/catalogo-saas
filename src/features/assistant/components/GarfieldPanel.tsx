'use client';

import { Alert, Box, Button, ButtonBase, Chip, Fade, IconButton, InputBase, keyframes, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { AlertTriangle, Check, Database, Eye, EyeOff, ImagePlus, Minus, RotateCcw, SendHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { useToast } from '@/components/feedback/ToastProvider';
import { UploadError, uploadImage } from '@/features/media/client';
import { useT } from '@/i18n/client';
import { interpolate } from '@/i18n/translate';
import { ASSISTANT } from '@/lib/assistant/identity';
import { publicStorageUrl } from '@/lib/utils/storage';
import { GarfieldAvatar } from './GarfieldAvatar';
import { useFeatureEnabled } from '@/components/dashboard/DashboardContext';
import { useGarfield, type ChatAttachment, type ChatEntry } from './GarfieldProvider';

const ORANGE = '#F28C28';
const dots = keyframes`
  0%, 80%, 100% { opacity: .25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`;
const rise = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`;

/* ------------------------------------------------------------ Botón flotante */

export function GarfieldLauncher() {
  const { open, setOpen, pending } = useGarfield();
  const enabled = useFeatureEnabled('assistant');
  const t = useT();
  if (open || !enabled) return null;
  return (
    <Tooltip title={t('Pídele a Garfield que construya o cambie tu página')} placement="left">
      <ButtonBase
        onClick={() => setOpen(true)}
        aria-label={t('Abrir {name}', { name: ASSISTANT.name })}
        sx={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 1200,
          gap: 1,
          pl: 0.75,
          pr: 1.75,
          py: 0.75,
          borderRadius: 99,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: `${ORANGE}55`,
          boxShadow: '0 8px 24px rgba(30, 20, 10, .16)',
          transition: 'transform .15s ease, box-shadow .15s ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(30, 20, 10, .2)' },
          animation: `${rise} .3s ease-out`,
        }}
      >
        <GarfieldAvatar size={38} mood={pending ? 'thinking' : 'idle'} />
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{ASSISTANT.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>{pending ? t('Pensando…') : t('¿Qué construimos?')}</Typography>
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}

/* ------------------------------------------------------------ Panel */

export function GarfieldPanel() {
  const g = useGarfield();
  const enabled = useFeatureEnabled('assistant');
  const { businessId } = useDashboard();
  const toast = useToast();
  const t = useT();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const suggestions = g.suggestions;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [g.entries.length, g.pending]);
  useEffect(() => {
    if (g.open) input.current?.focus();
  }, [g.open]);

  const submit = () => {
    if ((!text.trim() && attachments.length === 0) || g.pending || uploading) return;
    void g.send(text, attachments);
    setText('');
    setAttachments([]);
  };
  // Imágenes adjuntas: se suben a la biblioteca del negocio y Garfield puede usarlas ("ponla de fondo").
  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of [...files].slice(0, 4 - attachments.length)) {
        const uploaded = await uploadImage(file, businessId, 'site', { source: 'chat' });
        setAttachments((list) => [...list, { path: uploaded.path, url: publicStorageUrl(uploaded.path)!, alt: uploaded.alt ?? '' }]);
      }
    } catch (error) {
      toast.error(error instanceof UploadError ? t(error.message) : t('No se pudo subir la imagen.'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  const lastAssistant = [...g.entries].reverse().find((e) => e.role === 'assistant' && !e.error);
  // Las sugerencias se envían en español (las entiende también el modo básico) y se muestran traducidas.
  const sendSuggestion = (s: (typeof suggestions.items)[number]) => void g.send(interpolate(s.prompt, s.params), [], t(s.prompt, s.params));

  if (!enabled) return null;
  return (
    <Fade in={g.open} unmountOnExit>
      <Paper
        role="dialog"
        aria-label={ASSISTANT.name}
        elevation={0}
        sx={{
          position: 'fixed',
          right: { xs: 8, sm: 20 },
          bottom: { xs: 8, sm: 20 },
          zIndex: 1250,
          width: { xs: 'calc(100vw - 16px)', sm: 400 },
          height: { xs: 'calc(100vh - 80px)', sm: 'min(660px, calc(100vh - 96px))' },
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          boxShadow: '0 20px 50px rgba(30, 20, 10, .22)',
        }}
      >
        {/* Encabezado */}
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 1.5, py: 1.1, background: `linear-gradient(135deg, var(--garfield-header-from), var(--garfield-header-to))`, borderBottom: 1, borderColor: `${ORANGE}33` }}>
          <GarfieldAvatar size={36} mood={g.pending ? 'thinking' : 'idle'} ring={false} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography variant="body1" sx={{ fontWeight: 750 }}>{ASSISTANT.name}</Typography>
              {g.editor === 'pdf' && <Chip size="small" label="PDF" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: 'var(--garfield-chip)' }} />}
              {g.mode === 'basic' && (
                <Tooltip title={t('Sin IA (o sin cuota por hoy): entiendo pedidos directos. Configura GEMINI_API_KEY (gratis) para conversar libremente.')}>
                  <Chip size="small" label={t('Modo básico')} sx={{ height: 20, fontSize: 11, bgcolor: 'var(--garfield-chip)' }} />
                </Tooltip>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap component="p">{g.pending ? t('Garfield está pensando…') : t(ASSISTANT.tagline)}</Typography>
          </Box>
          {g.entries.length > 0 && (
            <Tooltip title={t('Nueva conversación')}>
              <IconButton size="small" onClick={g.clear} aria-label={t('Nueva conversación')}><Trash2 size={15} /></IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('Minimizar')}>
            <IconButton size="small" onClick={() => g.setOpen(false)} aria-label={t('Minimizar')}><Minus size={16} /></IconButton>
          </Tooltip>
          <Tooltip title={t('Cerrar')}>
            <IconButton size="small" onClick={() => { g.exitPreview(); g.setOpen(false); }} aria-label={t('Cerrar')}><X size={16} /></IconButton>
          </Tooltip>
        </Stack>

        {/* Conversación */}
        <Box ref={list} sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5, bgcolor: 'var(--garfield-surface)' }} aria-live="polite">
          <AssistantBubble>
            <Typography variant="body2">{t(ASSISTANT.greeting)}</Typography>
          </AssistantBubble>
          {g.entries.length === 0 && (
            <Box sx={{ pl: 5.5, mt: 1, animation: `${rise} .3s ease-out` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t(suggestions.title)}</Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                {suggestions.items.map((s) => (
                  <Chip key={s.label} label={t(s.label)} onClick={() => sendSuggestion(s)} variant="outlined" sx={{ bgcolor: 'var(--garfield-chip)', borderColor: `${ORANGE}55`, '&:hover': { bgcolor: 'var(--garfield-tint)' } }} />
                ))}
              </Stack>
            </Box>
          )}
          {g.entries.map((entry) => (entry.role === 'user' ? <UserBubble key={entry.id} text={entry.display ?? entry.text} attachments={entry.attachments} /> : <AssistantEntry key={entry.id} entry={entry} latest={entry.id === lastAssistant?.id} />))}
          {g.pending && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
              <GarfieldAvatar size={32} mood="thinking" />
              <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', display: 'flex', gap: 0.5 }}>
                {[0, 1, 2].map((i) => (
                  <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ORANGE, animation: `${dots} 1.1s ${i * 0.15}s infinite ease-in-out` }} />
                ))}
              </Box>
            </Stack>
          )}
        </Box>

        {/* Sugerencias de contexto (con conversación iniciada) */}
        {g.entries.length > 0 && !g.pending && (
          <Stack direction="row" sx={{ gap: 0.75, px: 1.5, pt: 1, overflowX: 'auto', scrollbarWidth: 'none', borderTop: 1, borderColor: 'divider' }}>
            {suggestions.items.slice(0, 4).map((s) => (
              <Chip key={s.label} size="small" label={t(s.label)} onClick={() => sendSuggestion(s)} variant="outlined" sx={{ flex: 'none' }} />
            ))}
          </Stack>
        )}

        {/* Adjuntos */}
        {(attachments.length > 0 || uploading) && (
          <Stack direction="row" spacing={1} sx={{ px: 1.5, pt: 1, alignItems: 'center' }}>
            {attachments.map((a) => (
              <Box key={a.path} sx={{ position: 'relative' }}>
                <Box component="img" src={a.url} alt={a.alt} sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1.5, border: 1, borderColor: 'divider', display: 'block' }} />
                <IconButton size="small" onClick={() => setAttachments((list) => list.filter((x) => x.path !== a.path))} aria-label={t('Quitar imagen')} sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', border: 1, borderColor: 'divider', p: 0.25, '&:hover': { bgcolor: 'background.paper' } }}>
                  <X size={11} />
                </IconButton>
              </Box>
            ))}
            {uploading && <Typography variant="caption" color="text.secondary">{t('Subiendo…')}</Typography>}
          </Stack>
        )}

        {/* Entrada */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', p: 1.25 }}>
          <Tooltip title={t('Adjuntar imágenes (Garfield puede usarlas)')}>
            <span>
              <IconButton onClick={() => fileInput.current?.click()} disabled={uploading || attachments.length >= 4} aria-label={t('Adjuntar imagen')} sx={{ width: 40, height: 40 }}>
                <ImagePlus size={18} />
              </IconButton>
            </span>
          </Tooltip>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void attach(e.target.files)} />
          <InputBase
            inputRef={input}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            onKeyDown={onKey}
            placeholder={t('Escribe lo que quieres hacer…')}
            multiline
            maxRows={5}
            sx={{ flex: 1, px: 1.5, py: 1, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', fontSize: 14, '&.Mui-focused': { borderColor: ORANGE, boxShadow: `0 0 0 3px ${ORANGE}22` } }}
            inputProps={{ 'aria-label': t('Mensaje para Garfield') }}
          />
          <IconButton onClick={submit} disabled={(!text.trim() && attachments.length === 0) || g.pending || uploading} aria-label={t('Enviar')} sx={{ bgcolor: ORANGE, color: '#fff', width: 40, height: 40, '&:hover': { bgcolor: '#D96F12' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
            <SendHorizontal size={18} />
          </IconButton>
        </Stack>
      </Paper>
    </Fade>
  );
}

/* ------------------------------------------------------------ Mensajes */

function UserBubble({ text, attachments }: { text: string; attachments?: ChatAttachment[] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mt: 1.5, animation: `${rise} .2s ease-out` }}>
      {attachments && attachments.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ mb: 0.5 }}>
          {attachments.map((a) => <Box key={a.path} component="img" src={a.url} alt={a.alt} sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1.5 }} />)}
        </Stack>
      )}
      <Box sx={{ maxWidth: '82%', px: 1.5, py: 1, borderRadius: '14px 14px 4px 14px', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</Typography>
      </Box>
    </Box>
  );
}

function AssistantBubble({ children, mood = 'idle', error }: { children: React.ReactNode; mood?: 'idle' | 'happy' | 'worried'; error?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mt: 1.5, animation: `${rise} .25s ease-out` }}>
      <GarfieldAvatar size={32} mood={mood} />
      <Box sx={{ flex: 1, minWidth: 0, px: 1.5, py: 1, borderRadius: '4px 14px 14px 14px', bgcolor: error ? 'var(--garfield-error-bg)' : 'background.paper', border: 1, borderColor: error ? 'var(--garfield-error-border)' : 'divider' }}>{children}</Box>
    </Stack>
  );
}

function AssistantEntry({ entry, latest }: { entry: ChatEntry; latest: boolean }) {
  const g = useGarfield();
  const t = useT();
  const mood = entry.error || entry.plan?.status === 'failed' ? 'worried' : entry.plan?.status === 'applied' ? 'happy' : 'idle';
  return (
    <AssistantBubble mood={mood} error={entry.error}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.text}</Typography>
      {entry.local && g.mode === 'ai' && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>{t('⚡ Resuelto al instante, sin usar IA')}</Typography>
      )}
      {entry.plan && <PlanCard entry={entry} />}
      {latest && entry.suggestions && entry.suggestions.length > 0 && !g.pending && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {entry.suggestions.map((s) => (
            <Chip key={s} size="small" label={s} onClick={() => void g.send(s)} sx={{ bgcolor: 'var(--garfield-tint)', '&:hover': { bgcolor: 'var(--garfield-tint-hover)' } }} />
          ))}
        </Stack>
      )}
    </AssistantBubble>
  );
}

/* ------------------------------------------------------------ Plan de cambios */

function PlanCard({ entry }: { entry: ChatEntry }) {
  const g = useGarfield();
  const t = useT();
  const plan = entry.plan!;
  const previewing = g.previewingId === entry.id;
  const ok = plan.steps.filter((s) => s.status === 'ok');
  const failed = plan.steps.filter((s) => s.status === 'error');
  const destructiveKinds = plan.actions.filter((a, i) => plan.steps[i]?.status === 'ok' && (a.action === 'delete_page' || a.action === 'delete_section' || a.action === 'remove_nav_item')).map((a) => a.action);
  const confirmLabel = !plan.destructive
    ? plan.hasCatalogChanges ? t('Aplicar y guardar') : plan.needsConfirmation ? t('Confirmar y aplicar') : t('Aplicar cambios')
    : ok.length === 1 ? { delete_page: t('Eliminar página'), delete_section: t('Eliminar sección'), remove_nav_item: t('Quitar del menú') }[destructiveKinds[0] as 'delete_page'] : t('Aplicar y eliminar');

  return (
    <Box sx={{ mt: 1, border: 1, borderColor: plan.destructive && plan.status === 'proposed' ? 'var(--garfield-error-border)' : 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 1.25, py: 0.75, bgcolor: plan.status === 'applied' ? 'var(--garfield-applied-bg)' : plan.destructive && plan.status === 'proposed' ? 'var(--garfield-error-bg)' : 'var(--garfield-neutral-bg)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {plan.status === 'applied' ? <Check size={14} color="var(--garfield-applied-ink)" /> : plan.needsConfirmation && plan.status === 'proposed' ? <AlertTriangle size={14} color="var(--garfield-warn-ink)" /> : <Sparkles size={14} color={ORANGE} />}
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {{ proposed: plan.needsConfirmation ? t('Necesito tu confirmación') : t('He preparado estos cambios'), applied: t('Cambios aplicados al borrador'), cancelled: t('Cancelado'), undone: t('Cambios deshechos'), failed: t('No pude aplicar estos cambios'), expired: t('Propuesta anterior (vencida)') }[plan.status]}
        </Typography>
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, px: 1.25, py: 0.75 }}>
        {plan.steps.map((step, i) => (
          <Box component="li" key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', py: 0.25 }}>
            <Box sx={{ mt: '3px', flex: 'none', color: step.status === 'error' ? 'error.main' : step.risk === 'confirm' ? 'var(--garfield-warn-ink)' : step.kind === 'catalog' ? 'var(--garfield-catalog-ink)' : 'var(--garfield-applied-ink)' }}>
              {step.status === 'error' ? <X size={13} /> : step.risk === 'confirm' ? <AlertTriangle size={13} /> : step.kind === 'catalog' ? <Database size={13} /> : <Check size={13} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" component="p" sx={{ lineHeight: 1.4, color: step.status === 'error' ? 'text.secondary' : 'text.primary', textDecoration: plan.status === 'cancelled' || plan.status === 'undone' ? 'line-through' : 'none' }}>{step.label}</Typography>
              {step.error && <Typography variant="caption" color="error.main" component="p" sx={{ lineHeight: 1.3 }}>{step.error}</Typography>}
            </Box>
          </Box>
        ))}
      </Box>
      {plan.status === 'proposed' && plan.hasCatalogChanges && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 1.25, pb: 0.75, display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Database size={12} /> {t('Los pasos de productos y categorías se guardan en tu catálogo al aplicar.')}
        </Typography>
      )}
      {plan.status === 'proposed' && ok.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ px: 1.25, pb: 1.1, flexWrap: 'wrap', rowGap: 0.75 }}>
          <Button size="small" variant="contained" color={plan.destructive ? 'error' : 'primary'} onClick={() => void g.applyPlan(entry.id)} disabled={g.pending} sx={{ bgcolor: plan.destructive ? undefined : ORANGE, '&:hover': { bgcolor: plan.destructive ? undefined : '#D96F12' } }}>
            {confirmLabel}
          </Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={previewing ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => (previewing ? g.exitPreview() : g.previewPlan(entry.id))}>
            {previewing ? t('Salir de la vista previa') : t('Vista previa')}
          </Button>
          <Button size="small" color="inherit" onClick={() => g.cancelPlan(entry.id)}>{t('Cancelar')}</Button>
        </Stack>
      )}
      {plan.status === 'applied' && plan.undo !== undefined && (
        <Stack direction="row" sx={{ px: 1.25, pb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">{plan.steps.some((x) => (x.kind === 'editor' || x.kind === 'pdf') && x.status === 'ok') ? (g.editor === 'pdf' ? t('Recuerda pulsar «Guardar» en el estudio.') : t('Recuerda pulsar «Guardar cambios».')) : t('Guardado en tu catálogo.')}</Typography>
          <Button size="small" color="inherit" startIcon={<RotateCcw size={13} />} onClick={() => g.undoPlan(entry.id)}>{t('Deshacer')}</Button>
        </Stack>
      )}
      {failed.length > 0 && ok.length > 0 && plan.status !== 'applied' && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 1.25, pb: 1 }}>{t('Los pasos marcados con ✕ se omitirán.')}</Typography>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------ Aviso en la vista previa */

export function GarfieldPreviewBanner() {
  const g = useGarfield();
  const enabled = useFeatureEnabled('assistant');
  const t = useT();
  if (!g.previewingId || !enabled) return null;
  return (
    <Alert
      severity="warning"
      icon={<GarfieldAvatar size={24} ring={false} />}
      sx={{ mb: 1.5, py: 0, alignItems: 'center', bgcolor: 'var(--garfield-tint)', border: 1, borderColor: `${ORANGE}55` }}
      action={
        <Stack direction="row" spacing={0.5}>
          <Button size="small" color="inherit" onClick={g.exitPreview}>{t('Salir')}</Button>
          <Button size="small" variant="contained" disabled={g.pending} onClick={() => void g.applyPlan(g.previewingId!)} sx={{ bgcolor: ORANGE, '&:hover': { bgcolor: '#D96F12' } }}>{t('Aplicar')}</Button>
        </Stack>
      }
    >
      {t('Vista previa de Garfield: así quedaría. Nada cambia hasta que lo apliques.')}
    </Alert>
  );
}

/* ------------------------------------------------------------ Ayuda pequeña dentro del editor */

export function GarfieldHint({ text, prompt, action }: { text: string; prompt: string; action?: string }) {
  const g = useGarfield();
  const enabled = useFeatureEnabled('assistant');
  const t = useT();
  if (!enabled) return null;
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', p: 1.25, borderRadius: 2, bgcolor: 'var(--garfield-callout)', border: 1, borderColor: `${ORANGE}40` }}>
      <GarfieldAvatar size={34} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" component="p" sx={{ lineHeight: 1.35 }}>{text}</Typography>
        <Button size="small" onClick={() => g.ask(prompt)} sx={{ px: 0, minWidth: 0, color: 'var(--garfield-link)', fontWeight: 700 }}>{action ?? t('Pedírselo a Garfield')} →</Button>
      </Box>
    </Stack>
  );
}
