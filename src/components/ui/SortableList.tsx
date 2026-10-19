'use client';

import { Box, IconButton, Stack, Tooltip } from '@mui/material';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/client';

type Props<T> = {
  items: T[];
  getId: (item: T) => string;
  /** Se llama con el nuevo orden al soltar o al usar las flechas. */
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  disabled?: boolean;
};

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Lista reordenable sin dependencias: arrastrar (escritorio) + flechas
 * (teclado y pantallas táctiles).
 */
export function SortableList<T>({ items, getId, onReorder, renderItem, disabled }: Props<T>) {
  const t = useT();
  const [draft, setDraft] = useState<T[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const list = draft ?? items;

  const finishDrag = () => {
    if (draft && draft.map(getId).join() !== items.map(getId).join()) onReorder(draft);
    setDraft(null);
    setDragId(null);
  };

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {list.map((item, index) => {
        const id = getId(item);
        return (
          <Box
            component="li"
            key={id}
            onDragOver={(e) => {
              if (!dragId || dragId === id) return;
              e.preventDefault();
              const from = list.findIndex((i) => getId(i) === dragId);
              setDraft(moveItem(list, from, index));
            }}
            onDrop={(e) => {
              e.preventDefault();
              finishDrag();
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: 0.75,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: dragId === id ? 'primary.light' : 'background.paper',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <Box
              draggable={!disabled}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragId(id);
              }}
              onDragEnd={finishDrag}
              aria-hidden
              sx={{ display: { xs: 'none', sm: 'flex' }, color: 'text.secondary', cursor: disabled ? 'default' : 'grab', p: 0.5 }}
            >
              <GripVertical size={16} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>{renderItem(item, index)}</Box>
            <Stack direction="row" sx={{ flexShrink: 0 }}>
              <Tooltip title={t('Mover arriba')}>
                <span>
                  <IconButton disabled={disabled || index === 0} onClick={() => onReorder(moveItem(list, index, index - 1))} aria-label={t('Mover arriba')}>
                    <ChevronUp size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('Mover abajo')}>
                <span>
                  <IconButton disabled={disabled || index === list.length - 1} onClick={() => onReorder(moveItem(list, index, index + 1))} aria-label={t('Mover abajo')}>
                    <ChevronDown size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
