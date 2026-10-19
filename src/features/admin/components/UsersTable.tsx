'use client';

import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import type { MemberRole, PlatformRole, UserStatus } from '@/types/database';
import { matches, SearchField, StatusChip, useDateFormat } from './common';

export type UserListItem = {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  role: PlatformRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  businesses: { id: string; name: string; role: MemberRole }[];
};

export function UsersTable({ users }: { users: UserListItem[] }) {
  const t = useT();
  const { formatMoment } = useDateFormat();
  const [query, setQuery] = useState('');
  const list = users.filter((u) => matches(query, u.username, u.fullName, u.email, ...u.businesses.map((b) => b.name)));
  return (
    <Stack spacing={1.5}>
      <SearchField value={query} onChange={setQuery} placeholder={t('Buscar por usuario, nombre, email o negocio')} />
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('Usuario')}</TableCell>
              <TableCell>{t('Nombre')}</TableCell>
              <TableCell>{t('Negocios')}</TableCell>
              <TableCell>{t('Estado')}</TableCell>
              <TableCell>{t('Último acceso')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((u) => (
              <TableRow key={u.id} hover component={Link} href={`/admin/usuarios/${u.id}`} sx={{ textDecoration: 'none', cursor: 'pointer' }}>
                <TableCell>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 650 }}>@{u.username}</Typography>
                    {u.role === 'admin' && <Chip size="small" label={t('Admin')} color="secondary" sx={{ height: 20, fontSize: 11 }} />}
                  </Stack>
                  {u.email && <Typography variant="caption" color="text.secondary">{u.email}</Typography>}
                </TableCell>
                <TableCell>{u.fullName || '—'}</TableCell>
                <TableCell>
                  {u.businesses.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">{t('Sin negocios')}</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {u.businesses.slice(0, 3).map((b) => <Chip key={b.id} size="small" label={b.name} variant="outlined" />)}
                      {u.businesses.length > 3 && <Chip size="small" label={`+${u.businesses.length - 3}`} />}
                    </Box>
                  )}
                </TableCell>
                <TableCell><StatusChip status={u.status} /></TableCell>
                <TableCell><Typography variant="caption">{formatMoment(u.lastLoginAt)}</Typography></TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>{t('No hay usuarios que coincidan.')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
