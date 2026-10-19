/**
 * Preferencia de modo claro/oscuro de la app (panel, admin, login, landing).
 * Módulo sin 'use client': lo usan el layout raíz (servidor) y los componentes.
 * MUI guarda la elección en localStorage[MODE_STORAGE_KEY] ('light' | 'dark' |
 * 'system') y aplica la clase `light`/`dark` al <html>.
 */
export const COLOR_SCHEME_ATTRIBUTE = 'class';
export const MODE_STORAGE_KEY = 'app-color-mode';
export type ColorMode = 'light' | 'dark' | 'system';
