import type { Catalog } from '../translate';

/**
 * Pantallas de estado que viven FUERA del I18nProvider (error.tsx,
 * not-found.tsx y global-error.tsx raíz). Catálogo mínimo: esas pantallas lo
 * cargan en lugar del catálogo completo de la app (que pesa ~170 KB y se
 * referenciaba desde todas las páginas públicas). `core.ts` lo incluye para
 * que siga formando parte de APP_EN.
 */
const catalog: Catalog = {
  'Algo salió mal': 'Something went wrong',
  'No pudimos cargar esta página': "We couldn't load this page",
  'Puede ser un problema temporal de conexión. Intenta de nuevo en unos segundos.': 'It may be a temporary connection problem. Try again in a few seconds.',
  Reintentar: 'Retry',
  'Código: {code}': 'Code: {code}',
  'No pudimos cargar la aplicación': "We couldn't load the app",
  'Es un error inesperado. Intenta de nuevo en unos segundos.': 'This is an unexpected error. Try again in a few seconds.',
  'Error 404': 'Error 404',
  'No encontramos esta página': "We couldn't find this page",
  'Puede que el enlace esté mal escrito o que la página ya no exista.': 'The link may be mistyped, or the page may no longer exist.',
  'Ir al inicio': 'Go to home',
};

export default catalog;
