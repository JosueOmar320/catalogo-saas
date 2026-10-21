'use client';

import { useEffect } from 'react';

/**
 * El layout raíz es estático (lang="es"): en el sitio público se corrige al
 * idioma del negocio para lectores de pantalla y traductores (lo mismo que
 * hace I18nProvider con el panel). Sólo en el sitio público: en la vista
 * previa del editor manda el idioma del panel.
 */
export function SiteLang({ language }: { language: string }) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.lang === language) return;
    const previous = root.lang;
    root.lang = language;
    return () => {
      root.lang = previous;
    };
  }, [language]);
  return null;
}
