'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { buildAssistantContext } from '@/lib/assistant/context';
import { buildPdfContext } from '@/lib/assistant/pdf-context';
import type { PdfAction } from '@/lib/assistant/pdf-actions';
import type { PdfSettings } from '@/lib/pdf/settings';
import type { SiteViewModel } from '@/lib/site/view-model';
import { planPdfActions } from '../pdf-executor';
import type { SuggestionSet } from '../suggestions';
import { GarfieldEngine, type EnginePlan, type GarfieldAdapter } from './GarfieldProvider';

type Props = {
  settings: PdfSettings;
  onChange: (settings: PdfSettings) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  /** Vista previa de una propuesta (null = volver al borrador). */
  onPreview: (settings: PdfSettings | null) => void;
  site: SiteViewModel;
  children: ReactNode;
};

const s = (label: string, prompt = label) => ({ label, prompt });

function pdfSuggestions(settings: PdfSettings, selectedBlockId: string | null): SuggestionSet {
  const block = settings.blocks.find((b) => b.id === selectedBlockId);
  if (block?.type === 'catalog' || block?.type === 'products') {
    return { title: msg('¿Cómo mostramos los productos?'), items: [s(msg('🔢 4 por página'), msg('Quiero cuatro productos por página')), s(msg('📰 Dos columnas'), msg('Usa un layout de dos columnas para los productos')), s(msg('📑 Portada por categoría'), msg('Agrega una página de categoría antes de cada grupo de productos')), s(msg('💲 Lista de precios'), msg('Muestra los productos como lista de precios'))] };
  }
  if (block?.type === 'cover') {
    return { title: msg('¿Mejoramos la portada?'), items: [s(msg('✨ Más elegante'), msg('Quiero que la portada sea más elegante')), s(msg('🖼️ Con foto'), msg('Pon una foto de mi biblioteca en la portada')), s(msg('🔤 Título'), msg('Cambia el título de la portada por "Catálogo 2026"'))] };
  }
  return {
    title: msg('Pídeme algo para el PDF'),
    items: [
      s(msg('💎 Catálogo de lujo'), msg('Quiero que el PDF parezca un catálogo de lujo')),
      s(msg('🏷️ Logo y números'), msg('Agrega el logo arriba a la izquierda y el número de página abajo')),
      s(msg('🔢 4 por página'), msg('Quiero cuatro productos por página')),
      s(msg('📕 Contraportada'), msg('Agrega una contraportada')),
    ],
  };
}

/** Garfield en el estudio de PDF: mismo chat y motor, acciones de PDF. */
export function PdfGarfieldProvider({ settings, onChange, selectedBlockId, onSelectBlock, onPreview, site, children }: Props) {
  const settingsRef = useRef(settings);
  const selectedRef = useRef(selectedBlockId);
  useEffect(() => {
    settingsRef.current = settings;
    selectedRef.current = selectedBlockId;
  }, [settings, selectedBlockId]);
  const suggestions = useMemo(() => pdfSuggestions(settings, selectedBlockId), [settings, selectedBlockId]);
  const t = useT();

  const adapter = useMemo<GarfieldAdapter>(
    () => ({
      editor: 'pdf',
      storageKey: `garfield-pdf:${site.business.slug}`,
      suggestions,
      context: () =>
        buildAssistantContext({
          site,
          pages: site.pages,
          theme: site.theme,
          navigation: site.navigation,
          panel: 'pages',
          currentPageId: site.pages[0]?.id ?? '',
          selectedSectionId: null,
          lastSectionIds: [],
          mode: 'pdf',
          pdf: buildPdfContext(settingsRef.current, selectedRef.current),
        }),
      plan: (actions, allowedMedia) => {
        const plan = planPdfActions(settingsRef.current, actions as PdfAction[], { selectedBlockId: selectedRef.current, allowedMedia, t });
        return {
          next: plan.next,
          steps: plan.steps.map(({ label, status, risk, error }) => ({ label, status, risk, error, kind: 'pdf' as const })),
          changed: plan.changed,
          autoApply: plan.autoApply,
          needsConfirmation: plan.needsConfirmation,
          destructive: plan.steps.some((st) => st.status === 'ok' && st.action.action === 'remove_pdf_block'),
          hasServerChanges: false,
          touched: plan.touchedBlockIds,
          focus: plan.focusBlockId ?? plan.touchedBlockIds[plan.touchedBlockIds.length - 1] ?? null,
        } as EnginePlan & { focus: string | null };
      },
      snapshot: () => settingsRef.current,
      commit: (plan) => {
        if (plan.changed) {
          settingsRef.current = plan.next as PdfSettings;
          onChange(plan.next as PdfSettings);
        }
        const focus = (plan as EnginePlan & { focus?: string | null }).focus;
        if (focus) onSelectBlock(focus);
      },
      restore: (snapshot) => onChange(snapshot as PdfSettings),
      preview: (next) => onPreview(next as PdfSettings | null),
    }),
    [onChange, onPreview, onSelectBlock, site, suggestions, t],
  );

  return <GarfieldEngine adapter={adapter}>{children}</GarfieldEngine>;
}
