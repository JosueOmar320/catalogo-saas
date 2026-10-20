'use client';

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Bookmark, Trash2 } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useAction } from '@/lib/hooks/use-action';
import { SECTION_META } from '@/lib/site/section-registry';
import type { Section } from '@/lib/site/section-schemas';
import { Icon } from '@/site-renderer/Icon';
import { deleteSectionTemplate, saveSectionTemplate } from '../actions';
import type { SectionTemplate } from '../queries';
import { useT } from '@/i18n/client';

type Value = {
  templates: SectionTemplate[];
  canManage: boolean;
  pending: boolean;
  save: (name: string, section: Section) => Promise<boolean>;
  remove: (id: string) => void;
};

const SectionTemplatesContext = createContext<Value | null>(null);

/**
 * "Mis plantillas": secciones que el negocio guardó para reusar. Se guardan
 * al instante (no esperan a "Guardar cambios"): son del negocio, no del sitio.
 */
export function SectionTemplatesProvider({ initial, canManage, children }: { initial: SectionTemplate[]; canManage: boolean; children: ReactNode }) {
  const [templates, setTemplates] = useState(initial);
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const t = useT();

  const save = async (name: string, section: Section) => {
    const result = await run(() => saveSectionTemplate(name, section), { onSuccess: (template) => setTemplates((list) => [template, ...list]) });
    return Boolean(result?.ok);
  };
  const remove = async (id: string) => {
    const template = templates.find((x) => x.id === id);
    const ok = await confirm({ title: t('¿Borrar la plantilla «{name}»?', { name: template?.name ?? '' }), description: t('Las páginas que ya la usan no cambian.'), confirmLabel: t('Borrar'), destructive: true });
    if (ok) await run(() => deleteSectionTemplate(id), { onSuccess: () => setTemplates((list) => list.filter((x) => x.id !== id)) });
  };

  return <SectionTemplatesContext.Provider value={{ templates, canManage, pending, save, remove: (id) => void remove(id) }}>{children}</SectionTemplatesContext.Provider>;
}

export function useSectionTemplates(): Value {
  const value = useContext(SectionTemplatesContext);
  if (!value) throw new Error('useSectionTemplates fuera de SectionTemplatesProvider');
  return value;
}

/** Copia de la plantilla lista para insertar (ids nuevos). */
export function instantiateTemplate(template: SectionTemplate): Section {
  return { ...structuredClone(template.section), id: crypto.randomUUID() };
}

/** Botón + diálogo "Guardar como plantilla" del editor de sección. */
export function SaveAsTemplateButton({ section }: { section: Section }) {
  const t = useT();
  const { save, pending, canManage } = useSectionTemplates();
  const [name, setName] = useState<string | null>(null);
  if (!canManage) return null;
  const submit = async () => {
    if (name && (await save(name, section))) setName(null);
  };
  return (
    <>
      <Tooltip title={t('Guardar como plantilla')}>
        <IconButton onClick={() => setName(section.name || t(SECTION_META[section.type].label))} aria-label={t('Guardar como plantilla')}><Bookmark size={16} /></IconButton>
      </Tooltip>
      <Dialog open={name !== null} onClose={() => setName(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('Guardar como plantilla')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('Podrás agregar una copia de esta sección (contenido y estilo) en cualquier página desde «Sección» › Mis plantillas.')}</Typography>
          <TextField
            autoFocus
            fullWidth
            label={t('Nombre')}
            value={name ?? ''}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setName(null)}>{t('Cancelar')}</Button>
          <Button variant="contained" onClick={() => void submit()} disabled={!name?.trim() || pending}>{t('Guardar')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Lista "Mis plantillas" dentro del selector de secciones. */
export function TemplateList({ onPick }: { onPick: (section: Section) => void }) {
  const t = useT();
  const { templates, remove, canManage } = useSectionTemplates();
  if (templates.length === 0) return null;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>{t('Mis plantillas')}</Typography>
      {templates.map((template) => (
        <Stack key={template.id} direction="row" sx={{ alignItems: 'center', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
          <Button
            color="inherit"
            onClick={() => onPick(instantiateTemplate(template))}
            sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1.25, textAlign: 'left', textTransform: 'none', p: 1 }}
          >
            <Box sx={{ color: 'primary.main', display: 'flex' }}><Icon id={SECTION_META[template.section.type].icon} size={18} /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{template.name}</Typography>
              <Typography variant="caption" color="text.secondary">{t(SECTION_META[template.section.type].label)}</Typography>
            </Box>
          </Button>
          {canManage && (
            <IconButton size="small" onClick={() => remove(template.id)} aria-label={t('Borrar la plantilla «{name}»', { name: template.name })}><Trash2 size={14} /></IconButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}
