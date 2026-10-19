import { msg } from '@/i18n/translate';

/** Registro de redes sociales soportadas. El ícono vive en components/SocialIcon. */
export const SOCIAL_NETWORK_IDS = [
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
  'x',
  'youtube',
  'linkedin',
  'pinterest',
  'website',
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORK_IDS)[number];

export const SOCIAL_NETWORKS: Record<SocialNetworkId, { label: string; placeholder: string }> = {
  instagram: { label: 'Instagram', placeholder: 'https://instagram.com/tunegocio' },
  facebook: { label: 'Facebook', placeholder: 'https://facebook.com/tunegocio' },
  tiktok: { label: 'TikTok', placeholder: 'https://tiktok.com/@tunegocio' },
  whatsapp: { label: 'WhatsApp', placeholder: 'https://wa.me/5215512345678' },
  x: { label: 'X (Twitter)', placeholder: 'https://x.com/tunegocio' },
  youtube: { label: 'YouTube', placeholder: 'https://youtube.com/@tunegocio' },
  linkedin: { label: 'LinkedIn', placeholder: 'https://linkedin.com/company/tunegocio' },
  pinterest: { label: 'Pinterest', placeholder: 'https://pinterest.com/tunegocio' },
  website: { label: msg('Sitio web'), placeholder: 'https://tunegocio.com' },
};
