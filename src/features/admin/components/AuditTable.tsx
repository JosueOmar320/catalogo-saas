'use client';

import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { AuditRow } from '../queries';
import { formatMoment } from './common';

/** Descripción legible de cada evento de auditoría. */
const ENTITY: Record<string, string> = {
  businesses: 'negocio',
  business_members: 'acceso a negocio',
  catalogs: 'catálogo',
  catalog_pages: 'página',
  categories: 'categoría',
  catalog_items: 'producto/servicio',
  profiles: 'usuario',
  media_assets: 'imagen',
  user: 'usuario',
};
const VERB: Record<string, string> = { insert: 'creó', update: 'modificó', delete: 'eliminó', create: 'creó', password_reset: 'restableció la contraseña de' };

export function describeAudit(row: AuditRow): string {
  const [, op] = row.action.split('.');
  const meta = (row.metadata ?? {}) as { name?: string; title?: string; username?: string; changed?: string[]; role?: string };
  const target = meta.name ?? meta.title ?? (meta.username ? `@${meta.username}` : '');
  const entity = ENTITY[row.entity_type] ?? row.entity_type;
  const changed = meta.changed?.length ? ` (${meta.changed.slice(0, 4).join(', ')})` : '';
  return `${VERB[op] ?? op} ${entity}${target ? ` «${target}»` : ''}${changed}`;
}

export function AuditTable({ rows, compact }: { rows: AuditRow[]; compact?: boolean }) {
  if (rows.length === 0) return <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>Sin actividad registrada.</Typography>;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 640 }}>
        {!compact && (
          <TableHead>
            <TableRow>
              <TableCell>Cuándo</TableCell>
              <TableCell>Quién</TableCell>
              <TableCell>Qué</TableCell>
              <TableCell>Negocio</TableCell>
            </TableRow>
          </TableHead>
        )}
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell sx={{ whiteSpace: 'nowrap', width: 170 }}><Typography variant="caption">{formatMoment(row.created_at)}</Typography></TableCell>
              <TableCell sx={{ width: 150 }}>{row.actor ? <Typography variant="body2" sx={{ fontWeight: 600 }}>@{row.actor}</Typography> : <Chip size="small" label="Sistema" variant="outlined" />}</TableCell>
              <TableCell><Typography variant="body2">{describeAudit(row)}</Typography></TableCell>
              <TableCell><Typography variant="caption" color="text.secondary">{row.businessName ?? ''}</Typography></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
