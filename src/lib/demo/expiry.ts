/** Horas completas que le quedan a la cuenta de prueba (0 = menos de una). */
export function demoHoursLeft(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 3_600_000));
}
