'use client';

import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useT } from '@/i18n/client';
import { msg, type Translator } from '@/i18n/translate';
import type { AuditRow } from '../queries';
import { useDateFormat } from './common';

/** Descripción legible de cada evento de auditoría. */
const ENTITY: Record<string, string> = {
  businesses: msg('negocio'),
  business_members: msg('acceso a negocio'),
  catalogs: msg('catálogo'),
  catalog_pages: msg('página'),
  categories: msg('categoría'),
  catalog_items: msg('producto/servicio'),
  profiles: msg('usuario'),
  media_assets: msg('imagen'),
  user: msg('usuario'),
};
const VERB: Record<string, string> = {
  insert: msg('creó'),
  update: msg('modificó'),
  delete: msg('eliminó'),
  create: msg('creó'),
  password_reset: msg('restableció la contraseña de'),
};

/** Columnas cambiadas, en palabras (las desconocidas quedan como vienen). */
const FIELD: Record<string, string> = {
  name: msg('nombre'),
  slug: msg('dirección'),
  status: msg('estado'),
  plan_id: msg('plan'),
  contact: msg('contacto'),
  social_links: msg('redes'),
  logo_path: msg('logo'),
  custom_code: msg('código propio'),
  site_kind: msg('tipo de sitio'),
  feature_overrides: msg('funciones'),
  sections: msg('secciones'),
  style: msg('estilo'),
  theme: msg('diseño'),
  navigation: msg('navegación'),
  settings: msg('configuración'),
  price: msg('precio'),
  attributes: msg('atributos'),
  locale: msg('idioma'),
  is_visible: msg('visibilidad'),
  role: msg('rol'),
};

export function describeAudit(row: AuditRow, t: Translator): string {
  const [, op] = row.action.split('.');
  const meta = (row.metadata ?? {}) as { name?: string; title?: string; username?: string; changed?: string[]; role?: string };
  const target = meta.name ?? meta.title ?? (meta.username ? `@${meta.username}` : '');
  const verb = VERB[op] ? t(VERB[op]) : op;
  const entity = ENTITY[row.entity_type] ? t(ENTITY[row.entity_type]) : row.entity_type;
  // Plantillas completas para que cada idioma ordene la frase a su modo.
  const text = target ? t('{verb} {entity} «{target}»', { verb, entity, target }) : t('{verb} {entity}', { verb, entity });
  return meta.changed?.length ? t('{text} ({fields})', { text, fields: meta.changed.slice(0, 4).map((f) => (FIELD[f] ? t(FIELD[f]) : f)).join(', ') }) : text;
}

/** hideBusiness: dentro de la ficha de un negocio, la columna «Negocio» sobra. */
export function AuditTable({ rows, compact, hideBusiness }: { rows: AuditRow[]; compact?: boolean; hideBusiness?: boolean }) {
  const t = useT();
  const { formatMoment } = useDateFormat();
  if (rows.length === 0) return <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>{t('Sin actividad registrada.')}</Typography>;
  return (
    // Se desplaza de lado en pantallas angostas: con foco y nombre para usarla con el teclado.
    <Box sx={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={t('Actividad')}>
      <Table size="small" sx={{ minWidth: 640 }}>
        {!compact && (
          <TableHead>
            <TableRow>
              <TableCell>{t('Cuándo')}</TableCell>
              <TableCell>{t('Quién')}</TableCell>
              <TableCell>{t('Qué')}</TableCell>
              {!hideBusiness && <TableCell>{t('Negocio')}</TableCell>}
            </TableRow>
          </TableHead>
        )}
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell sx={{ whiteSpace: 'nowrap', width: 170 }}><Typography variant="caption">{formatMoment(row.created_at)}</Typography></TableCell>
              <TableCell sx={{ width: 150 }}>{row.actor ? <Typography variant="body2" sx={{ fontWeight: 600 }}>@{row.actor}</Typography> : <Chip size="small" label={t('Sistema')} variant="outlined" />}</TableCell>
              <TableCell><Typography variant="body2">{describeAudit(row, t)}</Typography></TableCell>
              {!hideBusiness && <TableCell><Typography variant="caption" color="text.secondary">{row.businessName ?? ''}</Typography></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
