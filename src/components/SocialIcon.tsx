import { Globe, MessageCircle, Music2 } from 'lucide-react';
import type { SocialNetworkId } from '@/lib/social/networks';

type Props = { network: SocialNetworkId; size?: number };

/**
 * Íconos de redes sociales con el mismo estilo de trazo que Lucide
 * (Lucide v1 ya no incluye logos de marcas).
 */
export function SocialIcon({ network, size = 18 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (network) {
    case 'instagram':
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M4 4l16 16M20 4 4 20" />
        </svg>
      );
    case 'pinterest':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M11 8.5c2.5-1 5 .5 4.5 3.5-.4 2.3-2.6 3.2-4 2.2M11.5 10 9 21" />
        </svg>
      );
    case 'tiktok':
      return <Music2 size={size} aria-hidden />;
    case 'whatsapp':
      return <MessageCircle size={size} aria-hidden />;
    case 'website':
    default:
      return <Globe size={size} aria-hidden />;
  }
}
