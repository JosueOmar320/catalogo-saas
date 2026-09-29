import { Building2, FileDown, Globe, History, Home, Image as ImageIcon, LayoutDashboard, LibraryBig, Package, Settings, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';

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
    label: 'Contenido',
    icon: Package,
    children: [
      { label: 'Productos', href: '/dashboard/catalog/products' },
      { label: 'Servicios', href: '/dashboard/catalog/services' },
      { label: 'Categorías', href: '/dashboard/catalog/categories' },
      { label: 'Atributos', href: '/dashboard/catalog/attributes' },
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
  { label: 'Catálogo PDF', icon: FileDown, href: '/dashboard/export/pdf' },
  {
    label: 'Configuración',
    icon: Settings,
    children: SETTINGS_SECTIONS.map((s) => ({ label: s.label, href: `/dashboard/settings/${s.id}` })),
  },
];

/** Panel de administración de la plataforma. */
export const ADMIN_NAVIGATION: NavEntry[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Usuarios', icon: Users, href: '/admin/usuarios' },
  { label: 'Negocios', icon: Building2, href: '/admin/negocios' },
  { label: 'Catálogos', icon: LibraryBig, href: '/admin/catalogos' },
  { label: 'Medios', icon: ImageIcon, href: '/admin/medios' },
  { label: 'Auditoría', icon: History, href: '/admin/auditoria' },
  { label: 'Configuración', icon: SlidersHorizontal, href: '/admin/configuracion' },
];
