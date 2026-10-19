'use client';

import { useSyncExternalStore } from 'react';
import type { Translator } from '@/i18n/translate';
import { openStatus, shortTime, weekdayName, type OpenStatus, type Schedule } from '@/lib/business/schedule';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

/** Minuto actual, que cambia solo; en el servidor null (la página pública está en caché: el estado se calcula en el navegador). */
const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

export function useOpenStatus(schedule: Schedule | null): OpenStatus | null {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  if (!schedule?.enabled || minute === null) return null;
  return openStatus(schedule, new Date(minute * 60_000));
}

/** "Cerrado · abre mañana a las 7:30". */
export function opensText(status: Extract<OpenStatus, { open: false }>, t: Translator, locale: string): string {
  const next = status.opensAt;
  if (!next) return t('Cerrado');
  const time = shortTime(next.time);
  if (next.inDays === 0) return t('Cerrado · abre hoy a las {time}', { time });
  if (next.inDays === 1) return t('Cerrado · abre mañana a las {time}', { time });
  return t('Cerrado · abre el {day} a las {time}', { day: weekdayName(next.day, locale, 'long'), time });
}

export function openText(status: OpenStatus, t: Translator, locale: string): string {
  if (status.open) return status.closesAt ? t('Abierto ahora · cierra a las {time}', { time: shortTime(status.closesAt) }) : t('Abierto ahora');
  return opensText(status, t, locale);
}

/** Indicador "Abierto ahora / Cerrado" con un punto de color. */
export function OpenNow({ schedule, locale }: { schedule: Schedule; locale: string }) {
  const t = useSiteT();
  const status = useOpenStatus(schedule);
  if (!status) return null;
  return (
    <span className={styles.openNow} data-open={status.open}>
      <span className={styles.openDot} aria-hidden />
      {openText(status, t, locale)}
    </span>
  );
}
