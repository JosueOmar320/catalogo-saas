'use client';

import {
  Avatar,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Copy, ImageIcon, MoreHorizontal, PackageX, Pencil, Search, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useAction } from '@/lib/hooks/use-action';
import { deleteItem, duplicateItem, toggleItemField } from '../actions';

export type ItemRowData = {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  priceLabel: string | null;
  thumbUrl: string | null;
  isVisible: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
};

type Props = {
  items: ItemRowData[];
  categories: { id: string; name: string }[];
};

type ToggleField = 'is_visible' | 'is_available' | 'is_featured';
const FIELD_KEY: Record<ToggleField, 'isVisible' | 'isAvailable' | 'isFeatured'> = {
  is_visible: 'isVisible',
  is_available: 'isAvailable',
  is_featured: 'isFeatured',
};

export function ItemsTable({ items: initialItems, categories }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run } = useAction();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: ItemRowData } | null>(null);

  // Sincroniza con datos frescos del servidor tras router.refresh().
  const [source, setSource] = useState(initialItems);
  if (source !== initialItems) {
    setSource(initialItems);
    setItems(initialItems);
  }

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === 'all' || (category === 'none' ? !i.categoryId : i.categoryId === category)) &&
        (!q || i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)),
    );
  }, [items, query, category]);

  const toggle = (item: ItemRowData, field: ToggleField, value: boolean) => {
    const key = FIELD_KEY[field];
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, [key]: value } : i)));
    void run(() => toggleItemField({ id: item.id, field, value }), {
      onSuccess: () => router.refresh(),
    }).then((result) => {
      if (!result?.ok) setItems((list) => list.map((i) => (i.id === item.id ? { ...i, [key]: !value } : i)));
    });
  };

  const handleDelete = async (item: ItemRowData) => {
    setMenu(null);
    const ok = await confirm({
      title: `¿Eliminar "${item.name}"?`,
      description: 'Dejará de mostrarse en el catálogo. Esta acción no se puede deshacer desde el panel.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    setItems((list) => list.filter((i) => i.id !== item.id));
    await run(() => deleteItem(item.id), { onSuccess: () => router.refresh() });
  };

  return (
    <Paper variant="outlined">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          placeholder="Buscar por nombre o código"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ maxWidth: { sm: 320 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> } }}
        />
        <TextField select value={category} onChange={(e) => setCategory(e.target.value)} sx={{ maxWidth: { sm: 220 } }} slotProps={{ select: { native: true } }}>
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="none">Sin categoría</option>
        </TextField>
      </Stack>

      {visibleItems.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
          No hay resultados para este filtro.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {visibleItems.map((item) => (
            <Box
              component="li"
              key={item.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Avatar variant="rounded" src={item.thumbUrl ?? undefined} sx={{ width: 44, height: 44, bgcolor: 'action.hover', color: 'text.disabled' }}>
                <ImageIcon size={18} />
              </Avatar>
              <Box component={Link} href={`/dashboard/catalog/items/${item.id}`} sx={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none', '&:hover .name': { textDecoration: 'underline' } }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography className="name" variant="body2" noWrap sx={{ fontWeight: 600 }}>{item.name}</Typography>
                  {item.isFeatured && <Star size={13} fill="#F59E0B" color="#F59E0B" aria-label="Destacado" />}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {[item.categoryName ?? 'Sin categoría', item.sku].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {!item.isAvailable && <Chip label="Agotado" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
              <Typography variant="body2" sx={{ width: 96, textAlign: 'right', display: { xs: 'none', sm: 'block' }, fontVariantNumeric: 'tabular-nums' }}>
                {item.priceLabel ?? '—'}
              </Typography>
              <Tooltip title={item.isVisible ? 'Visible en el catálogo' : 'Oculto'}>
                <Switch checked={item.isVisible} onChange={(e) => toggle(item, 'is_visible', e.target.checked)} slotProps={{ input: { 'aria-label': 'Visible en el catálogo' } }} />
              </Tooltip>
              <IconButton onClick={(e) => setMenu({ anchor: e.currentTarget, item })} aria-label={`Acciones de ${item.name}`}>
                <MoreHorizontal size={16} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {menu && [
          <MenuItem key="edit" component={Link} href={`/dashboard/catalog/items/${menu.item.id}`}>
            <ListItemIcon><Pencil size={15} /></ListItemIcon>Editar
          </MenuItem>,
          <MenuItem key="dup" onClick={() => { const id = menu.item.id; setMenu(null); void run(() => duplicateItem(id), { onSuccess: () => router.refresh() }); }}>
            <ListItemIcon><Copy size={15} /></ListItemIcon>Duplicar
          </MenuItem>,
          <MenuItem key="feat" onClick={() => { const it = menu.item; setMenu(null); toggle(it, 'is_featured', !it.isFeatured); }}>
            <ListItemIcon><Star size={15} /></ListItemIcon>{menu.item.isFeatured ? 'Quitar de destacados' : 'Destacar'}
          </MenuItem>,
          <MenuItem key="avail" onClick={() => { const it = menu.item; setMenu(null); toggle(it, 'is_available', !it.isAvailable); }}>
            <ListItemIcon><PackageX size={15} /></ListItemIcon>{menu.item.isAvailable ? 'Marcar como agotado' : 'Marcar como disponible'}
          </MenuItem>,
          <MenuItem key="del" onClick={() => void handleDelete(menu.item)} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={15} /></ListItemIcon>Eliminar
          </MenuItem>,
        ]}
      </Menu>
    </Paper>
  );
}
