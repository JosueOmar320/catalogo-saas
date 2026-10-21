'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CatalogStatus } from '@/types/database';
import type { SiteKind } from '@/lib/business/site-kind';

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
