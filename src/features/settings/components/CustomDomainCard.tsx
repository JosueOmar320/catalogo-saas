'use client';

import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { Globe, RefreshCw, Unlink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { CopyField } from '@/components/ui/CopyField';
import { SectionCard } from '@/components/ui/SectionCard';
import { checkCustomDomain, removeCustomDomain, setCustomDomain, type DomainStatus } from '@/features/business/domain-actions';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { dnsRecordFor, wwwCounterpart, type DnsRecord } from '@/lib/domains/domain';
import { useAction } from '@/lib/hooks/use-action';

type Props = {
  domain: string | null;
  status: 'none' | 'pending' | 'active';
  /** ok · plan (no incluido) · platform (falta configurar la plataforma) */
  availability: 'ok' | 'plan' | 'platform';
  canManage: boolean;
  /** La dirección de la plataforma, que sigue funcionando siempre. */
  platformUrl: string;
};

const STATUS: Record<DomainStatus['status'], { label: string; color: 'default' | 'warning' | 'success' }> = {
  none: { label: msg('Sin dominio'), color: 'default' },
  pending: { label: msg('Falta el DNS'), color: 'warning' },
  active: { label: msg('Conectado'), color: 'success' },
};

export function CustomDomainCard({ domain, status, availability, canManage, platformUrl }: Props) {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Registros devueltos por Vercel al verificar; antes, los que suele pedir.
  const [records, setRecords] = useState<DnsRecord[] | null>(null);

  const alias = domain ? wwwCounterpart(domain)?.name : null;
  // El de la otra forma (www o sin www) también, para que las dos lleguen.
  const shown = domain ? [...(records ?? [dnsRecordFor(domain)]), ...(alias ? [dnsRecordFor(alias)] : [])] : [];
  const disabled = availability !== 'ok' || !canManage;
  // Con la función apagada (plan o administrador), un dominio guardado no sirve el sitio.
  const paused = Boolean(domain) && availability === 'plan';

  const apply = (data: DomainStatus) => {
    setRecords(data.records);
    router.refresh();
  };

  return (
    <SectionCard id="dominio-propio" title={t('Dominio propio')} action={<Chip label={paused ? t('En pausa') : t(STATUS[status].label)} color={paused ? 'default' : STATUS[status].color} size="small" />}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t('Muestra tu sitio en tu propio dominio (mitienda.com). La dirección {url} sigue funcionando.', { url: platformUrl.replace(/^https?:\/\//, '') })}
        </Typography>
        {availability === 'plan' && <Alert severity="info">{t('El dominio propio no está incluido en tu plan.')}</Alert>}
        {availability === 'platform' && <Alert severity="info">{t('El dominio propio todavía no está disponible en la plataforma.')}</Alert>}
        {!canManage && availability === 'ok' && <Alert severity="info">{t('Sólo el dueño o un administrador puede cambiar esto.')}</Alert>}

        {domain ? (
          <>
            <CopyField label={t('Tu dominio')} value={`https://${domain}`} openable={status === 'active' && !paused} />
            {alias && <Typography variant="caption" color="text.secondary">{t('{alias} también funciona y lleva a {domain}.', { alias, domain })}</Typography>}
            {status === 'pending' && (
              <Stack spacing={1.5}>
                <Typography variant="body2">{t('Crea estos registros en el proveedor donde compraste el dominio (GoDaddy, Namecheap, Hostinger…) y luego toca «Verificar». El cambio puede tardar unas horas.')}</Typography>
                <DnsTable records={shown} />
              </Stack>
            )}
            {status === 'active' && !paused && <Alert severity="success">{t('Tu sitio ya se ve en {domain}. El certificado de seguridad (https) es automático.', { domain })}</Alert>}
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {status === 'pending' && (
                <Button variant="contained" startIcon={<RefreshCw size={15} />} disabled={disabled || pending} onClick={() => run(checkCustomDomain, { onSuccess: apply })}>
                  {t('Verificar')}
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<Unlink size={15} />}
                disabled={!canManage || pending}
                onClick={async () => {
                  const yes = await confirm({ title: t('¿Desconectar el dominio?'), description: t('{domain} dejará de mostrar tu sitio. Puedes volver a conectarlo cuando quieras.', { domain }), confirmLabel: t('Desconectar'), destructive: true });
                  if (yes) await run(removeCustomDomain, { onSuccess: () => { setRecords(null); router.refresh(); } });
                }}
              >
                {t('Desconectar')}
              </Button>
            </Stack>
          </>
        ) : (
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'flex-start' } }}
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              const result = await run(() => setCustomDomain(value), { onSuccess: (data) => { setValue(''); apply(data); } });
              if (result && !result.ok) setError(result.fieldErrors?.domain?.[0] ?? null);
            }}
          >
            <TextField
              size="small"
              label={t('Dominio')}
              placeholder="mitienda.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              error={Boolean(error)}
              helperText={error ? t(error) : t('Sin https:// ni rutas. Puede ser la raíz (mitienda.com) o un subdominio (tienda.mitienda.com).')}
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false, inputMode: 'url' } }}
            />
            <Button type="submit" variant="contained" startIcon={<Globe size={15} />} disabled={disabled || pending || !value.trim()}>
              {t('Conectar')}
            </Button>
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}

function DnsTable({ records }: { records: DnsRecord[] }) {
  const t = useT();
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflowX: 'auto' }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& th, & td': { px: 1.5, py: 1, textAlign: 'left', borderBottom: 1, borderColor: 'divider' }, '& tr:last-of-type td': { borderBottom: 0 }, '& th': { fontWeight: 600, color: 'text.secondary', bgcolor: 'action.hover' }, '& td': { fontFamily: 'monospace', wordBreak: 'break-all' } }}>
        <thead>
          <tr>
            <th>{t('Tipo')}</th>
            <th>{t('Nombre')}</th>
            <th>{t('Valor')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={`${r.type}-${r.name}-${r.value}`}>
              <td>{r.type}</td>
              <td>{r.name}</td>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
