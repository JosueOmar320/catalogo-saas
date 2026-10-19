import {
  ArrowRight, Award, Baby, BadgeCheck, BookOpen, Building2, Cake, Calendar, CalendarCheck, Camera, Car, Check, CircleCheck,
  ClipboardList, Clock, Coffee, CreditCard, Crown, Dog, Droplet, Dumbbell, Flame, Gem, Gift, Globe, GraduationCap, Hammer,
  Handshake, Headphones, Heart, House, Info, Laptop, Leaf, Lightbulb, Mail, Map, MapPin, MessageCircle, Music, Package,
  Paintbrush, Percent, Phone, Pizza, Plane, Quote, Recycle, Rocket, Scissors, Shirt, ShieldCheck, ShoppingBag, ShoppingCart,
  Smartphone, Smile, Sparkles, Star, Stethoscope, Store, Sun, Tag, Target, ThumbsUp, Timer, Truck, User, Users, Utensils,
  Wallet, Wifi, Wrench, Zap, Play, CircleHelp, ChartColumn, Image as ImageIcon, Megaphone, TrendingUp, Columns3,
} from 'lucide';
import { msg } from '@/i18n/translate';

/**
 * Iconos disponibles para el usuario (sin subir imágenes). Se guardan por id
 * y se dibujan desde los nodos SVG de Lucide: mismo trazo en web y en PDF.
 * Para agregar uno: importarlo y sumarlo a la lista.
 */
export type IconNode = [tag: string, attrs: Record<string, string | number>][];

const ICON_LIST = [
  ['phone', msg('Teléfono'), Phone], ['message-circle', msg('Mensaje'), MessageCircle], ['mail', msg('Email'), Mail],
  ['map-pin', msg('Ubicación'), MapPin], ['map', msg('Mapa'), Map], ['clock', msg('Horario'), Clock], ['globe', msg('Web'), Globe],
  ['truck', msg('Envío'), Truck], ['shield-check', msg('Garantía'), ShieldCheck], ['star', msg('Estrella'), Star], ['heart', msg('Corazón'), Heart],
  ['award', msg('Premio'), Award], ['badge-check', msg('Verificado'), BadgeCheck], ['sparkles', msg('Brillo'), Sparkles], ['leaf', msg('Natural'), Leaf],
  ['coffee', msg('Café'), Coffee], ['utensils', msg('Comida'), Utensils], ['pizza', msg('Pizza'), Pizza], ['cake', msg('Pastel'), Cake],
  ['shopping-bag', msg('Bolsa'), ShoppingBag], ['shopping-cart', msg('Carrito'), ShoppingCart], ['gift', msg('Regalo'), Gift], ['tag', msg('Etiqueta'), Tag],
  ['percent', msg('Descuento'), Percent], ['credit-card', msg('Tarjeta'), CreditCard], ['wallet', msg('Pago'), Wallet], ['package', msg('Paquete'), Package],
  ['wrench', msg('Reparación'), Wrench], ['hammer', msg('Construcción'), Hammer], ['scissors', msg('Corte'), Scissors], ['paintbrush', msg('Pintura'), Paintbrush],
  ['camera', msg('Foto'), Camera], ['calendar', msg('Calendario'), Calendar], ['calendar-check', msg('Reserva'), CalendarCheck], ['users', msg('Equipo'), Users],
  ['user', msg('Persona'), User], ['smile', msg('Sonrisa'), Smile], ['thumbs-up', msg('Aprobado'), ThumbsUp], ['zap', msg('Rápido'), Zap],
  ['rocket', msg('Lanzamiento'), Rocket], ['target', msg('Objetivo'), Target], ['lightbulb', msg('Idea'), Lightbulb], ['circle-check', msg('Listo'), CircleCheck],
  ['check', msg('Check'), Check], ['house', msg('Hogar'), House], ['building', msg('Empresa'), Building2], ['store', msg('Tienda'), Store], ['car', msg('Automóvil'), Car],
  ['plane', msg('Viaje'), Plane], ['dumbbell', msg('Gimnasio'), Dumbbell], ['stethoscope', msg('Salud'), Stethoscope], ['graduation-cap', msg('Educación'), GraduationCap],
  ['book-open', msg('Libro'), BookOpen], ['music', msg('Música'), Music], ['wifi', msg('Wi-Fi'), Wifi], ['recycle', msg('Reciclaje'), Recycle], ['sun', msg('Sol'), Sun],
  ['flame', msg('Fuego'), Flame], ['droplet', msg('Agua'), Droplet], ['baby', msg('Bebé'), Baby], ['dog', msg('Mascotas'), Dog], ['shirt', msg('Ropa'), Shirt],
  ['gem', msg('Joya'), Gem], ['crown', msg('Premium'), Crown], ['handshake', msg('Acuerdo'), Handshake], ['headphones', msg('Soporte'), Headphones],
  ['laptop', msg('Computadora'), Laptop], ['smartphone', msg('Teléfono celular'), Smartphone], ['clipboard-list', msg('Lista'), ClipboardList], ['timer', msg('Tiempo'), Timer],
  ['arrow-right', msg('Flecha'), ArrowRight], ['info', msg('Información'), Info], ['quote', msg('Cita'), Quote],
  ['play', msg('Video'), Play], ['circle-help', msg('Pregunta'), CircleHelp], ['chart', msg('Estadística'), ChartColumn], ['image', msg('Imagen'), ImageIcon],
  ['megaphone', msg('Anuncio'), Megaphone], ['trending-up', msg('Crecimiento'), TrendingUp], ['columns', msg('Columnas'), Columns3],
] as const;

export type IconId = (typeof ICON_LIST)[number][0];
export const ICON_IDS = ICON_LIST.map(([id]) => id) as unknown as [IconId, ...IconId[]];
export const ICONS: Record<IconId, { label: string; node: IconNode }> = Object.fromEntries(
  ICON_LIST.map(([id, label, node]) => [id, { label, node: node as unknown as IconNode }]),
) as Record<IconId, { label: string; node: IconNode }>;

export function isIconId(value: unknown): value is IconId {
  return typeof value === 'string' && value in ICONS;
}
