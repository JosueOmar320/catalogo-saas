'use client';

import { createContext, useContext } from 'react';
import type { SitePage } from '@/lib/site/pages';
import type { BuilderAction, BuilderState } from './reducer';

export { builderReducer, type BuilderAction, type BuilderPanel, type BuilderState } from './reducer';

type BuilderContextValue = { state: BuilderState; dispatch: React.Dispatch<BuilderAction> };
export const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) throw new Error('useBuilder debe usarse dentro del Builder');
  return context;
}

export function useSelectedPage(): SitePage {
  const { state } = useBuilder();
  return state.pages.find((p) => p.id === state.selectedPageId) ?? state.pages[0];
}
