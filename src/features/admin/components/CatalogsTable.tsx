'use client';

import { Chip, IconButton, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { ExternalLink, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { openBusiness, updateCatalog } from '../actions';
import { matches, SearchField, StatusChip, useDateFormat } from './common';

type Row = {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string;
  pages: number;
  items: number;
  business: { id: string; name: string; slug: string; status: 'active' | 'suspended' };
};

export function CatalogsTable({ catalogs }: { catalogs: Row[] }) {
  const t = useT();
  const { formatDay } = useDateFormat();
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { run, pending } = useAction();
  const list = catalogs.filter((c) => matches(query, c.name, c.business.name, c.business.slug));
  return (
    <Stack spacing={1.5}>
      <SearchField value={query} onChange={setQuery} placeholder={t('Buscar catálogo o negocio')} />
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('Catálogo')}</TableCell>
              <TableCell>{t('Negocio')}</TableCell>
              <TableCell>{t('Publicación')}</TableCell>
              <TableCell>{t('Contenido')}</TableCell>
              <TableCell>{t('Actualizado')}</TableCell>
              <TableCell>{t('Activo')}</TableCell>
              <TableCell align="right">{t('Acciones')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>{c.name}</Typography>
                  {c.isDefault && <Chip size="small" label={t('Predeterminado')} variant="outlined" sx={{ mt: 0.5 }} />}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" component={Link} href={`/admin/negocios/${c.business.id}`}>{c.business.name}</Typography>
                  {c.business.status === 'suspended' && <Typography variant="caption" color="warning.main" component="p">{t('Negocio suspendido')}</Typography>}
                </TableCell>
                <TableCell><StatusChip status={c.status as 'draft' | 'published' | 'unpublished'} /></TableCell>
                <TableCell><Typography variant="caption">{t('{pages} páginas · {items} ítems', { pages: c.pages, items: c.items })}</Typography></TableCell>
                <TableCell><Typography variant="caption">{formatDay(c.updatedAt)}</Typography></TableCell>
                <TableCell>
                  <Switch size="small" checked={c.isActive} disabled={pending} onChange={(e) => run(() => updateCatalog(c.id, { name: c.name, isActive: e.target.checked }), { onSuccess: () => router.refresh() })} slotProps={{ input: { 'aria-label': t('Activar {name}', { name: c.name }) } }} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t('Ver sitio público')}>
                    <IconButton size="small" href={`/catalogo/${c.business.slug}`} target="_blank" aria-label={t('Ver sitio público de {name}', { name: c.name })}><ExternalLink size={15} /></IconButton>
                  </Tooltip>
                  <Tooltip title={t('Abrir en el editor')}>
                    <span>
                      <IconButton size="small" disabled={c.business.status !== 'active'} onClick={() => void openBusiness(c.business.id)} aria-label={t('Abrir {name} en el editor', { name: c.name })}><Pencil size={15} /></IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>{t('No hay catálogos.')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
