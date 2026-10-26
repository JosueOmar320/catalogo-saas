import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { resolveProvider } from '@/features/assistant/server/model';
import { listPlans } from '@/features/admin/queries';
import { PlanCustomCodeSwitch } from '@/features/admin/components/PlanCustomCodeSwitch';
import { parseEntitlements } from '@/lib/plans/entitlements';
import { EmailSettings } from '@/features/notifications/components/EmailSettings';
import { sampleCatalogReviewEmail } from '@/features/notifications/sample';
import { getLocale, getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { emailSettings } from '@/lib/email/resend';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';
import { isVercelConfigured } from '@/lib/domains/vercel';
import { DEMO_HOURS, isDemoEnabled, MAX_ACTIVE_DEMOS } from '@/features/demo/config';
import { countActiveDemos } from '@/features/demo/server';

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
  const activeDemos = serviceRole ? await countActiveDemos() : 0;
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
        <SectionCard title={t('Cuenta demo')} description={t('«Probar el panel» crea, sin registro, un negocio de prueba propio para cada visitante con el café de ejemplo. No se publica, no aparece en esta administración y se borra solo a las {hours} horas.', { hours: DEMO_HOURS })}>
          <Stack spacing={1.5} sx={{ pb: 2 }}>
            <Status label={t('Disponible (service role y DEMO_ACCOUNTS distinto de off)')} ok={isDemoEnabled()} />
            <Status label={t('Negocios de prueba activos')} value={`${activeDemos} / ${MAX_ACTIVE_DEMOS}`} />
            {!cronSecret && <Alert severity="info">{t('Sin CRON_SECRET, las demos vencidas se borran cuando alguien crea una nueva (no con el cron diario).')}</Alert>}
          </Stack>
        </SectionCard>
        <SectionCard title={t('Dominios propios')} description={t('Para que cada negocio conecte su dominio, la plataforma agrega el dominio al proyecto de Vercel. Crea un token en Vercel › Account Settings › Tokens con acceso al proyecto.')}>
          <Stack spacing={1.5} sx={{ pb: 2 }}>
            <Status label={t('Token de Vercel (VERCEL_API_TOKEN)')} ok={Boolean(process.env.VERCEL_API_TOKEN)} />
            <Status label={t('Proyecto (VERCEL_PROJECT_ID)')} ok={Boolean(process.env.VERCEL_PROJECT_ID)} />
            <Status label={t('Equipo (VERCEL_TEAM_ID, sólo si el proyecto es de un equipo)')} value={process.env.VERCEL_TEAM_ID ? t('Configurado') : t('Sin equipo')} />
            {!isVercelConfigured() && <Alert severity="info">{t('Mientras falte el token o el proyecto, los negocios ven el dominio propio como «todavía no disponible».')}</Alert>}
          </Stack>
        </SectionCard>
        <SectionCard title={t('Planes')} description={t('Límites por negocio. Preparado para suscripciones y facturación. «Código propio» habilita HTML, widgets y CSS en el editor del sitio. Cada negocio puede tener su propia decisión sobre el código propio y sobre sus funciones (en Negocios › Funciones).')} flush>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow><TableCell>{t('Plan')}</TableCell><TableCell>{t('Límites')}</TableCell><TableCell>{t('Funciones')}</TableCell><TableCell>{t('Código propio')}</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography><Typography variant="caption" color="text.secondary">{p.id}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="caption" component="p">
                      {(() => {
                        const { limits } = parseEntitlements(p);
                        const cap = (n: number | null) => (n === null ? t('sin límite') : String(n));
                        return [
                          t('{count} productos y servicios', { count: cap(limits.max_items) }),
                          t('{count} fotos por ítem', { count: cap(limits.max_images_per_item) }),
                          t('{count} catálogos', { count: cap(limits.max_catalogs) }),
                          t('{count} usuarios', { count: cap(limits.max_members) }),
                        ].join(' · ');
                      })()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {(Object.keys(PLAN_FEATURE_LABELS) as (keyof typeof PLAN_FEATURE_LABELS)[]).filter((k) => parseEntitlements(p).features[k]).map((k) => (
                        <Chip key={k} size="small" variant="outlined" label={t(PLAN_FEATURE_LABELS[k])} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell><PlanCustomCodeSwitch planId={p.id} planName={p.name} enabled={parseEntitlements(p).features.custom_code} /></TableCell>
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

/** Funciones del plan en palabras (el código propio tiene su propia columna). */
const PLAN_FEATURE_LABELS = {
  pdf_export: msg('Catálogo PDF'),
  remove_branding: msg('Sin «Sitio creado con»'),
  custom_domain: msg('Dominio propio'),
  analytics: msg('Estadísticas avanzadas'),
} as const;

async function Status({ label, ok, value }: { label: string; ok?: boolean; value?: string }) {
  const t = await getT();
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2">{label}</Typography>
      {value !== undefined ? <Chip size="small" label={value} variant="outlined" /> : <Chip size="small" label={ok ? t('Configurado') : t('Falta')} color={ok ? 'success' : 'warning'} />}
    </Stack>
  );
}
