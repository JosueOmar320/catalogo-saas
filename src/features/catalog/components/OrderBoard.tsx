'use client';

import { Avatar, Box, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import { ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SortableList } from '@/components/ui/SortableList';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { reorder } from '../reorder-actions';

type Category = { id: string; name: string; isActive: boolean };
type Item = { id: string; name: string; categoryId: string | null; thumbUrl: string | null; isVisible: boolean };

const UNCATEGORIZED = 'none';

export function OrderBoard({ categories: initialCategories, items: initialItems }: { categories: Category[]; items: Item[] }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState(initialCategories[0]?.id ?? UNCATEGORIZED);

  const groupItems = useMemo(
    () => items.filter((i) => (selected === UNCATEGORIZED ? i.categoryId === null : i.categoryId === selected)),
    [items, selected],
  );

  const save = (table: 'categories' | 'catalog_items', ids: string[]) =>
    run(() => reorder({ table, ids }), { onSuccess: () => router.refresh() });

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper variant="outlined">
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h3">{t('Categorías')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('Orden de las secciones y del menú.')}</Typography>
          </Box>
          {categories.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>{t('Aún no hay categorías.')}</Typography>
          ) : (
            <SortableList
              items={categories}
              getId={(c) => c.id}
              disabled={pending}
              onReorder={(next) => {
                setCategories(next);
                void save('categories', next.map((c) => c.id));
              }}
              renderItem={(c) => (
                <Typography variant="body2" noWrap sx={{ fontWeight: 500, color: c.isActive ? 'text.primary' : 'text.disabled' }}>
                  {c.name}
                </Typography>
              )}
            />
          )}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }}>
        <Paper variant="outlined">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h3">{t('Ítems')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('Orden dentro de cada categoría.')}</Typography>
            </Box>
            <TextField select value={selected} onChange={(e) => setSelected(e.target.value)} sx={{ maxWidth: { sm: 240 } }} slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t('Categoría') } }}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={UNCATEGORIZED}>{t('Sin categoría')}</option>
            </TextField>
          </Stack>
          {groupItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>{t('No hay ítems en esta categoría.')}</Typography>
          ) : (
            <SortableList
              items={groupItems}
              getId={(i) => i.id}
              disabled={pending}
              onReorder={(next) => {
                const others = items.filter((i) => !next.some((n) => n.id === i.id));
                setItems([...others, ...next]);
                void save('catalog_items', next.map((i) => i.id));
              }}
              renderItem={(item) => (
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <Avatar variant="rounded" src={item.thumbUrl ?? undefined} alt="" sx={{ width: 32, height: 32, bgcolor: 'action.hover', color: 'text.disabled' }}>
                    <ImageIcon size={14} />
                  </Avatar>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500, color: item.isVisible ? 'text.primary' : 'text.disabled' }}>
                    {item.name}
                  </Typography>
                </Stack>
              )}
            />
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
