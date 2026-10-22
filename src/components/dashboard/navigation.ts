import { Building2, Contact, FileDown, Globe, History, Home, Image as ImageIcon, LayoutDashboard, LibraryBig, MessageSquareText, Package, ReceiptText, Settings, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';
import { msg } from '@/i18n/translate';
import type { SiteKind } from '@/lib/business/site-kind';

/** Las etiquetas se marcan con msg(): quien las muestra las traduce con t(). */
export type NavLink = { label: string; href: string };
/** catalogOnly: no aparece en un sitio web (sin productos ni pedidos). */
export type NavEntry = { label: string; icon: LucideIcon; href?: string; children?: NavLink[]; catalogOnly?: boolean };

export const SETTINGS_SECTIONS = [
  { id: 'negocio', label: msg('Negocio') },
  { id: 'contacto', label: msg('Información de contacto') },
  { id: 'redes', label: msg('Redes sociales') },
  { id: 'seo', label: msg('SEO') },
  { id: 'publicacion', label: msg('Publicación') },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export const NAVIGATION: NavEntry[] = [
  { label: msg('Inicio'), icon: Home, href: '/dashboard' },
  { label: msg('Pedidos'), icon: ReceiptText, href: '/dashboard/pedidos', catalogOnly: true },
  { label: msg('Clientes'), icon: Contact, href: '/dashboard/clientes', catalogOnly: true },
  {
    label: msg('Contenido'),
    icon: Package,
    catalogOnly: true,
    children: [
      { label: msg('Productos'), href: '/dashboard/catalog/products' },
      { label: msg('Servicios'), href: '/dashboard/catalog/services' },
      { label: msg('Categorías'), href: '/dashboard/catalog/categories' },
      { label: msg('Atributos'), href: '/dashboard/catalog/attributes' },
      { label: msg('Orden'), href: '/dashboard/catalog/order' },
    ],
  },
  { label: msg('Medios'), icon: ImageIcon, href: '/dashboard/media' },
  { label: msg('Reseñas'), icon: MessageSquareText, href: '/dashboard/resenas', catalogOnly: true },
  {
    label: msg('Sitio web'),
    icon: Globe,
    children: [
      { label: msg('Páginas y secciones'), href: '/dashboard/sitio' },
      { label: msg('Navegación'), href: '/dashboard/sitio?panel=navigation' },
      { label: msg('Diseño'), href: '/dashboard/sitio?panel=design' },
    ],
  },
  { label: msg('Catálogo PDF'), icon: FileDown, href: '/dashboard/export/pdf', catalogOnly: true },
  {
    label: msg('Configuración'),
    icon: Settings,
    children: SETTINGS_SECTIONS.map((s) => ({ label: s.label, href: `/dashboard/settings/${s.id}` })),
  },
];

/** Panel de administración de la plataforma. */
export const ADMIN_NAVIGATION: NavEntry[] = [
  { label: msg('Dashboard'), icon: LayoutDashboard, href: '/admin' },
  { label: msg('Usuarios'), icon: Users, href: '/admin/usuarios' },
  { label: msg('Negocios'), icon: Building2, href: '/admin/negocios' },
  { label: msg('Catálogos'), icon: LibraryBig, href: '/admin/catalogos' },
  { label: msg('Medios'), icon: ImageIcon, href: '/admin/medios' },
  { label: msg('Auditoría'), icon: History, href: '/admin/auditoria' },
  { label: msg('Configuración'), icon: SlidersHorizontal, href: '/admin/configuracion' },
];

/** Menú del panel según el tipo de sitio. */
export const navigationFor = (kind: SiteKind): NavEntry[] => (kind === 'website' ? NAVIGATION.filter((entry) => !entry.catalogOnly) : NAVIGATION);
