'use client';

import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useAction } from '@/lib/hooks/use-action';
import { deleteMedia } from '../actions';
import { formatDay, matches, SearchField } from './common';

type Item = { id: string; url: string; alt: string; businessName: string; source: string; createdAt: string; width: number | null; height: number | null };
const SOURCE: Record<string, string> = { upload: 'Subida', import: 'Importada', stock: 'Banco libre', chat: 'Chat' };

export function MediaGrid({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const confirm = useConfirm();
  const { run } = useAction();
  const list = items.filter((i) => matches(query, i.alt, i.businessName));
  return (
    <Stack spacing={1.5}>
      <SearchField value={query} onChange={setQuery} placeholder="Buscar por negocio o descripción" />
      {list.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No hay imágenes.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5 }}>
          {list.map((m) => (
            <Box key={m.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
              <Box component="img" src={m.url} alt={m.alt} loading="lazy" sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', bgcolor: 'action.hover' }} />
              <Stack direction="row" sx={{ p: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap component="p">{m.businessName}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">{m.alt || 'Sin descripción'} · {formatDay(m.createdAt)}</Typography>
                  <Chip size="small" label={SOURCE[m.source] ?? m.source} sx={{ mt: 0.5, height: 20, fontSize: 11 }} />
                </Box>
                <Tooltip title="Quitar de la biblioteca">
                  <IconButton
                    size="small"
                    onClick={async () => {
                      const ok = await confirm({ title: '¿Quitar la imagen de la biblioteca?', description: 'Deja de aparecer para elegirla. Si ya se usa en un sitio, seguirá visible allí.', confirmLabel: 'Quitar', destructive: true });
                      if (ok) void run(() => deleteMedia(m.id), { onSuccess: () => router.refresh() });
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}
