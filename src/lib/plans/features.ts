import { msg } from '@/i18n/translate';
import type { PlanFeatures } from './entitlements';

/**
 * Funciones que el administrador de la plataforma puede apagar (o encender)
 * por negocio: aplica a todos sus usuarios. Lo decidido para el negocio gana
 * sobre el plan; sin decisión, manda el plan (y si el plan no dice nada, está
 * encendida). La base valida los nombres (admin_set_business_features).
 */
export const BUSINESS_FEATURES = ['assistant', 'pdf_export', 'orders', 'analytics', 'import', 'custom_domain'] as const;
export type BusinessFeature = (typeof BUSINESS_FEATURES)[number];
export type FeatureOverrides = Partial<Record<BusinessFeature, boolean>>;
export type BusinessFeatures = Record<BusinessFeature, boolean>;

export const BUSINESS_FEATURE_META: Record<BusinessFeature, { label: string; description: string }> = {
  assistant: { label: msg('Garfield AI'), description: msg('El asistente del panel y del editor, y «Escribir con Garfield».') },
  pdf_export: { label: msg('Catálogo PDF'), description: msg('Armar y descargar el catálogo en PDF.') },
  orders: { label: msg('Pedidos y clientes'), description: msg('La bandeja de pedidos y la lista de clientes del panel. Los pedidos por WhatsApp del sitio siguen llegando.') },
  analytics: { label: msg('Estadísticas'), description: msg('La página de estadísticas y las visitas del inicio del panel.') },
  import: { label: msg('Importar productos'), description: msg('Subir productos desde un archivo CSV o Excel.') },
  custom_domain: { label: msg('Dominio propio'), description: msg('Servir el sitio en su propio dominio (mitienda.com) además de la dirección de la plataforma.') },
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

/** Lo que dice el plan (el PDF y el dominio propio dependen del plan; lo demás, encendido). */
export function planFeatureDefault(feature: BusinessFeature, plan: PlanFeatures): boolean {
  if (feature === 'pdf_export') return plan.pdf_export;
  if (feature === 'custom_domain') return plan.custom_domain;
  return true;
}

export function effectiveFeatures(overrides: FeatureOverrides, plan: PlanFeatures): BusinessFeatures {
  return Object.fromEntries(BUSINESS_FEATURES.map((f) => [f, overrides[f] ?? planFeatureDefault(f, plan)])) as BusinessFeatures;
}

/** Extras del plan: que el plan no lo incluya es lo normal, no cuenta como función apagada. */
const PLAN_EXTRAS: readonly BusinessFeature[] = ['custom_domain'];

/** Lo que el negocio tiene apagado (para el administrador): todo lo apagado, salvo un extra que sólo falta en el plan. */
export function featuresOff(effective: BusinessFeatures, overrides: FeatureOverrides): BusinessFeature[] {
  return BUSINESS_FEATURES.filter((f) => !effective[f] && (overrides[f] === false || !PLAN_EXTRAS.includes(f)));
}

/** Todas encendidas (vistas sin negocio, pruebas). */
export const ALL_FEATURES: BusinessFeatures = Object.fromEntries(BUSINESS_FEATURES.map((f) => [f, true])) as BusinessFeatures;
