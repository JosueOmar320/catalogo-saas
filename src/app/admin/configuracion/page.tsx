import { Alert, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { resolveProvider } from '@/features/assistant/server/model';
import { listPlans } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Configuración') };
}

const PROVIDER: Record<string, string> = { gemini: 'Google Gemini', anthropic: 'Claude (Anthropic)', 'openai-compatible': msg('API compatible con OpenAI'), basic: msg('Modo básico (sin IA)') };

export default async function AdminSettingsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [plans, t] = await Promise.all([listPlans(supabase), getT()]);
  const serviceRole = isServiceRoleConfigured();
  // {path} se reemplaza por la ruta del ajuste en Supabase, en negrita.
  const [signupBefore, signupAfter] = t('Desactiva el registro público en Supabase: {path}. Aunque quede activo, las cuentas creadas por fuera del panel nacen desactivadas.').split('{path}');
  return (
    <>
      <PageHeader title={t('Configuración')} description={t('Estado de la plataforma. Estos valores se configuran con variables de entorno en el servidor.')} />
      <Stack spacing={2.5}>
        <SectionCard title={t('Acceso')}>
          <Stack spacing={1.5} sx={{ pb: 2 }}>
            <Status label={t('Service role (crear usuarios, contraseñas, login con usuario)')} ok={serviceRole} />
            <Status label={t('Dominio interno de cuentas sin email')} value={process.env.AUTH_USERNAME_DOMAIN || 'usuarios.invalid'} />
            <Alert severity="info">
              {signupBefore}<strong>Authentication → Sign In / Providers → Allow new users to sign up</strong>{signupAfter}
            </Alert>
          </Stack>
        </SectionCard>
        <SectionCard title="Garfield AI">
          <Stack spacing={1.5} sx={{ pb: 2 }}>
            <Status label={t('Proveedor')} value={t(PROVIDER[resolveProvider()])} />
            <Status label={t('Modelos')} value={process.env.ASSISTANT_MODEL || t('Por defecto del proveedor')} />
          </Stack>
        </SectionCard>
        <SectionCard title={t('Planes')} description={t('Límites por negocio. Preparado para suscripciones y facturación.')} flush>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>{t('Plan')}</TableCell><TableCell>{t('Límites')}</TableCell><TableCell>{t('Funciones')}</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography><Typography variant="caption" color="text.secondary">{p.id}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{Object.entries(p.limits as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(' · ')}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{Object.entries(p.features as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k).join(', ')}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </Stack>
    </>
  );
}

async function Status({ label, ok, value }: { label: string; ok?: boolean; value?: string }) {
  const t = await getT();
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2">{label}</Typography>
      {value !== undefined ? <Chip size="small" label={value} variant="outlined" /> : <Chip size="small" label={ok ? t('Configurado') : t('Falta')} color={ok ? 'success' : 'warning'} />}
    </Stack>
  );
}
