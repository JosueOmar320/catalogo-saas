import { redirect } from 'next/navigation';

/** Rutas de diseño de la v1: ahora viven en el editor del sitio. */
const TABS: Record<string, string> = { tema: 'theme', colores: 'colors', tipografia: 'type', layout: 'cards', secciones: 'style' };

export default async function LegacyDesignRedirect({ params }: PageProps<'/dashboard/design/[[...section]]'>) {
  const { section } = await params;
  const tab = TABS[section?.[0] ?? ''] ?? 'theme';
  redirect(`/dashboard/sitio?panel=design&tab=${tab}`);
}
