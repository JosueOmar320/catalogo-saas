'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isCatalogAction, type AssistantAction } from '@/lib/assistant/actions';
import { buildAssistantContext, type AssistantContext, type AssistantMode } from '@/lib/assistant/context';
import type { AnyAction } from '@/lib/assistant/modes';
import type { SiteViewModel } from '@/lib/site/view-model';
import type { BuilderAction, BuilderState } from '../../builder/reducer';
import { applyCatalogActions } from '../catalog-actions';
import { planAssistantActions, type ExecutorEnv, type PlanStep } from '../executor';
import { contextSuggestions, type SuggestionSet } from '../suggestions';

/**
 * Conversación con Garfield, independiente del editor: el MISMO motor
 * (enviar → acciones → plan → vista previa / aplicar / deshacer) sirve para
 * el editor del sitio y para el estudio de PDF. Cada editor aporta un
 * adaptador: cómo armar el contexto, cómo planificar sus acciones (ejecutor
 * puro) y cómo escribir el resultado en su borrador.
 */

export type PlanStatus = 'proposed' | 'applied' | 'cancelled' | 'undone' | 'failed' | 'expired';
export type StepView = Pick<PlanStep, 'label' | 'status' | 'risk' | 'error'> & { kind: 'editor' | 'catalog' | 'pdf' };
export type ChatPlan = {
  actions: AnyAction[];
  steps: StepView[];
  needsConfirmation: boolean;
  destructive: boolean;
  /** Incluye productos/categorías/logo: se guardan en la base al aplicar. */
  hasCatalogChanges: boolean;
  /** Imágenes de la biblioteca validadas por el servidor para esta respuesta. */
  allowedMedia: string[];
  status: PlanStatus;
  /** Estado anterior, para "Deshacer" (no se persiste). */
  undo?: unknown;
};
export type ChatAttachment = { path: string; url: string; alt: string };
export type ChatEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: ChatAttachment[];
  suggestions?: string[];
  plan?: ChatPlan;
  /** Resuelto sin IA (intérprete local). */
  local?: boolean;
  error?: boolean;
};

type GarfieldValue = {
  /** Editor en el que está Garfield. */
  editor: AssistantMode;
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
  suggestions: SuggestionSet;
};

const GarfieldContext = createContext<GarfieldValue | null>(null);

export function useGarfield(): GarfieldValue {
  const value = useContext(GarfieldContext);
  if (!value) throw new Error('useGarfield debe usarse dentro de GarfieldProvider');
  return value;
}

/** Versión opcional (fuera de un editor devuelve null). */
export function useOptionalGarfield(): GarfieldValue | null {
  return useContext(GarfieldContext);
}

/* ------------------------------------------------------------ Motor genérico */

/** Plan de un adaptador, ya listo para mostrar. */
export type EnginePlan = {
  next: unknown;
  steps: StepView[];
  changed: boolean;
  autoApply: boolean;
  needsConfirmation: boolean;
  destructive: boolean;
  hasServerChanges: boolean;
  touched: string[];
};

export type GarfieldAdapter = {
  editor: AssistantMode;
  storageKey: string;
  context: (touched: string[]) => AssistantContext;
  plan: (actions: AnyAction[], allowedMedia: string[], touched: string[]) => EnginePlan;
  /** Estado actual (para deshacer). */
  snapshot: () => unknown;
  /** Escribe el resultado del plan en el borrador (o sólo enfoca algo). */
  commit: (plan: EnginePlan) => void;
  restore: (snapshot: unknown) => void;
  preview: (next: unknown | null) => void;
  suggestions: SuggestionSet;
  /** Acciones que se guardan en el servidor antes de aplicar el resto (productos, logo…). */
  applyOnServer?: (actions: AnyAction[]) => Promise<{ ok: true; steps: StepView[]; rest: AnyAction[] } | { ok: false; error: string } | null>;
  endpoint?: string;
};

const MAX_STORED = 40;
const uid = () => Math.random().toString(36).slice(2, 10);

function toChatPlan(actions: AnyAction[], plan: EnginePlan, status: PlanStatus, allowedMedia: string[], undo?: unknown): ChatPlan {
  return { actions, steps: plan.steps, needsConfirmation: plan.needsConfirmation, destructive: plan.destructive, hasCatalogChanges: plan.hasServerChanges, allowedMedia, status, undo };
}

/** Lo que el modelo necesita saber de un turno anterior de Garfield. */
function historyText(entry: ChatEntry): string {
  const attached = entry.attachments?.map((a) => `\n[Imagen adjunta: ${a.path} — ${a.alt || 'sin descripción'}]`).join('') ?? '';
  if (entry.role === 'user' || !entry.plan) return entry.text + attached;
  const done = entry.plan.steps.filter((s) => s.status === 'ok').map((s) => s.label);
  const state = { proposed: 'propuestas (sin aplicar)', applied: 'aplicadas', cancelled: 'canceladas por el usuario', undone: 'deshechas', failed: 'fallidas', expired: 'vencidas' }[entry.plan.status];
  return `${entry.text}\n[Acciones ${state}: ${done.join('; ') || 'ninguna'}]`;
}

export function GarfieldEngine({ adapter, children }: { adapter: GarfieldAdapter; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'ai' | 'basic' | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [touched, setTouched] = useState<string[]>([]);
  const adapterRef = useRef(adapter);
  const { storageKey, endpoint = '/api/assistant' } = adapter;

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  // Historial en el navegador (por negocio y editor). Las propuestas viejas vencen: el contenido pudo cambiar.
  // `loadedKey` evita guardar antes de haber leído: si no, el guardado inicial (lista vacía)
  // pisaba el historial antes de cargarlo, y al cambiar de negocio se copiaba el chat anterior.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    loadedKey.current = null;
    const timer = setTimeout(() => {
      let restored: ChatEntry[] = [];
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as ChatEntry[];
        if (Array.isArray(stored)) restored = stored.map((e) => (e.plan ? { ...e, plan: { ...e.plan, allowedMedia: e.plan.allowedMedia ?? [], status: e.plan.status === 'proposed' ? ('expired' as const) : e.plan.status } } : e));
      } catch {}
      loadedKey.current = storageKey;
      setEntries(restored);
    });
    return () => clearTimeout(timer);
  }, [storageKey]);
  useEffect(() => {
    if (loadedKey.current !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries.slice(-MAX_STORED).map((e) => (e.plan ? { ...e, plan: { ...e.plan, undo: undefined } } : e))));
    } catch {}
  }, [entries, storageKey]);

  const update = useCallback((id: string, fn: (entry: ChatEntry) => ChatEntry) => setEntries((list) => list.map((e) => (e.id === id ? fn(e) : e))), []);

  const exitPreview = useCallback(() => {
    setPreviewingId(null);
    adapterRef.current.preview(null);
  }, []);

  const commit = useCallback(
    (actions: AnyAction[], allowedMedia: string[]) => {
      const a = adapterRef.current;
      const before = a.snapshot();
      const plan = a.plan(actions, allowedMedia, touched);
      a.commit(plan);
      if (plan.touched.length) setTouched(plan.touched);
      return { plan, before };
    },
    [touched],
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
      try {
        const context = adapterRef.current.context(touched);
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, context }) });
        const data = (await response.json().catch(() => null)) as { message?: string; actions?: AnyAction[]; suggestions?: string[]; mode?: 'ai' | 'basic'; routed?: 'local' | 'llm'; allowedMedia?: string[]; error?: string } | null;
        if (!response.ok || !data) throw new Error(data?.error ?? 'Garfield no pudo responder. Intenta de nuevo.');
        setMode(data.mode ?? null);
        const actions = data.actions ?? [];
        const allowedMedia = [...(data.allowedMedia ?? []), ...attachments.map((a) => a.path)];
        const reply: ChatEntry = { id: uid(), role: 'assistant', text: data.message ?? 'Listo.', suggestions: data.suggestions ?? [], local: data.routed === 'local' };
        if (actions.length) {
          // Plan sobre el estado ACTUAL: simple y seguro → se aplica; si no, se propone.
          const preview = adapterRef.current.plan(actions, allowedMedia, touched);
          const anyOk = preview.steps.some((s) => s.status === 'ok');
          if (!anyOk) reply.plan = toChatPlan(actions, preview, 'failed', allowedMedia);
          else if (preview.autoApply) {
            const { plan, before } = commit(actions, allowedMedia);
            reply.plan = toChatPlan(actions, plan, 'applied', allowedMedia, before);
          } else if (!preview.changed && !preview.hasServerChanges) {
            commit(actions, allowedMedia); // sólo enfocar algo en el editor
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
    [commit, endpoint, entries, exitPreview, pending, touched],
  );

  // Planes que se están aplicando: un doble clic llega antes de que cambie el estado
  // (y aplicar dos veces crearía productos duplicados).
  const applying = useRef(new Set<string>());
  const applyPlan = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry?.plan || entry.plan.status !== 'proposed' || applying.current.has(id)) return;
      applying.current.add(id);
      try {
        exitPreview();
        const { allowedMedia } = entry.plan;
        let actions = entry.plan.actions;
        let serverSteps: StepView[] = [];
        // 1) Lo que se guarda en el servidor (productos, categorías, logo): validación, permisos, límites.
        const server = adapterRef.current.applyOnServer;
        if (server && entry.plan.hasCatalogChanges) {
          setPending(true);
          const result = await server(actions).catch(() => null);
          setPending(false);
          if (!result || !result.ok) {
            update(id, (e) => (e.plan ? { ...e, plan: { ...e.plan, status: 'failed', steps: [...e.plan.steps, { label: 'Guardar en el catálogo', status: 'error', risk: 'safe', kind: 'catalog', error: result && !result.ok ? result.error : 'No se pudo conectar.' }] } } : e));
            return;
          }
          serverSteps = result.steps;
          actions = result.rest;
        }
        // 2) Cambios del borrador (vista previa, deshacer).
        const { plan, before } = commit(actions, allowedMedia);
        const steps = [...serverSteps, ...plan.steps];
        const anyOk = steps.some((s) => s.status === 'ok');
        update(id, (e) => ({ ...e, plan: { ...toChatPlan(entry.plan!.actions, plan, anyOk ? 'applied' : 'failed', allowedMedia, plan.changed ? before : undefined), steps, hasCatalogChanges: serverSteps.length > 0 } }));
      } finally {
        applying.current.delete(id);
      }
    },
    [commit, entries, exitPreview, update],
  );

  const previewPlan = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry?.plan) return;
      const plan = adapterRef.current.plan(entry.plan.actions, entry.plan.allowedMedia, touched);
      setPreviewingId(id);
      adapterRef.current.preview(plan.next);
    },
    [entries, touched],
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
      if (entry?.plan?.undo === undefined) return;
      adapterRef.current.restore(entry.plan.undo);
      update(id, (e) => (e.plan ? { ...e, plan: { ...e.plan, status: 'undone', undo: undefined } } : e));
    },
    [entries, update],
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
    setTouched([]);
  }, [exitPreview]);

  const value = useMemo<GarfieldValue>(
    () => ({ editor: adapter.editor, open, setOpen, entries, pending, mode, previewingId, send, ask, applyPlan, cancelPlan, previewPlan, exitPreview, undoPlan, clear, suggestions: adapter.suggestions }),
    [adapter.editor, adapter.suggestions, open, entries, pending, mode, previewingId, send, ask, applyPlan, cancelPlan, previewPlan, exitPreview, undoPlan, clear],
  );
  return <GarfieldContext.Provider value={value}>{children}</GarfieldContext.Provider>;
}

/* ------------------------------------------------------------ Adaptador: editor del sitio */

const SITE_DESTRUCTIVE = new Set(['delete_page', 'delete_section', 'remove_nav_item', 'delete_category', 'delete_product']);

/** Reemplaza los $alias ya creados en el servidor (categorías, productos) por sus ids. */
function withAliases(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value === 'string') return aliases[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => withAliases(v, aliases));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withAliases(v, aliases)]));
  return value;
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

/** Garfield en el editor del sitio. */
export function GarfieldProvider({ state, dispatch, site, onPreview, endpoint, children }: Props) {
  const router = useRouter();
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Para resolver "la categoría Bebidas" o "el Café americano" sin ids.
  const names = useMemo<Pick<ExecutorEnv, 'categories' | 'items'>>(
    () => ({ categories: site.categories.map((c) => ({ id: c.id, name: c.name })), items: site.items.map((i) => ({ id: i.id, name: i.name })) }),
    [site.categories, site.items],
  );
  const suggestions = useMemo(() => contextSuggestions(state), [state]);

  const adapter = useMemo<GarfieldAdapter>(
    () => ({
      editor: 'site',
      storageKey: `garfield:${site.business.slug}`,
      endpoint,
      suggestions,
      context: (touched) => {
        const current = stateRef.current;
        return buildAssistantContext({ site, pages: current.pages, theme: current.theme, navigation: current.navigation, panel: current.panel, currentPageId: current.selectedPageId, selectedSectionId: current.selectedSectionId, lastSectionIds: touched, mode: 'site' });
      },
      plan: (actions, allowedMedia, touched) => {
        const plan = planAssistantActions(stateRef.current, actions as AssistantAction[], { lastSectionIds: touched, allowedMedia, ...names });
        return {
          next: plan.next,
          steps: plan.steps.map(({ label, status, risk, error, kind }) => ({ label, status, risk, error, kind })),
          changed: plan.changed,
          autoApply: plan.autoApply,
          needsConfirmation: plan.needsConfirmation,
          destructive: plan.steps.some((s) => s.status === 'ok' && SITE_DESTRUCTIVE.has(s.action.action)),
          hasServerChanges: plan.hasCatalogChanges,
          touched: plan.touchedSectionIds,
          focus: plan.focus,
        } as EnginePlan & { focus: typeof plan.focus };
      },
      snapshot: () => stateRef.current,
      commit: (plan) => {
        const next = plan.next as BuilderState;
        if (plan.changed) {
          dispatch({ type: 'reset', state: next });
          stateRef.current = next;
        } else {
          const focus = (plan as EnginePlan & { focus?: { pageId: string; sectionId: string | null } }).focus;
          if (focus) {
            dispatch({ type: 'selectPage', pageId: focus.pageId });
            if (focus.sectionId) dispatch({ type: 'selectSection', sectionId: focus.sectionId });
          }
        }
      },
      restore: (snapshot) => dispatch({ type: 'reset', state: snapshot as BuilderState }),
      preview: (next) => onPreview(next as BuilderState | null),
      applyOnServer: async (all) => {
        const catalog = (all as AssistantAction[]).filter(isCatalogAction);
        if (!catalog.length) return { ok: true, steps: [], rest: all };
        const result = await applyCatalogActions(catalog);
        if (!result.ok) return { ok: false, error: result.error };
        router.refresh(); // el editor recibe los productos/categorías/logo nuevos
        return {
          ok: true,
          steps: result.data.results.map((r) => ({ label: r.label, status: r.ok ? 'ok' : 'error', risk: 'safe', kind: 'catalog', error: r.error })),
          rest: withAliases((all as AssistantAction[]).filter((a) => !isCatalogAction(a)), result.data.aliases) as AnyAction[],
        };
      },
    }),
    [dispatch, endpoint, names, onPreview, router, site, suggestions],
  );

  return <GarfieldEngine adapter={adapter}>{children}</GarfieldEngine>;
}
