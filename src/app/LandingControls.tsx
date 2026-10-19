'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore, useTransition } from 'react';
import { MODE_STORAGE_KEY, type ColorMode } from '@/components/providers/color-mode';
import { setLocale } from '@/i18n/actions';
import { useLocale, useT } from '@/i18n/client';
import { LOCALES } from '@/i18n/config';
import styles from './landing.module.css';

/**
 * Idioma y apariencia en la landing, sin MUI (no se carga en esta página).
 * Usa la misma preferencia que el panel: localStorage[MODE_STORAGE_KEY] y la
 * clase light/dark del <html> (InitColorSchemeScript la aplica al cargar).
 */
const ORDER: ColorMode[] = ['system', 'light', 'dark'];
const listeners = new Set<() => void>();

function readMode(): ColorMode {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyMode(mode: ColorMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {}
  listeners.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

export function LandingControls() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // En el servidor no se conoce la preferencia: se muestra "sistema" hasta hidratar.
  const mode = useSyncExternalStore(subscribe, readMode, () => 'system' as ColorMode);
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;
  const modeLabel = { system: t('Sistema'), light: t('Claro'), dark: t('Oscuro') }[mode];

  return (
    <div className={styles.controls}>
      <div className={styles.segmented} role="group" aria-label={t('Idioma')}>
        {LOCALES.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={option === locale}
            disabled={pending}
            onClick={() => {
              if (option === locale) return;
              startTransition(async () => {
                await setLocale(option);
                router.refresh();
              });
            }}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
      <button type="button" className={styles.iconButton} onClick={() => applyMode(next)} aria-label={t('Apariencia: {mode}. Cambiar', { mode: modeLabel })} title={t('Apariencia: {mode}. Cambiar', { mode: modeLabel })}>
        <Icon size={16} aria-hidden />
      </button>
    </div>
  );
}
