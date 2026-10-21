'use client';

import { Box, Dialog, InputBase, ListSubheader, Stack, Typography } from '@mui/material';
import { ArrowRight, CornerDownLeft, FileText, Package, Plus, Search, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { listQuickItems } from '@/features/items/actions';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { ADMIN_NAVIGATION, navigationFor } from './navigation';
import type { SiteKind } from '@/lib/business/site-kind';
import { GarfieldAvatar } from '@/features/assistant/components/GarfieldAvatar';
import { askGarfield } from '@/features/assistant/components/PanelGarfield';

/**
 * Búsqueda rápida del panel (⌘K / Ctrl+K): secciones, acciones y productos o
 * servicios por nombre o código. Teclado: ↑ ↓ para moverse, Enter para abrir,
 * Esc para cerrar. Los ítems se piden una vez al abrir por primera vez.
 */
type Entry = { id: string; group: 'go' | 'action' | 'items' | 'ask'; label: string; hint?: string; href: string; icon: ReactNode; run?: () => void };

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const matches = (query: string, ...fields: (string | null | undefined)[]) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
};

const ACTIONS = [
  { label: msg('Nuevo producto'), href: '/dashboard/catalog/items/new?type=product', icon: <Plus size={16} />, catalogOnly: true },
  { label: msg('Nuevo servicio'), href: '/dashboard/catalog/items/new?type=service', icon: <Plus size={16} />, catalogOnly: true },
  { label: msg('Vista previa del sitio'), href: '/preview', icon: <FileText size={16} /> },
  { label: msg('Mi cuenta'), href: '/cuenta', icon: <ArrowRight size={16} /> },
];

/** Para que el botón de la barra superior pueda abrir la búsqueda. */
export const OPEN_PALETTE_EVENT = 'open-command-palette';

export function CommandPalette({ admin, siteKind = 'catalog' }: { admin: boolean; siteKind?: SiteKind }) {
  const catalog = siteKind === 'catalog';
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<{ id: string; name: string; sku: string | null; type: 'product' | 'service' }[] | null>(null);
  const loading = useRef(false);

  const show = useCallback(() => {
    setQuery('');
    setActive(0);
    setOpen(true);
    if (!admin && catalog && items === null && !loading.current) {
      loading.current = true;
      void listQuickItems().then((result) => {
        loading.current = false;
        if (result.ok) setItems(result.data);
      });
    }
  }, [admin, catalog, items]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (open) setOpen(false);
        else show();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, show);
    };
  }, [open, show]);

  const entries = useMemo<Entry[]>(() => {
    const navigation = (admin ? ADMIN_NAVIGATION : navigationFor(siteKind)).flatMap((entry): { label: string; hint?: string; href: string }[] =>
      entry.children
        ? entry.children.map((child) => ({ label: t(child.label), hint: t(entry.label), href: child.href }))
        : entry.href
          ? [{ label: t(entry.label), hint: undefined, href: entry.href }]
          : [],
    );
    const go: Entry[] = navigation
      .filter((n) => !query || matches(query, n.label, n.hint))
      .slice(0, query ? 6 : 12)
      .map((n) => ({ id: `go:${n.href}`, group: 'go', label: n.label, hint: n.hint, href: n.href, icon: <ArrowRight size={16} /> }));
    const actions: Entry[] = admin
      ? []
      : ACTIONS.filter((a) => (catalog || !('catalogOnly' in a)) && (!query || matches(query, t(a.label)))).map((a) => ({ id: `action:${a.href}`, group: 'action', label: t(a.label), href: a.href, icon: a.icon }));
    const found: Entry[] =
      !admin && query.trim() && items
        ? items
            .filter((item) => matches(query, item.name, item.sku))
            .slice(0, 8)
            .map((item) => ({
              id: `item:${item.id}`,
              group: 'items',
              label: item.name,
              hint: [item.type === 'product' ? t('Producto') : t('Servicio'), item.sku].filter(Boolean).join(' · '),
              href: `/dashboard/catalog/items/${item.id}`,
              icon: item.type === 'product' ? <Package size={16} /> : <Wrench size={16} />,
            }))
        : [];
    // Una pregunta ("¿cómo creo un cupón?") va a Garfield; siempre al final, para no tapar los resultados.
    const ask: Entry[] = !admin && query.trim().length >= 3 ? [{ id: 'ask', group: 'ask', label: t('Preguntar a Garfield: «{query}»', { query: query.trim() }), href: '', icon: <GarfieldAvatar size={18} ring={false} />, run: () => askGarfield(query.trim()) }] : [];
    return [...found, ...go, ...actions, ...ask];
  }, [admin, catalog, items, query, siteKind, t]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    if (entry.run) entry.run();
    else router.push(entry.href);
  };

  const GROUP_LABEL = { items: t('Productos y servicios'), go: t('Ir a'), action: t('Acciones'), ask: 'Garfield' };
  const activeEntry = entries[Math.min(active, entries.length - 1)];

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { position: 'fixed', top: { xs: 16, sm: '12vh' }, m: { xs: 1.5, sm: 4 }, width: { xs: 'calc(100% - 24px)' } } } }}
      aria-label={t('Búsqueda rápida')}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Search size={18} aria-hidden />
        <InputBase
          autoFocus
          fullWidth
          placeholder={admin || !catalog ? t('Ir a una sección…') : t('Busca productos, servicios o secciones…')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, entries.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              go(activeEntry);
            }
          }}
          inputProps={{
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': listId,
            'aria-activedescendant': activeEntry ? `${listId}-${activeEntry.id}` : undefined,
            'aria-label': t('Buscar'),
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ border: 1, borderColor: 'divider', borderRadius: 0.75, px: 0.75, display: { xs: 'none', sm: 'block' } }}>
          Esc
        </Typography>
      </Stack>
      <Box component="ul" id={listId} role="listbox" aria-label={t('Resultados')} sx={{ listStyle: 'none', m: 0, p: 1, maxHeight: '55vh', overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <Typography component="li" variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            {!admin && catalog && items === null ? t('Cargando…') : t('Sin resultados para "{query}"', { query })}
          </Typography>
        ) : (
          entries.map((entry, index) => (
            <Box component="li" key={entry.id} role="presentation">
              {(index === 0 || entries[index - 1].group !== entry.group) && (
                <ListSubheader component="div" role="presentation" sx={{ lineHeight: '28px', bgcolor: 'transparent', px: 1 }}>
                  {GROUP_LABEL[entry.group]}
                </ListSubheader>
              )}
              <Box
                id={`${listId}-${entry.id}`}
                role="option"
                aria-selected={entry === activeEntry}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(entry)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  color: 'text.primary',
                  bgcolor: entry === activeEntry ? 'action.selected' : 'transparent',
                }}
              >
                <Box sx={{ display: 'flex', color: 'text.secondary' }} aria-hidden>{entry.icon}</Box>
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{entry.label}</Typography>
                {entry.hint && <Typography variant="caption" color="text.secondary" noWrap>{entry.hint}</Typography>}
                {entry === activeEntry && <CornerDownLeft size={14} aria-hidden />}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Dialog>
  );
}
