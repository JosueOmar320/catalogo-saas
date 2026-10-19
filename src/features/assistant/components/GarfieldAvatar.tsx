'use client';

import { Box, keyframes, type SxProps, type Theme } from '@mui/material';

/**
 * Mascota de Garfield AI: un gato naranja ORIGINAL (no reproduce ninguna
 * ilustración existente). Cara redonda, rayas en la frente, párpados
 * relajados y cachetes. Tiene estados de ánimo para el chat y el editor.
 */
export type GarfieldMood = 'idle' | 'thinking' | 'happy' | 'worried';

const blink = keyframes`
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
`;
const bob = keyframes`
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-2px) rotate(2deg); }
`;
const pop = keyframes`
  0% { transform: scale(0.92); }
  60% { transform: scale(1.06); }
  100% { transform: scale(1); }
`;

const ORANGE = '#F28C28';
const ORANGE_DARK = '#D96F12';
const STRIPE = '#B8560B';
const CREAM = '#FFE3B8';
const PINK = '#F4A3A8';
const INK = '#3A2410';

export function GarfieldAvatar({ size = 40, mood = 'idle', ring = true, sx }: { size?: number; mood?: GarfieldMood; ring?: boolean; sx?: SxProps<Theme> }) {
  // Párpados: relajados (idle), más abiertos (feliz), entrecerrados pensando, caídos preocupado.
  const lid = { idle: 13, thinking: 16, happy: 9, worried: 12 }[mood];
  return (
    <Box
      role="img"
      aria-label="Garfield AI"
      sx={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '50%',
        bgcolor: ring ? 'var(--garfield-tint)' : 'transparent',
        boxShadow: ring ? `inset 0 0 0 1.5px ${ORANGE}33` : 'none',
        display: 'grid',
        placeItems: 'center',
        animation: mood === 'thinking' ? `${bob} 1.1s ease-in-out infinite` : mood === 'happy' ? `${pop} .45s ease-out` : 'none',
        '& .eye': { transformOrigin: '50% 50%', transformBox: 'fill-box', animation: mood === 'idle' ? `${blink} 5s infinite` : 'none' },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', '& .eye': { animation: 'none' } },
        ...sx,
      }}
    >
      <svg viewBox="0 0 64 64" width={size * (ring ? 0.86 : 1)} height={size * (ring ? 0.86 : 1)} aria-hidden>
        {/* Orejas */}
        <path d="M11 24 L14 6 L27 16 Z" fill={ORANGE_DARK} />
        <path d="M53 24 L50 6 L37 16 Z" fill={ORANGE_DARK} />
        <path d="M15 20 L16.5 10.5 L23.5 16 Z" fill={PINK} />
        <path d="M49 20 L47.5 10.5 L40.5 16 Z" fill={PINK} />
        {/* Cabeza */}
        <ellipse cx="32" cy="35" rx="24" ry="21" fill={ORANGE} />
        {/* Rayas */}
        <path d="M32 14.5 v7" stroke={STRIPE} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M25.5 16 q1.5 3.5 1 6" stroke={STRIPE} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M38.5 16 q-1.5 3.5 -1 6" stroke={STRIPE} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M9 34 h6 M9.5 39 h5" stroke={STRIPE} strokeWidth="2" strokeLinecap="round" />
        <path d="M55 34 h-6 M54.5 39 h-5" stroke={STRIPE} strokeWidth="2" strokeLinecap="round" />
        {/* Hocico */}
        <ellipse cx="25.5" cy="43" rx="8" ry="6.5" fill={CREAM} />
        <ellipse cx="38.5" cy="43" rx="8" ry="6.5" fill={CREAM} />
        {/* Ojos (grandes, con párpado) */}
        <g className="eye">
          <ellipse cx="24" cy="30" rx="6.2" ry="7" fill="#FFFFFF" stroke={INK} strokeWidth="1.2" />
          <circle cx={mood === 'thinking' ? 26 : 25} cy={mood === 'thinking' ? 30 : 31.5} r="2.3" fill={INK} />
          <path d={`M17.6 30 A6.4 7 0 0 1 30.4 30 L30.4 ${30 - (16 - lid)} L17.6 ${30 - (16 - lid)} Z`} fill={ORANGE} />
          <path d={`M17.8 ${30 - (16 - lid) + 0.3} H30.2`} stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="eye">
          <ellipse cx="40" cy="30" rx="6.2" ry="7" fill="#FFFFFF" stroke={INK} strokeWidth="1.2" />
          <circle cx={mood === 'thinking' ? 42 : 39} cy={mood === 'thinking' ? 30 : 31.5} r="2.3" fill={INK} />
          <path d={`M33.6 30 A6.4 7 0 0 1 46.4 30 L46.4 ${30 - (16 - lid)} L33.6 ${30 - (16 - lid)} Z`} fill={ORANGE} />
          <path d={`M33.8 ${30 - (16 - lid) + 0.3} H46.2`} stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
        </g>
        {mood === 'worried' && <path d="M18 19.5 l8 2.5 M46 19.5 l-8 2.5" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />}
        {/* Nariz y boca */}
        <path d="M29.5 38.5 h5 l-2.5 2.8 z" fill={PINK} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
        {mood === 'worried' ? (
          <path d="M28 47 q4 -2.5 8 0" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        ) : (
          <path d={mood === 'happy' ? 'M27 44 q2.5 4.5 5 0 q2.5 4.5 5 0' : 'M28 44 q2 2.6 4 0 q2 2.6 4 0'} stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        )}
        {/* Bigotes */}
        <path d="M17 42 l-9 -1.5 M17 45 l-9 1.5 M47 42 l9 -1.5 M47 45 l9 1.5" stroke={INK} strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
        {/* Cachetes */}
        {mood === 'happy' && (
          <>
            <circle cx="15.5" cy="39" r="2.4" fill={PINK} opacity="0.7" />
            <circle cx="48.5" cy="39" r="2.4" fill={PINK} opacity="0.7" />
          </>
        )}
      </svg>
    </Box>
  );
}
