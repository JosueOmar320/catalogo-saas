'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isCatalogAction, type AssistantAction } from '@/lib/assistant/actions';
import { buildAssistantContext } from '@/lib/assistant/context';
import type { SiteViewModel } from '@/lib/site/view-model';
import type { BuilderAction, BuilderState } from '../../builder/reducer';
import { applyCatalogActions } from '../catalog-actions';
import { planAssistantActions, type ExecutorEnv, type PlanStep } from '../executor';

/**
 * Estado de la conversación con Garfield y el puente con el builder:
 * enviar → recibir acciones → planificar (ejecutor puro) → vista previa /
 * aplicar / deshacer sobre el borrador. Nada se guarda en la base hasta que
 * el usuario pulsa "Guardar cambios" en el editor.
 */

export type PlanStatus = 'proposed' | 'applied' | 'cancelled' | 'undone' | 'failed' | 'expired';
export type ChatPlan = {
  actions: AssistantAction[];
  steps: Pick<PlanStep, 'label' | 'status' | 'risk' | 'error' | 'kind'>[];
  needsConfirmation: boolean;
  destructive: boolean;
  /** Incluye productos/categorías: se guardan en la base al aplicar. */
  hasCatalogChanges: boolean;
  /** Imágenes de la biblioteca validadas por el servidor para esta respuesta. */
  allowedMedia: string[];
  status: PlanStatus;
  /** Estado anterior, para "Deshacer" (no se persiste). */
  undo?: BuilderState;
};
export type ChatAttachment = { path: string; url: string; alt: string };
export type ChatEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: ChatAttachment[];
  suggestions?: string[];
  plan?: ChatPlan;
  error?: boolean;
};

type GarfieldValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  entries: ChatEntry[];
  pending: boolean;
  mode: 'ai' | 'basic' | null;
  previewingId: string | null;
  send: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  /** Abre el panel y, si hay texto, lo envía. */
  ask: (text?: string) => void;
  applyPlan: (id: string) => Promise<void>;
  cancelPlan: (id: string) => void;
  previewPlan: (id: string) => void;
  exitPreview: () => void;
  undoPlan: (id: string) => void;
  clear: () => void;
  state: BuilderState;
};

const GarfieldContext = createContext<GarfieldValue | null>(null);

export function useGarfield(): GarfieldValue {
  const value = useContext(GarfieldContext);
  if (!value) throw new Error('useGarfield debe usarse dentro de GarfieldProvider');
  return value;
}

/** Versión opcional (fuera del builder devuelve null). */
export function useOptionalGarfield(): GarfieldValue | null {
  return useContext(GarfieldContext);
}

const MAX_STORED = 40;
const uid = () => Math.random().toString(36).slice(2, 10);
const DESTRUCTIVE = new Set(['delete_page', 'delete_section', 'remove_nav_item', 'delete_category', 'delete_product']);

function toChatPlan(actions: AssistantAction[], plan: ReturnType<typeof planAssistantActions>, status: PlanStatus, allowedMedia: string[], undo?: BuilderState): ChatPlan {
  return {
    actions,
    steps: plan.steps.map(({ label, status: s, risk, error, kind }) => ({ label, status: s, risk, error, kind })),
    needsConfirmation: plan.needsConfirmation,
    destructive: plan.steps.some((s) => s.status === 'ok' && DESTRUCTIVE.has(s.action.action)),
    hasCatalogChanges: plan.hasCatalogChanges,
    allowedMedia,
    status,
    undo,
  };
}

/** Reemplaza los $alias ya creados en el servidor (categorías, productos) por sus ids. */
function withAliases(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value === 'string') return aliases[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => withAliases(v, aliases));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withAliases(v, aliases)]));
  return value;
}

/** Lo que el modelo necesita saber de un turno anterior de Garfield. */
function historyText(entry: ChatEntry): string {
  const attached = entry.attachments?.map((a) => `\n[Imagen adjunta: ${a.path} — ${a.alt || 'sin descripción'}]`).join('') ?? '';
  if (entry.role === 'user' || !entry.plan) return entry.text + attached;
  const done = entry.plan.steps.filter((s) => s.status === 'ok').map((s) => s.label);
  const state = { proposed: 'propuestas (sin aplicar)', applied: 'aplicadas', cancelled: 'canceladas por el usuario', undone: 'deshechas', failed: 'fallidas', expired: 'vencidas' }[entry.plan.status];
  return `${entry.text}\n[Acciones ${state}: ${done.join('; ') || 'ninguna'}]`;
}

type Props = {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  site: SiteViewModel;
  onPreview: (state: BuilderState | null) => void;
  /** Endpoint del asistente (configurable para pruebas). */
  endpoint?: string;
  children: ReactNode;
};

export function GarfieldProvider({ state, dispatch, site, onPreview, endpoint = '/api/assistant', children }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'ai' | 'basic' | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [lastSectionIds, setLastSectionIds] = useState<string[]>([]);
  const stateRef = useRef(state);
  const router = useRouter();
  const storageKey = `garfield:${site.business.slug}`;
  // Para resolver "la categoría Bebidas" o "el Café americano" sin ids.
  const names = useMemo<Pick<ExecutorEnv, 'categories' | 'items'>>(
    () => ({ categories: site.categories.map((c) => ({ id: c.id, name: c.name })), items: site.items.map((i) => ({ id: i.id, name: i.name })) }),
    [site.categories, site.items],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Historial en el navegador (por negocio). Las propuestas viejas vencen: el sitio pudo cambiar.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as ChatEntry[];
        if (Array.isArray(stored)) setEntries(stored.map((e) => (e.plan ? { ...e, plan: { ...e.plan, allowedMedia: e.plan.allowedMedia ?? [], status: e.plan.status === 'proposed' ? ('expired' as const) : e.plan.status } } : e)));
      } catch {}
    });
    return () => clearTimeout(timer);
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries.slice(-MAX_STORED).map((e) => (e.plan ? { ...e, plan: { ...e.plan, undo: undefined } } : e))));
    } catch {}
  }, [entries, storageKey]);

  const update = useCallback((id: string, fn: (entry: ChatEntry) => ChatEntry) => setEntries((list) => list.map((e) => (e.id === id ? fn(e) : e))), []);

  const exitPreview = useCallback(() => {
    setPreviewingId(null);
    onPreview(null);
  }, [onPreview]);

  const commit = useCallback(
    (actions: AssistantAction[], allowedMedia: string[]) => {
      const before = stateRef.current;
      const plan = planAssistantActions(before, actions, { lastSectionIds, allowedMedia, ...names });
      if (plan.changed) {
        dispatch({ type: 'reset', state: plan.next });
        stateRef.current = plan.next;
      } else if (plan.focus) {
        dispatch({ type: 'selectPage', pageId: plan.focus.pageId });
        if (plan.focus.sectionId) dispatch({ type: 'selectSection', sectionId: plan.focus.sectionId });
      }
      if (plan.touchedSectionIds.length) setLastSectionIds(plan.touchedSectionIds);
      return { plan, before };
    },
    [dispatch, lastSectionIds, names],
  );

  const send = useCallback(
    async (raw: string, attachments: ChatAttachment[] = []) => {
      const text = raw.trim() || (attachments.length ? 'Usa esta imagen.' : '');
      if (!text || pending) return;
      exitPreview();
      const user: ChatEntry = { id: uid(), role: 'user', text, ...(attachments.length ? { attachments } : {}) };
      const history = [...entries.filter((e) => !e.error), user].slice(-12).map((e) => ({ role: e.role, content: historyText(e).slice(0, 4000) }));
      setEntries((list) => [...list, user]);
      setPending(true);
      const current = stateRef.current;
      const context = buildAssistantContext({
        site,
        pages: current.pages,
        theme: current.theme,
        navigation: current.navigation,
        panel: current.panel,
        currentPageId: current.selectedPageId,
        selectedSectionId: current.selectedSectionId,
        lastSectionIds,
      });
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, context }) });
        const data = (await response.json().catch(() => null)) as { message?: string; actions?: AssistantAction[]; suggestions?: string[]; mode?: 'ai' | 'basic'; warnings?: string[]; allowedMedia?: string[]; error?: string } | null;
        if (!response.ok || !data) throw new Error(data?.error ?? 'Garfield no pudo responder. Intenta de nuevo.');
        setMode(data.mode ?? null);
        const actions = data.actions ?? [];
        const allowedMedia = [...(data.allowedMedia ?? []), ...attachments.map((a) => a.path)];
        const reply: ChatEntry = { id: uid(), role: 'assistant', text: data.message ?? 'Listo.', suggestions: data.suggestions ?? [] };
        if (actions.length) {
          // Plan sobre el estado ACTUAL: simple y seguro → se aplica; si no, se propone.
          const preview = planAssistantActions(stateRef.current, actions, { lastSectionIds, allowedMedia, ...names });
          const anyOk = preview.steps.some((s) => s.status === 'ok');
          if (!anyOk) reply.plan = toChatPlan(actions, preview, 'failed', allowedMedia);
          else if (preview.autoApply) {
            const { plan, before } = commit(actions, allowedMedia);
            reply.plan = toChatPlan(actions, plan, 'applied', allowedMedia, before);
          } else if (!preview.changed) {
            commit(actions, allowedMedia); // sólo "focus": abrir algo en el editor
            reply.plan = toChatPlan(actions, preview, 'applied', allowedMedia);
          } else reply.plan = toChatPlan(actions, preview, 'proposed', allowedMedia);
        }
        setEntries((list) => [...list, reply]);
      } catch (error) {
        setEntries((list) => [...list, { id: uid(), role: 'assistant', text: (error as Error).message, error: true }]);
      } finally {
        setPending(false);
      }
    },
    [commit, endpoint, entries, exitPreview, lastSectionIds, names, pending, site],
  );

  const applyPlan = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry?.plan) return;
      exitPreview();
      const { allowedMedia } = entry.plan;
      let actions = entry.plan.actions;
      let serverSteps: ChatPlan['steps'] = [];
      // 1) Productos y categorías en el servidor (validación, permisos, límites del plan).
      const catalog = actions.filter(isCatalogAction);
      if (catalog.length) {
        setPending(true);
        const result = await applyCatalogActions(catalog).catch(() => null);
        setPending(false);
        if (!result || !result.ok) {
          update(id, (e) => (e.plan ? { ...e, plan: { ...e.plan, status: 'failed', steps: [...e.plan.steps, { label: 'Guardar productos y categorías', status: 'error', risk: 'safe', kind: 'catalog', error: result && !result.ok ? result.error : 'No se pudo conectar.' }] } } : e));
          return;
        }
        serverSteps = result.data.results.map((r) => ({ label: r.label, status: r.ok ? 'ok' : 'error', risk: 'safe', kind: 'catalog', error: r.error }));
        actions = withAliases(actions.filter((a) => !isCatalogAction(a)), result.data.aliases) as AssistantAction[];
        router.refresh(); // el editor recibe los productos/categorías nuevos
      }
      // 2) Cambios del editor sobre el borrador (vista previa, deshacer).
      const { plan, before } = commit(actions, allowedMedia);
      const editorSteps = toChatPlan(actions, plan, 'applied', allowedMedia).steps;
      const steps = [...serverSteps, ...editorSteps];
      const anyOk = steps.some((s) => s.status === 'ok');
      update(id, (e) => ({ ...e, plan: { ...toChatPlan(actions, plan, anyOk ? 'applied' : 'failed', allowedMedia, plan.changed ? before : undefined), steps, hasCatalogChanges: catalog.length > 0 } }));
    },
    [commit, entries, exitPreview, router, update],
  );

  const previewPlan = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry?.plan) return;
      const plan = planAssistantActions(stateRef.current, entry.plan.actions, { lastSectionIds, allowedMedia: entry.plan.allowedMedia, ...names });
      setPreviewingId(id);
      onPreview(plan.next);
    },
    [entries, lastSectionIds, names, onPreview],
  );

  const cancelPlan = useCallback(
    (id: string) => {
      if (previewingId === id) exitPreview();
      update(id, (e) => (e.plan ? { ...e, plan: { ...e.plan, status: 'cancelled' } } : e));
    },
    [exitPreview, previewingId, update],
  );

  const undoPlan = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry?.plan?.undo) return;
      dispatch({ type: 'reset', state: entry.plan.undo });
      update(id, (e) => (e.plan ? { ...e, plan: { ...e.plan, status: 'undone', undo: undefined } } : e));
    },
    [dispatch, entries, update],
  );

  const ask = useCallback(
    (text?: string) => {
      setOpen(true);
      if (text) void send(text);
    },
    [send],
  );

  const clear = useCallback(() => {
    exitPreview();
    setEntries([]);
    setLastSectionIds([]);
  }, [exitPreview]);

  const value = useMemo<GarfieldValue>(
    () => ({ open, setOpen, entries, pending, mode, previewingId, send, ask, applyPlan, cancelPlan, previewPlan, exitPreview, undoPlan, clear, state }),
    [open, entries, pending, mode, previewingId, send, ask, applyPlan, cancelPlan, previewPlan, exitPreview, undoPlan, clear, state],
  );
  return <GarfieldContext.Provider value={value}>{children}</GarfieldContext.Provider>;
}
