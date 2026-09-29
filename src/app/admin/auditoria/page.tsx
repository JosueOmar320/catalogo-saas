import { Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { listAudit } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Auditoría' };

const ENTITIES = [
  ['', 'Todo'],
  ['profiles', 'Usuarios'],
  ['user', 'Acciones sobre usuarios'],
  ['businesses', 'Negocios'],
  ['business_members', 'Accesos'],
  ['catalogs', 'Catálogos'],
  ['catalog_pages', 'Páginas'],
  ['catalog_items', 'Productos y servicios'],
  ['categories', 'Categorías'],
  ['media_assets', 'Imágenes'],
] as const;
const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<'/admin/auditoria'>) {
  const { supabase } = await requirePlatformAdmin();
  const params = await searchParams;
  const entity = typeof params.entidad === 'string' ? params.entidad : '';
  const page = Math.max(0, Number(params.pagina) || 0);
  const { rows, hasMore } = await listAudit(supabase, { limit: PAGE, offset: page * PAGE, entity: entity || undefined });
  const link = (p: number) => `/admin/auditoria?${new URLSearchParams({ ...(entity ? { entidad: entity } : {}), pagina: String(p) })}`;
  return (
    <>
      <PageHeader title="Auditoría" description="Quién creó, modificó o eliminó cada cosa. Se registra automáticamente." />
      <Stack component="form" direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" name="entidad" defaultValue={entity} label="Tipo" sx={{ width: 240 }}>
          {ENTITIES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <Button type="submit" variant="outlined">Filtrar</Button>
      </Stack>
      <Paper variant="outlined"><AuditTable rows={rows} /></Paper>
      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
        {page > 0 && <Button href={link(page - 1)}>Anterior</Button>}
        {hasMore && <Button href={link(page + 1)}>Siguiente</Button>}
      </Stack>
    </>
  );
}
