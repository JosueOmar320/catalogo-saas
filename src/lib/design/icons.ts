import {
  ArrowRight, Award, Baby, BadgeCheck, BookOpen, Building2, Cake, Calendar, CalendarCheck, Camera, Car, Check, CircleCheck,
  ClipboardList, Clock, Coffee, CreditCard, Crown, Dog, Droplet, Dumbbell, Flame, Gem, Gift, Globe, GraduationCap, Hammer,
  Handshake, Headphones, Heart, House, Info, Laptop, Leaf, Lightbulb, Mail, Map, MapPin, MessageCircle, Music, Package,
  Paintbrush, Percent, Phone, Pizza, Plane, Quote, Recycle, Rocket, Scissors, Shirt, ShieldCheck, ShoppingBag, ShoppingCart,
  Smartphone, Smile, Sparkles, Star, Stethoscope, Store, Sun, Tag, Target, ThumbsUp, Timer, Truck, User, Users, Utensils,
  Wallet, Wifi, Wrench, Zap,
} from 'lucide';

/**
 * Iconos disponibles para el usuario (sin subir imágenes). Se guardan por id
 * y se dibujan desde los nodos SVG de Lucide: mismo trazo en web y en PDF.
 * Para agregar uno: importarlo y sumarlo a la lista.
 */
export type IconNode = [tag: string, attrs: Record<string, string | number>][];

const ICON_LIST = [
  ['phone', 'Teléfono', Phone], ['message-circle', 'Mensaje', MessageCircle], ['mail', 'Email', Mail],
  ['map-pin', 'Ubicación', MapPin], ['map', 'Mapa', Map], ['clock', 'Horario', Clock], ['globe', 'Web', Globe],
  ['truck', 'Envío', Truck], ['shield-check', 'Garantía', ShieldCheck], ['star', 'Estrella', Star], ['heart', 'Corazón', Heart],
  ['award', 'Premio', Award], ['badge-check', 'Verificado', BadgeCheck], ['sparkles', 'Brillo', Sparkles], ['leaf', 'Natural', Leaf],
  ['coffee', 'Café', Coffee], ['utensils', 'Comida', Utensils], ['pizza', 'Pizza', Pizza], ['cake', 'Pastel', Cake],
  ['shopping-bag', 'Bolsa', ShoppingBag], ['shopping-cart', 'Carrito', ShoppingCart], ['gift', 'Regalo', Gift], ['tag', 'Etiqueta', Tag],
  ['percent', 'Descuento', Percent], ['credit-card', 'Tarjeta', CreditCard], ['wallet', 'Pago', Wallet], ['package', 'Paquete', Package],
  ['wrench', 'Reparación', Wrench], ['hammer', 'Construcción', Hammer], ['scissors', 'Corte', Scissors], ['paintbrush', 'Pintura', Paintbrush],
  ['camera', 'Foto', Camera], ['calendar', 'Calendario', Calendar], ['calendar-check', 'Reserva', CalendarCheck], ['users', 'Equipo', Users],
  ['user', 'Persona', User], ['smile', 'Sonrisa', Smile], ['thumbs-up', 'Aprobado', ThumbsUp], ['zap', 'Rápido', Zap],
  ['rocket', 'Lanzamiento', Rocket], ['target', 'Objetivo', Target], ['lightbulb', 'Idea', Lightbulb], ['circle-check', 'Listo', CircleCheck],
  ['check', 'Check', Check], ['house', 'Hogar', House], ['building', 'Empresa', Building2], ['store', 'Tienda', Store], ['car', 'Auto', Car],
  ['plane', 'Viaje', Plane], ['dumbbell', 'Gimnasio', Dumbbell], ['stethoscope', 'Salud', Stethoscope], ['graduation-cap', 'Educación', GraduationCap],
  ['book-open', 'Libro', BookOpen], ['music', 'Música', Music], ['wifi', 'Wi-Fi', Wifi], ['recycle', 'Reciclaje', Recycle], ['sun', 'Sol', Sun],
  ['flame', 'Fuego', Flame], ['droplet', 'Agua', Droplet], ['baby', 'Bebé', Baby], ['dog', 'Mascotas', Dog], ['shirt', 'Ropa', Shirt],
  ['gem', 'Joya', Gem], ['crown', 'Premium', Crown], ['handshake', 'Acuerdo', Handshake], ['headphones', 'Soporte', Headphones],
  ['laptop', 'Computadora', Laptop], ['smartphone', 'Celular', Smartphone], ['clipboard-list', 'Lista', ClipboardList], ['timer', 'Tiempo', Timer],
  ['arrow-right', 'Flecha', ArrowRight], ['info', 'Información', Info], ['quote', 'Cita', Quote],
] as const;

export type IconId = (typeof ICON_LIST)[number][0];
export const ICON_IDS = ICON_LIST.map(([id]) => id) as unknown as [IconId, ...IconId[]];
export const ICONS: Record<IconId, { label: string; node: IconNode }> = Object.fromEntries(
  ICON_LIST.map(([id, label, node]) => [id, { label, node: node as unknown as IconNode }]),
) as Record<IconId, { label: string; node: IconNode }>;

export function isIconId(value: unknown): value is IconId {
  return typeof value === 'string' && value in ICONS;
}
