import { Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { listAudit } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Auditoría') };
}

const ENTITIES = [
  ['', msg('Todo')],
  ['profiles', msg('Usuarios')],
  ['user', msg('Acciones sobre usuarios')],
  ['businesses', msg('Negocios')],
  ['business_members', msg('Accesos')],
  ['catalogs', msg('Catálogos')],
  ['catalog_pages', msg('Páginas')],
  ['catalog_items', msg('Productos y servicios')],
  ['categories', msg('Categorías')],
  ['media_assets', msg('Imágenes')],
] as const;
const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<'/admin/auditoria'>) {
  const { supabase } = await requirePlatformAdmin();
  const params = await searchParams;
  const entity = typeof params.entidad === 'string' ? params.entidad : '';
  const page = Math.max(0, Number(params.pagina) || 0);
  const [{ rows, hasMore }, t] = await Promise.all([listAudit(supabase, { limit: PAGE, offset: page * PAGE, entity: entity || undefined }), getT()]);
  const link = (p: number) => `/admin/auditoria?${new URLSearchParams({ ...(entity ? { entidad: entity } : {}), pagina: String(p) })}`;
  return (
    <>
      <PageHeader title={t('Auditoría')} description={t('Quién creó, modificó o eliminó cada cosa. Se registra automáticamente.')} />
      <Stack component="form" direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" name="entidad" defaultValue={entity} label={t('Tipo')} sx={{ width: 240 }}>
          {ENTITIES.map(([value, label]) => <MenuItem key={value} value={value}>{t(label)}</MenuItem>)}
        </TextField>
        <Button type="submit" variant="outlined">{t('Filtrar')}</Button>
      </Stack>
      <Paper variant="outlined"><AuditTable rows={rows} /></Paper>
      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
        {page > 0 && <Button href={link(page - 1)}>{t('Anterior')}</Button>}
        {hasMore && <Button href={link(page + 1)}>{t('Siguiente')}</Button>}
      </Stack>
    </>
  );
}
