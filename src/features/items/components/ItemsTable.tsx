'use client';

import {
  Avatar,
  Box,
  Checkbox,
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
import { Copy, Eye, ImageIcon, MoreHorizontal, PackageX, Pencil, Search, ShoppingBag, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { bulkUpdateItems, deleteItem, duplicateItem, restoreItems, toggleItemField, type BulkItemsInput } from '../actions';
import { PriceCell } from './PriceCell';
import { BulkActions } from './BulkActions';
import { REVIEW_FILTERS, type ReviewFilter } from '../review';
import { LOW_STOCK } from '@/lib/catalog/item-attributes';

export type ItemRowData = {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  priceLabel: string | null;
  /** Tiene precio (base o en sus opciones): el mismo criterio del inicio del panel. */
  hasPrice: boolean;
  /** Precio numérico y moneda (vista previa del ajuste masivo). */
  price: number | null;
  currency: string;
  thumbUrl: string | null;
  isVisible: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  /** Oferta con fecha de fin: vigente (con su último día) o ya vencida. */
  sale: { ends: string; over: boolean } | null;
  hasDescription: boolean;
  /** Existencias (null = no se controlan). */
  stock: number | null;
  /** Ficha pública (para las etiquetas con QR). */
  url: string;
  /** Precio programado que todavía no empieza: el nuevo precio y desde cuándo. */
  nextPrice: { label: string; date: string } | null;
  /** Costo privado y margen (%) con el precio actual; null sin costo. */
  cost: number | null;
  margin: number | null;
  /** Fuera de temporada hoy: aún no empieza o ya terminó (y desde/hasta cuándo). */
  season: { status: 'upcoming' | 'ended'; date: string } | null;
  /** Fichas vistas y unidades pedidas en 30 días (null si no se pueden leer). */
  views: number | null;
  units: number | null;
};

type SortKey = 'catalog' | 'views' | 'units';

type Props = {
  items: ItemRowData[];
  categories: { id: string; name: string }[];
  /** Filtro de revisión inicial (desde el inicio del panel: ?revisar=sin-foto). */
  initialReview?: ReviewFilter | null;
  /** Locale de precios del catálogo (vista previa del ajuste de precios). */
  locale: string;
  /** Para las etiquetas con QR. */
  businessName: string;
};

type ToggleField = 'is_visible' | 'is_available' | 'is_featured';
const FIELD_KEY: Record<ToggleField, 'isVisible' | 'isAvailable' | 'isFeatured'> = {
  is_visible: 'isVisible',
  is_available: 'isAvailable',
  is_featured: 'isFeatured',
};

export function ItemsTable({ items: initialItems, categories, initialReview = null, locale, businessName }: Props) {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { run, pending } = useAction();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [review, setReview] = useState<ReviewFilter | 'all'>(initialReview ?? 'all');
  const [sort, setSort] = useState<SortKey>('catalog');
  const hasStats = initialItems.some((i) => i.views !== null || i.units !== null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: ItemRowData } | null>(null);

  // Sincroniza con datos frescos del servidor tras router.refresh().
  const [source, setSource] = useState(initialItems);
  if (source !== initialItems) {
    setSource(initialItems);
    setItems(initialItems);
  }

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        (category === 'all' || (category === 'none' ? !i.categoryId : i.categoryId === category)) &&
        (review === 'all' || REVIEW_FILTERS[review].test({ ...i, hasImage: Boolean(i.thumbUrl), saleOver: i.sale?.over ?? false })) &&
        (!q || i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)),
    );
    // Más vistos / más pedidos (30 días); empates en el orden del catálogo.
    return sort === 'catalog' ? filtered : [...filtered].sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  }, [items, query, category, review, sort]);

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
      title: t('¿Eliminar "{name}"?', { name: item.name }),
      description: t('Dejará de mostrarse en el catálogo. Podrás deshacerlo justo después.'),
      confirmLabel: t('Eliminar'),
      destructive: true,
    });
    if (!ok) return;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const result = await run(() => deleteItem(item.id), { successToast: false });
    if (!result?.ok) return;
    router.refresh();
    offerUndo([item.id], t('"{name}" eliminado', { name: item.name }));
  };

  /** Aviso con "Deshacer": restaura lo recién eliminado (borrado lógico). */
  const offerUndo = (ids: string[], message: string) =>
    toast.success(message, {
      label: t('Deshacer'),
      onClick: () => void run(() => restoreItems(ids), { onSuccess: () => router.refresh() }),
    });

  const selectedRows = items.filter((i) => selected.has(i.id));
  const visibleSelected = visibleItems.filter((i) => selected.has(i.id)).length;
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      const all = visibleItems.every((i) => next.has(i.id));
      for (const item of visibleItems) {
        if (all) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });

  const applyBulk = async (action: BulkItemsInput['action']) => {
    const ids = [...selected];
    if (action.type === 'delete') {
      const ok = await confirm({
        title: ids.length === 1 ? t('¿Eliminar 1 ítem?') : t('¿Eliminar {count} ítems?', { count: ids.length }),
        description: t('Dejarán de mostrarse en el catálogo. Podrás deshacerlo justo después.'),
        confirmLabel: t('Eliminar'),
        destructive: true,
      });
      if (!ok) return;
    }
    const result = await run(() => bulkUpdateItems({ ids, action }), { successToast: action.type !== 'delete' });
    if (!result?.ok) return;
    if (action.type === 'delete') offerUndo(ids, ids.length === 1 ? t('1 ítem eliminado') : t('{count} ítems eliminados', { count: ids.length }));
    // Reflejo inmediato; los datos definitivos llegan con router.refresh().
    const chosen = new Set(ids);
    setItems((list) => {
      if (action.type === 'delete') return list.filter((i) => !chosen.has(i.id));
      if (action.type === 'set') return list.map((i) => (chosen.has(i.id) ? { ...i, [FIELD_KEY[action.field]]: action.value } : i));
      if (action.type === 'category') {
        const name = categories.find((c) => c.id === action.categoryId)?.name ?? null;
        return list.map((i) => (chosen.has(i.id) ? { ...i, categoryId: action.categoryId ?? null, categoryName: name } : i));
      }
      return list;
    });
    setSelected(new Set());
    router.refresh();
  };

  return (
    <>
      {selected.size > 0 && (
        <BulkActions selected={selectedRows} categories={categories} locale={locale} businessName={businessName} pending={pending} onAction={(action) => void applyBulk(action)} onClear={() => setSelected(new Set())} />
      )}
      <Paper variant="outlined">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            placeholder={t('Buscar por nombre o código')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ maxWidth: { sm: 320 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> } }}
          />
          <TextField select value={category} onChange={(e) => setCategory(e.target.value)} sx={{ maxWidth: { sm: 220 } }} slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t('Categoría') } }}>
            <option value="all">{t('Todas las categorías')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="none">{t('Sin categoría')}</option>
          </TextField>
          <TextField
            select
            value={review}
            onChange={(e) => setReview(e.target.value as ReviewFilter | 'all')}
            sx={{ maxWidth: { sm: 200 } }}
            slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t('Revisar') } }}
          >
            <option value="all">{t('Todos los estados')}</option>
            {Object.entries(REVIEW_FILTERS).map(([key, filter]) => (
              <option key={key} value={key}>{t(filter.label)}</option>
            ))}
          </TextField>
          {hasStats && (
            <TextField
              select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              sx={{ maxWidth: { sm: 200 } }}
              slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t('Ordenar') } }}
            >
              <option value="catalog">{t('Orden del catálogo')}</option>
              <option value="views">{t('Más vistos (30 días)')}</option>
              <option value="units">{t('Más pedidos (30 días)')}</option>
            </TextField>
          )}
          {(query || category !== 'all' || review !== 'all') && (
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', whiteSpace: 'nowrap' }} aria-live="polite">
              {t('{count} de {total}', { count: visibleItems.length, total: items.length })}
            </Typography>
          )}
        </Stack>

        {visibleItems.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Checkbox
              size="small"
              checked={visibleSelected === visibleItems.length}
              indeterminate={visibleSelected > 0 && visibleSelected < visibleItems.length}
              onChange={toggleAllVisible}
              slotProps={{ input: { 'aria-label': t('Seleccionar todos los de la lista') } }}
            />
            <Typography variant="caption" color="text.secondary">
              {visibleSelected > 0 ? t('{count} de {total} seleccionados', { count: visibleSelected, total: visibleItems.length }) : t('Selecciona varios para cambiarlos a la vez')}
            </Typography>
          </Stack>
        )}
        {visibleItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
            {t('No hay resultados para este filtro.')}
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visibleItems.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, '&:hover': { bgcolor: 'action.hover' }, ...(selected.has(item.id) && { bgcolor: 'action.selected' }) }}
              >
                <Checkbox
                  size="small"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  slotProps={{ input: { 'aria-label': t('Seleccionar {name}', { name: item.name }) } }}
                  sx={{ ml: -0.5, mr: -1 }}
                />
                <Avatar variant="rounded" src={item.thumbUrl ?? undefined} alt="" sx={{ width: 44, height: 44, bgcolor: 'action.hover', color: 'text.disabled' }}>
                  <ImageIcon size={18} />
                </Avatar>
                <Box component={Link} href={`/dashboard/catalog/items/${item.id}`} sx={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none', '&:hover .name': { textDecoration: 'underline' } }}>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Typography className="name" variant="body2" noWrap sx={{ fontWeight: 600 }}>{item.name}</Typography>
                    {item.isFeatured && <Star size={13} fill="#F59E0B" color="#F59E0B" aria-label={t('Destacado')} />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    {[item.categoryName ?? t('Sin categoría'), item.sku].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {item.nextPrice && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="info"
                    label={t('Cambia a {price} el {date}', { price: item.nextPrice.label, date: item.nextPrice.date })}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                  />
                )}
                {item.margin !== null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={item.margin < 0 ? 'error' : 'default'}
                    label={item.margin < 0 ? t('Bajo el costo') : t('Margen {percent} %', { percent: item.margin })}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                  />
                )}
                {item.season && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={item.season.status === 'upcoming' ? t('Se verá desde el {date}', { date: item.season.date }) : t('Temporada terminada el {date}', { date: item.season.date })}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                  />
                )}
                {item.sale && (
                  <Chip
                    size="small"
                    color={item.sale.over ? 'default' : 'success'}
                    variant="outlined"
                    label={item.sale.over ? t('Oferta vencida') : t('Oferta hasta el {date}', { date: item.sale.ends })}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                  />
                )}
                {(item.views !== null || item.units !== null) && (
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{ display: { xs: 'none', md: 'flex' }, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                    aria-label={t('{views} visitas y {units} unidades pedidas en 30 días', { views: item.views ?? 0, units: item.units ?? 0 })}
                    role="group"
                  >
                    {item.views !== null && (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} aria-hidden>
                        <Eye size={13} />
                        <Typography variant="caption">{item.views}</Typography>
                      </Stack>
                    )}
                    {item.units !== null && (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} aria-hidden>
                        <ShoppingBag size={13} />
                        <Typography variant="caption">{item.units}</Typography>
                      </Stack>
                    )}
                  </Stack>
                )}
                {item.isAvailable && item.stock === 0 && <Chip size="small" color="warning" variant="outlined" label={t('Sin existencias')} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
                {item.isAvailable && item.stock !== null && item.stock > 0 && item.stock <= LOW_STOCK && (
                  <Chip size="small" color="warning" variant="outlined" label={t('Quedan {count}', { count: item.stock })} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
                )}
                {!item.isAvailable && <Chip label={t('Agotado')} variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
                <PriceCell
                  item={item}
                  locale={locale}
                  onSaved={(price, priceLabel) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, price, priceLabel, hasPrice: price !== null || i.hasPrice } : i)))}
                />
                <Tooltip title={item.isVisible ? t('Visible en el catálogo') : t('Oculto')}>
                  <Switch checked={item.isVisible} onChange={(e) => toggle(item, 'is_visible', e.target.checked)} slotProps={{ input: { 'aria-label': t('Visible en el catálogo') } }} />
                </Tooltip>
                <IconButton onClick={(e) => setMenu({ anchor: e.currentTarget, item })} aria-label={t('Acciones de {name}', { name: item.name })}>
                  <MoreHorizontal size={16} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {menu && [
            <MenuItem key="edit" component={Link} href={`/dashboard/catalog/items/${menu.item.id}`}>
              <ListItemIcon><Pencil size={15} /></ListItemIcon>{t('Editar')}
            </MenuItem>,
            <MenuItem key="dup" onClick={() => { const id = menu.item.id; setMenu(null); void run(() => duplicateItem(id), { onSuccess: () => router.refresh() }); }}>
              <ListItemIcon><Copy size={15} /></ListItemIcon>{t('Duplicar')}
            </MenuItem>,
            <MenuItem key="feat" onClick={() => { const it = menu.item; setMenu(null); toggle(it, 'is_featured', !it.isFeatured); }}>
              <ListItemIcon><Star size={15} /></ListItemIcon>{menu.item.isFeatured ? t('Quitar de destacados') : t('Destacar')}
            </MenuItem>,
            <MenuItem key="avail" onClick={() => { const it = menu.item; setMenu(null); toggle(it, 'is_available', !it.isAvailable); }}>
              <ListItemIcon><PackageX size={15} /></ListItemIcon>{menu.item.isAvailable ? t('Marcar como agotado') : t('Marcar como disponible')}
            </MenuItem>,
            <MenuItem key="del" onClick={() => void handleDelete(menu.item)} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={15} /></ListItemIcon>{t('Eliminar')}
            </MenuItem>,
          ]}
        </Menu>
      </Paper>
    </>
  );
}
