import { Grid, Stack, Typography } from '@mui/material';
import { BarChart3, Bot, FileText, Inbox, Palette, Package } from 'lucide-react';
import { LinkCard } from '@/components/ui/LinkCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';

const STOPS = [
  { href: '/dashboard/sitio', icon: Palette, title: msg('Edita el sitio'), text: msg('Cambia textos, colores, secciones y el menú, con vista previa en celular.') },
  { href: '/dashboard/sitio', icon: Bot, title: msg('Pídele algo a Garfield'), text: msg('En el editor: «agrega una sección de preguntas frecuentes» o «cambia a un estilo oscuro».') },
  { href: '/dashboard/pedidos', icon: Inbox, title: msg('Revisa los pedidos'), text: msg('Pedidos de ejemplo por WhatsApp: confírmalos, márcalos como listos o entregados.') },
  { href: '/dashboard/estadisticas', icon: BarChart3, title: msg('Mira las estadísticas'), text: msg('Visitas, de dónde llegan y cuántas terminan en pedido, contra el periodo anterior.') },
  { href: '/dashboard/catalog/products', icon: Package, title: msg('Administra los productos'), text: msg('Opciones, extras, precios por mayoreo, existencias y margen.') },
  { href: '/dashboard/export/pdf', icon: FileText, title: msg('Descarga el catálogo en PDF'), text: msg('Se arma con el mismo diseño del sitio.') },
] as const;

/** Inicio del panel en la cuenta de prueba: un recorrido por lo que vale la pena ver. */
export async function DemoTour() {
  const t = await getT();
  return (
    <SectionCard title={t('Recorrido sugerido')} description={t('Este es un negocio de ejemplo con datos de prueba. Toca cualquier parada.')}>
      <Grid container spacing={1.5}>
        {STOPS.map(({ href, icon: Icon, title, text }) => (
          <Grid key={title} size={{ xs: 12, sm: 6 }}>
            <LinkCard href={href} sx={{ height: '100%' }}>
              <Stack direction="row" spacing={1.5}>
                <Icon size={18} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
                <div>
                  <Typography variant="subtitle2">{t(title)}</Typography>
                  <Typography variant="body2" color="text.secondary">{t(text)}</Typography>
                </div>
              </Stack>
            </LinkCard>
          </Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}
