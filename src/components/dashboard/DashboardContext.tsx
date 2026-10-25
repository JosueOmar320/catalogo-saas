'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CatalogStatus } from '@/types/database';
import type { SiteKind } from '@/lib/business/site-kind';
import type { BusinessFeature, BusinessFeatures } from '@/lib/plans/features';

export type DashboardInfo = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  catalogId: string;
  catalogStatus: CatalogStatus;
  publicUrl: string;
  maxImagesPerItem: number | null;
  canManage: boolean;
  /** Negocio con catálogo o sitio web sin productos. */
  siteKind: SiteKind;
  /** Funciones encendidas para este negocio (las decide el administrador). */
  features: BusinessFeatures;
};

const DashboardContext = createContext<DashboardInfo | null>(null);

export function DashboardProvider({ value, children }: { value: DashboardInfo; children: ReactNode }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/** Datos del negocio activo para componentes cliente (resueltos en el servidor). */
export function useDashboard(): DashboardInfo {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard debe usarse dentro del panel');
  return context;
}

/** ¿Está encendida esta función? Fuera del panel (vista previa pública, pruebas), sí. */
export function useFeatureEnabled(feature: BusinessFeature): boolean {
  return useContext(DashboardContext)?.features[feature] ?? true;
}
