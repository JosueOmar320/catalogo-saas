import { BarChart3, Building2, Contact, FileDown, Globe, History, Home, Image as ImageIcon, LayoutDashboard, LibraryBig, MessageSquareText, Package, ReceiptText, Settings, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';
import { msg } from '@/i18n/translate';
import type { SiteKind } from '@/lib/business/site-kind';
import { ALL_FEATURES, type BusinessFeature, type BusinessFeatures } from '@/lib/plans/features';

/** Las etiquetas se marcan con msg(): quien las muestra las traduce con t(). */
export type NavLink = { label: string; href: string; catalogOnly?: boolean };
/** catalogOnly: no aparece en un sitio web (sin productos ni pedidos). */
/** feature: se oculta si el administrador apagó esa función para el negocio. */
export type NavEntry = { label: string; icon: LucideIcon; href?: string; children?: NavLink[]; catalogOnly?: boolean; feature?: BusinessFeature };

export const SETTINGS_SECTIONS = [
  { id: 'negocio', label: msg('Negocio') },
  { id: 'contacto', label: msg('Contacto y horario') },
  { id: 'pedidos', label: msg('Pedidos por WhatsApp'), catalogOnly: true },
  { id: 'redes', label: msg('Redes sociales') },
  { id: 'seo', label: msg('SEO') },
  { id: 'publicacion', label: msg('Publicación') },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export const NAVIGATION: NavEntry[] = [
  { label: msg('Inicio'), icon: Home, href: '/dashboard' },
  { label: msg('Pedidos'), icon: ReceiptText, href: '/dashboard/pedidos', catalogOnly: true, feature: 'orders' },
  { label: msg('Clientes'), icon: Contact, href: '/dashboard/clientes', catalogOnly: true, feature: 'orders' },
  { label: msg('Estadísticas'), icon: BarChart3, href: '/dashboard/estadisticas', catalogOnly: true, feature: 'analytics' },
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
  { label: msg('Catálogo PDF'), icon: FileDown, href: '/dashboard/export/pdf', catalogOnly: true, feature: 'pdf_export' },
  {
    label: msg('Configuración'),
    icon: Settings,
    children: SETTINGS_SECTIONS.map((s) => ({ label: s.label, href: `/dashboard/settings/${s.id}`, catalogOnly: 'catalogOnly' in s ? s.catalogOnly : undefined })),
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

/** Menú del panel según el tipo de sitio y las funciones encendidas. */
export const navigationFor = (kind: SiteKind, features: BusinessFeatures = ALL_FEATURES): NavEntry[] =>
  NAVIGATION.filter((entry) => !(kind === 'website' && entry.catalogOnly) && !(entry.feature && !features[entry.feature])).map((entry) =>
    entry.children && kind === 'website' ? { ...entry, children: entry.children.filter((child) => !child.catalogOnly) } : entry,
  );
