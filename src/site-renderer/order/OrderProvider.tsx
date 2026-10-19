'use client';

import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type Ref, type SyntheticEvent } from 'react';
import { Icon } from '../Icon';
import { SiteImage } from '../SiteImage';
import { useSiteT } from '../SiteI18n';
import styles from '../site.module.css';
import type { OrderConfig } from './config';
import { buildOrderMessage, clampQty, formatAmount, MAX_ORDER_LINES, orderTotal, orderWhatsappHref, type OrderItem, type OrderLine } from './message';

/* ------------------------------------------------------------------ Estado */

/** Pedido guardado en el navegador del visitante (localStorage), uno por negocio. */
type OrderState = { lines: OrderLine[]; name: string; note: string };

const EMPTY: OrderState = { lines: [], name: '', note: '' };
const cache = new Map<string, OrderState>();
const listeners = new Map<string, Set<() => void>>();

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const numOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Lo guardado puede venir de otra versión o estar alterado: se valida campo por campo. */
function sanitize(raw: unknown): OrderState {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const input = raw as Record<string, unknown>;
  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .flatMap((value): OrderLine[] => {
      if (!value || typeof value !== 'object') return [];
      const line = value as Record<string, unknown>;
      const id = str(line.id, 64);
      const name = str(line.name, 200);
      const qty = clampQty(Number(line.qty));
      if (!id || !name || qty < 1) return [];
      return [{ id, name, qty, sku: str(line.sku, 64) || null, price: numOrNull(line.price), priceLabel: str(line.priceLabel, 60) || null, currency: str(line.currency, 3), url: str(line.url, 500), image: str(line.image, 500) || null }];
    })
    .slice(0, MAX_ORDER_LINES);
  return { lines, name: str(input.name, 80), note: str(input.note, 500) };
}

function read(key: string): OrderState {
  const cached = cache.get(key);
  if (cached) return cached;
  let state = EMPTY;
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = sanitize(JSON.parse(raw));
  } catch {}
  cache.set(key, state);
  return state;
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function write(key: string, state: OrderState) {
  cache.set(key, state);
  try {
    if (state.lines.length || state.name || state.note) localStorage.setItem(key, JSON.stringify(state));
    else localStorage.removeItem(key);
  } catch {}
  notify(key);
}

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  // Otra pestaña del mismo sitio cambió el pedido.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    cache.delete(key);
    notify(key);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    set.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/* ------------------------------------------------------------------ Contexto */

type OrderApi = {
  config: OrderConfig;
  state: OrderState;
  qtyOf: (id: string) => number;
  add: (item: OrderItem) => void;
  setQty: (id: string, qty: number) => void;
  update: (patch: Partial<Pick<OrderState, 'name' | 'note'>>) => void;
  clear: () => void;
  open: () => void;
};

const OrderContext = createContext<OrderApi | null>(null);

/** Pedido por WhatsApp del sitio: estado, botón flotante y panel del pedido. */
export function OrderProvider({ config, children }: { config: OrderConfig; children: ReactNode }) {
  const t = useSiteT();
  const key = config.storageKey;
  const state = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    () => read(key),
    () => EMPTY,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const api = useMemo<OrderApi>(() => {
    const current = () => read(key);
    return {
      config,
      state,
      qtyOf: (id) => state.lines.find((line) => line.id === id)?.qty ?? 0,
      add: (item) => {
        const { lines, ...rest } = current();
        const existing = lines.find((line) => line.id === item.id);
        if (!existing && lines.length >= MAX_ORDER_LINES) {
          setAnnouncement(t('El pedido llegó al máximo de {count} productos.', { count: MAX_ORDER_LINES }));
          return;
        }
        const next = existing
          ? lines.map((line) => (line.id === item.id ? { ...line, ...item, qty: clampQty(line.qty + 1) } : line))
          : [...lines, { ...item, qty: 1 }];
        write(key, { ...rest, lines: next });
        setAnnouncement(t('Agregado al pedido: {name}', { name: item.name }));
      },
      setQty: (id, qty) => {
        const { lines, ...rest } = current();
        const value = clampQty(qty);
        write(key, { ...rest, lines: value ? lines.map((line) => (line.id === id ? { ...line, qty: value } : line)) : lines.filter((line) => line.id !== id) });
      },
      update: (patch) => write(key, { ...current(), ...patch }),
      clear: () => write(key, EMPTY),
      open: () => dialogRef.current?.showModal(),
    };
  }, [config, key, state, t]);

  return (
    <OrderContext.Provider value={api}>
      {children}
      <OrderDock />
      <OrderDialog ref={dialogRef} />
      <p className={styles.visuallyHidden} role="status" aria-live="polite">
        {announcement}
      </p>
    </OrderContext.Provider>
  );
}

const useOrder = () => useContext(OrderContext);

/* --------------------------------------------------------- Botón de producto */

type AddProps = {
  item: OrderItem;
  /** Clases del botón (las mismas de ContactActions) y su variante. */
  className: string;
  variant: string;
  hover: string;
  label: string;
  shortLabel?: string;
  iconOnly?: boolean;
  small?: boolean;
  block?: boolean;
};

/**
 * "Agregar al pedido". Si el producto ya está en el pedido se convierte en
 * un selector de cantidad (− 2 +). Sin pedido activo (p. ej. la vista previa
 * de la tarjeta en el panel) se dibuja sólo el botón.
 */
export function AddToOrder({ item, className, variant, hover, label, shortLabel, iconOnly, small, block }: AddProps) {
  const t = useSiteT();
  const order = useOrder();
  const qty = order?.qtyOf(item.id) ?? 0;
  const iconSize = small ? 15 : 17;

  if (order && qty > 0) {
    return (
      <div className={styles.qtyStepper} data-small={small || undefined} data-block={block || undefined} role="group" aria-label={t('Cantidad de {name}', { name: item.name })}>
        <button type="button" onClick={() => order.setQty(item.id, qty - 1)} aria-label={qty === 1 ? t('Quitar del pedido') : t('Uno menos')}>
          {qty === 1 ? <Trash2 size={iconSize} aria-hidden /> : <Minus size={iconSize} aria-hidden />}
        </button>
        <button type="button" className={styles.qtyValue} onClick={order.open} aria-label={t('{count} en el pedido. Ver pedido', { count: qty })}>
          {qty}
        </button>
        <button type="button" onClick={() => order.add(item)} aria-label={t('Uno más')}>
          <Plus size={iconSize} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      data-variant={variant}
      data-hover={hover}
      onClick={() => order?.add(item)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      <Plus size={iconSize} aria-hidden />
      {!iconOnly &&
        (shortLabel ? (
          <>
            <span className={styles.labelFull}>{label}</span>
            <span className={styles.labelShort}>{shortLabel}</span>
          </>
        ) : (
          label
        ))}
    </button>
  );
}

/* ----------------------------------------------------- Botón flotante y panel */

function OrderDock() {
  const t = useSiteT();
  const order = useOrder();
  if (!order || order.state.lines.length === 0) return null;
  const count = order.state.lines.reduce((sum, line) => sum + line.qty, 0);
  const total = orderTotal(order.state.lines, order.config.pricing);
  return (
    <div className={styles.orderDock}>
      <button type="button" className={styles.orderFab} onClick={order.open} aria-haspopup="dialog">
        <ShoppingBag size={18} aria-hidden />
        <span>{t('Ver pedido')}</span>
        <span className={styles.orderCount}>{count}</span>
        {total && <span className={styles.orderFabTotal}>{formatAmount(total.value, order.config.pricing)}</span>}
      </button>
    </div>
  );
}

function OrderDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  const t = useSiteT();
  const order = useOrder();
  const titleId = useId();
  if (!order) return null;
  const { config, state } = order;
  const total = orderTotal(state.lines, config.pricing);
  const message = buildOrderMessage({ lines: state.lines, pricing: config.pricing, intro: config.intro, businessName: config.businessName, customerName: state.name, note: state.note, siteUrl: config.siteUrl, t });
  const href = state.lines.length ? orderWhatsappHref(config.whatsapp, message) : null;
  const close = (event: SyntheticEvent) => (event.currentTarget.closest('dialog') as HTMLDialogElement | null)?.close();

  return (
    <dialog
      ref={ref}
      className={styles.orderDialog}
      aria-labelledby={titleId}
      // Clic en el fondo (fuera del panel) cierra.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className={styles.orderPanel}>
        <header className={styles.orderHeader}>
          <h2 id={titleId}>{t('Tu pedido')}</h2>
          <button type="button" className={styles.orderIconBtn} onClick={close} aria-label={t('Cerrar')}>
            <X size={18} aria-hidden />
          </button>
        </header>

        {state.lines.length === 0 ? (
          <p className={styles.orderEmpty}>{t('Tu pedido está vacío. Agrega productos desde el catálogo.')}</p>
        ) : (
          <>
            <ul className={styles.orderLines}>
              {state.lines.map((line) => (
                <li key={line.id}>
                  <div className={styles.orderThumb}>{line.image && <SiteImage src={line.image} alt="" sizes="48px" />}</div>
                  <div className={styles.orderLineInfo}>
                    <span className={styles.orderLineName}>{line.name}</span>
                    <span className={styles.orderLinePrice}>
                      {line.price !== null && line.currency === config.pricing.currency
                        ? formatAmount(line.price * line.qty, config.pricing)
                        : line.priceLabel ?? t('Precio por confirmar')}
                    </span>
                  </div>
                  <div className={styles.qtyStepper} data-small role="group" aria-label={t('Cantidad de {name}', { name: line.name })}>
                    <button type="button" onClick={() => order.setQty(line.id, line.qty - 1)} aria-label={line.qty === 1 ? t('Quitar del pedido') : t('Uno menos')}>
                      {line.qty === 1 ? <Trash2 size={15} aria-hidden /> : <Minus size={15} aria-hidden />}
                    </button>
                    <span className={styles.qtyValue} aria-live="polite">{line.qty}</span>
                    <button type="button" onClick={() => order.setQty(line.id, line.qty + 1)} aria-label={t('Uno más')}>
                      <Plus size={15} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {total && (
              <p className={styles.orderTotal}>
                <span>{t('Total')}</span>
                <strong>{formatAmount(total.value, config.pricing)}</strong>
              </p>
            )}
            {total?.partial && <p className={styles.orderHint}>{t('Algunos precios se confirman por WhatsApp.')}</p>}

            <div className={styles.orderFields}>
              {config.askName && (
                <label>
                  <span>{t('Tu nombre (opcional)')}</span>
                  <input type="text" value={state.name} maxLength={80} autoComplete="name" onChange={(event) => order.update({ name: event.target.value })} />
                </label>
              )}
              <label>
                <span>{t('Nota (opcional)')}</span>
                <textarea rows={2} value={state.note} maxLength={500} placeholder={t('Entrega, horario, detalles…')} onChange={(event) => order.update({ note: event.target.value })} />
              </label>
            </div>
          </>
        )}

        <footer className={styles.orderFooter}>
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnBlock}`} data-variant="solid">
              <Icon id="message-circle" size={17} />
              {t('Enviar pedido por WhatsApp')}
            </a>
          )}
          {state.lines.length > 0 && (
            <button type="button" className={styles.orderClear} onClick={order.clear}>
              {t('Vaciar pedido')}
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
