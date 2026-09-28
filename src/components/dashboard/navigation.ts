import { FileDown, Globe, Home, Package, Settings, type LucideIcon } from 'lucide-react';

export type NavLink = { label: string; href: string };
export type NavEntry = { label: string; icon: LucideIcon; href?: string; children?: NavLink[] };

export const SETTINGS_SECTIONS = [
  { id: 'negocio', label: 'Negocio' },
  { id: 'contacto', label: 'Información de contacto' },
  { id: 'redes', label: 'Redes sociales' },
  { id: 'seo', label: 'SEO' },
  { id: 'publicacion', label: 'Publicación' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export const NAVIGATION: NavEntry[] = [
  { label: 'Inicio', icon: Home, href: '/dashboard' },
  {
    label: 'Catálogo',
    icon: Package,
    children: [
      { label: 'Productos', href: '/dashboard/catalog/products' },
      { label: 'Servicios', href: '/dashboard/catalog/services' },
      { label: 'Categorías', href: '/dashboard/catalog/categories' },
      { label: 'Orden', href: '/dashboard/catalog/order' },
    ],
  },
  {
    label: 'Sitio web',
    icon: Globe,
    children: [
      { label: 'Páginas y secciones', href: '/dashboard/sitio' },
      { label: 'Navegación', href: '/dashboard/sitio?panel=navigation' },
      { label: 'Diseño', href: '/dashboard/sitio?panel=design' },
    ],
  },
  {
    label: 'Configuración',
    icon: Settings,
    children: SETTINGS_SECTIONS.map((s) => ({ label: s.label, href: `/dashboard/settings/${s.id}` })),
  },
  { label: 'Exportar', icon: FileDown, children: [{ label: 'PDF', href: '/dashboard/export/pdf' }] },
];
