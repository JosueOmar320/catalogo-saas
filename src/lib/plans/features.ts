import { msg } from '@/i18n/translate';
import type { PlanFeatures } from './entitlements';

/**
 * Funciones que el administrador de la plataforma puede apagar (o encender)
 * por negocio: aplica a todos sus usuarios. Lo decidido para el negocio gana
 * sobre el plan; sin decisión, manda el plan (y si el plan no dice nada, está
 * encendida). La base valida los nombres (admin_set_business_features).
 */
export const BUSINESS_FEATURES = ['assistant', 'pdf_export', 'orders', 'analytics', 'import'] as const;
export type BusinessFeature = (typeof BUSINESS_FEATURES)[number];
export type FeatureOverrides = Partial<Record<BusinessFeature, boolean>>;
export type BusinessFeatures = Record<BusinessFeature, boolean>;

export const BUSINESS_FEATURE_META: Record<BusinessFeature, { label: string; description: string }> = {
  assistant: { label: msg('Garfield AI'), description: msg('El asistente del panel y del editor, y «Escribir con Garfield».') },
  pdf_export: { label: msg('Catálogo PDF'), description: msg('Armar y descargar el catálogo en PDF.') },
  orders: { label: msg('Pedidos y clientes'), description: msg('La bandeja de pedidos y la lista de clientes del panel. Los pedidos por WhatsApp del sitio siguen llegando.') },
  analytics: { label: msg('Estadísticas'), description: msg('La página de estadísticas y las visitas del inicio del panel.') },
  import: { label: msg('Importar productos'), description: msg('Subir productos desde un archivo CSV o Excel.') },
};

/** Sólo claves conocidas con valor sí/no (lo demás se ignora). */
export function parseFeatureOverrides(value: unknown): FeatureOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: FeatureOverrides = {};
  for (const key of BUSINESS_FEATURES) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

/** Lo que dice el plan (sólo el PDF depende del plan hoy). */
export function planFeatureDefault(feature: BusinessFeature, plan: PlanFeatures): boolean {
  return feature === 'pdf_export' ? plan.pdf_export : true;
}

export function effectiveFeatures(overrides: FeatureOverrides, plan: PlanFeatures): BusinessFeatures {
  return Object.fromEntries(BUSINESS_FEATURES.map((f) => [f, overrides[f] ?? planFeatureDefault(f, plan)])) as BusinessFeatures;
}

/** Todas encendidas (vistas sin negocio, pruebas). */
export const ALL_FEATURES: BusinessFeatures = Object.fromEntries(BUSINESS_FEATURES.map((f) => [f, true])) as BusinessFeatures;
