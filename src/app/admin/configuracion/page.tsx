import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { resolveProvider } from '@/features/assistant/server/model';
import { listPlans } from '@/features/admin/queries';
import { EmailSettings } from '@/features/notifications/components/EmailSettings';
import { sampleCatalogReviewEmail } from '@/features/notifications/sample';
import { getLocale, getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { emailSettings } from '@/lib/email/resend';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Configuración') };
}

const PROVIDER: Record<string, string> = { gemini: 'Google Gemini', anthropic: 'Claude (Anthropic)', 'openai-compatible': msg('API compatible con OpenAI'), basic: msg('Modo básico (sin IA)') };

export default async function AdminSettingsPage() {
  const { supabase, profile } = await requirePlatformAdmin();
  const [plans, t, locale] = await Promise.all([listPlans(supabase), getT(), getLocale()]);
  const mail = emailSettings();
  const cronSecret = (process.env.CRON_SECRET ?? '').length >= 16;
  const sample = sampleCatalogReviewEmail(locale, profile.full_name, profile.id);
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
        <SectionCard title={t('Avisos por correo')} description={t('Los lunes a las 15:00 UTC, un resumen a quienes administran un negocio con productos sin foto, sin precio o sin categoría. Cada persona puede darse de baja.')}>
          <Stack spacing={1.5} sx={{ pb: 2 }}>
            <Status label={t('Clave de Resend (RESEND_API_KEY)')} ok={Boolean(mail.apiKey)} />
            <Status label={t('Remitente (EMAIL_FROM)')} value={mail.from || t('Falta')} />
            <Status label={t('Programación (CRON_SECRET, 16+ caracteres)')} ok={cronSecret} />
            {!(mail.apiKey && mail.from && cronSecret) && (
              <Alert severity="info">{t('Mientras falte alguno, el aviso corre en modo de prueba: calcula a quién se le enviaría, pero no envía nada.')}</Alert>
            )}
            <EmailSettings previewHtml={sample.html} subject={sample.subject} canSend={Boolean(mail.apiKey && mail.from && profile.email)} />
            {!profile.email && <Typography variant="caption" color="text.secondary">{t('Para enviarte una prueba, agrega un email de contacto a tu usuario.')}</Typography>}
          </Stack>
        </SectionCard>
        <SectionCard title={t('Planes')} description={t('Límites por negocio. Preparado para suscripciones y facturación.')} flush>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
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
          </Box>
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
