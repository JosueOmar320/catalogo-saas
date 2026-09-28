'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Avatar, Box, Button, Collapse, IconButton, Paper, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { FolderTree, ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { ImageField } from '@/components/form/ImageField';
import { TextFieldControl } from '@/components/form/fields';
import { EmptyState } from '@/components/ui/EmptyState';
import { SortableList } from '@/components/ui/SortableList';
import { reorder } from '@/features/catalog/reorder-actions';
import { useAction } from '@/lib/hooks/use-action';
import { publicStorageUrl } from '@/lib/utils/storage';
import { createCategory, deleteCategory, setCategoryActive, updateCategory } from '../actions';
import { categoryFormSchema, type CategoryFormValues } from '../schema';

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  isActive: boolean;
  itemCount: number;
};

export function CategoryManager({ categories: initial }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [categories, setCategories] = useState(initial);
  const [source, setSource] = useState(initial);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  if (source !== initial) {
    setSource(initial);
    setCategories(initial);
  }

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    void run(() => createCategory({ name, description: '', imagePath: null, isActive: true }), {
      onSuccess: () => {
        setNewName('');
        router.refresh();
      },
    });
  };

  const onReorder = (next: CategoryRow[]) => {
    setCategories(next);
    void run(() => reorder({ table: 'categories', ids: next.map((c) => c.id) }), { successToast: false, onSuccess: () => router.refresh() });
  };

  const toggleActive = (category: CategoryRow, isActive: boolean) => {
    setCategories((list) => list.map((c) => (c.id === category.id ? { ...c, isActive } : c)));
    void run(() => setCategoryActive(category.id, isActive), { onSuccess: () => router.refresh() });
  };

  const remove = async (category: CategoryRow) => {
    const ok = await confirm({
      title: `¿Eliminar "${category.name}"?`,
      description: category.itemCount
        ? `Sus ${category.itemCount} ítem(s) no se borran: quedarán como "Sin categoría".`
        : 'La categoría está vacía.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    setCategories((list) => list.filter((c) => c.id !== category.id));
    await run(() => deleteCategory(category.id), { onSuccess: () => router.refresh() });
  };

  return (
    <Paper variant="outlined">
      <Stack direction="row" spacing={1} component="form" onSubmit={(e) => { e.preventDefault(); add(); }} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          placeholder="Nombre de la nueva categoría (ej. Bebidas)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 80, 'aria-label': 'Nueva categoría' } }}
        />
        <Button type="submit" variant="contained" startIcon={<Plus size={15} />} disabled={pending || !newName.trim()} sx={{ flexShrink: 0 }}>
          Agregar
        </Button>
      </Stack>

      {categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="Sin categorías todavía" description="Las categorías agrupan tus ítems y forman el menú del catálogo. Ej.: Bebidas, Postres, Servicios." />
      ) : (
        <SortableList
          items={categories}
          getId={(c) => c.id}
          onReorder={onReorder}
          disabled={pending}
          renderItem={(category) => (
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Avatar variant="rounded" src={publicStorageUrl(category.imagePath) ?? undefined} sx={{ width: 36, height: 36, bgcolor: '#F1F1F3', color: 'text.disabled' }}>
                  <ImageIcon size={16} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: category.isActive ? 'text.primary' : 'text.disabled' }}>
                    {category.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    {category.itemCount} ítem(s){category.isActive ? '' : ' · Oculta'}
                  </Typography>
                </Box>
                <Tooltip title={category.isActive ? 'Visible' : 'Oculta'}>
                  <Switch checked={category.isActive} onChange={(e) => toggleActive(category, e.target.checked)} slotProps={{ input: { 'aria-label': 'Visible' } }} />
                </Tooltip>
                <Tooltip title="Editar">
                  <IconButton onClick={() => setEditingId(editingId === category.id ? null : category.id)} aria-label="Editar">
                    <Pencil size={15} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton onClick={() => void remove(category)} aria-label="Eliminar">
                    <Trash2 size={15} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Collapse in={editingId === category.id} unmountOnExit>
                <CategoryEditor category={category} onDone={() => setEditingId(null)} />
              </Collapse>
            </Box>
          )}
        />
      )}
    </Paper>
  );
}

function CategoryEditor({ category, onDone }: { category: CategoryRow; onDone: () => void }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, setError } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? '',
      imagePath: category.imagePath,
      isActive: category.isActive,
    },
  });

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={handleSubmit((values) =>
        run(() => updateCategory(category.id, values), {
          setError,
          onSuccess: () => {
            onDone();
            router.refresh();
          },
        }),
      )}
      sx={{ pt: 2, pb: 1, pl: { sm: 6 } }}
    >
      <TextFieldControl control={control} name="name" label="Nombre" />
      <TextFieldControl control={control} name="description" label="Descripción" multiline minRows={2} helperText="Opcional. Se muestra bajo el título de la sección." />
      <Controller
        control={control}
        name="imagePath"
        render={({ field }) => (
          <ImageField
            label="Imagen"
            description="Opcional."
            kind="category"
            value={publicStorageUrl(field.value)}
            onChange={(path) => field.onChange(path)}
            width={80}
          />
        )}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button color="inherit" onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={pending}>Guardar</Button>
      </Stack>
    </Stack>
  );
}
