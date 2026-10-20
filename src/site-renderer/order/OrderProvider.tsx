'use client';

import { Clock, Minus, Plus, RotateCcw, ShoppingBag, Ticket, Trash2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type Ref, type SyntheticEvent } from 'react';
import { Icon } from '../Icon';
import { pickupSlots, shortTime, weekdayName, withinHours, type PickupDay } from '@/lib/business/schedule';
import { formatSaleDate } from '@/lib/catalog/sale';
import { opensText, useMinute, useOpenStatus } from '../OpenNow';
import { SiteImage } from '../SiteImage';
import { useSiteT } from '../SiteI18n';
import styles from '../site.module.css';
import type { OrderConfig } from './config';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/catalog/settings';
import {
  buildOrderMessage,
  clampQty,
  effectiveFulfillment,
  findCoupon,
  formatAmount,
  fulfillmentOptions,
  isOrderingPaused,
  MAX_ORDER_LINES,
  orderTotal,
  orderWhatsappHref,
  PAYMENT_LABELS,
  refreshLines,
  summarizeOrder,
  type AppliedCoupon,
  type Fulfillment,
  type OrderItem,
  type OrderLine,
} from './message';

/* ------------------------------------------------------------------ Estado */

/** Pedido guardado en el navegador del visitante (localStorage), uno por negocio. */
type When = { date: string; time: string };
type OrderState = { lines: OrderLine[]; name: string; note: string; fulfillment: Fulfillment | null; address: string; payment: PaymentMethod | null; coupon: string; when: When | null };

const EMPTY: OrderState = { lines: [], name: '', note: '', fulfillment: null, address: '', payment: null, coupon: '', when: null };
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
      const id = str(line.id, 120);
      const name = str(line.name, 200);
      const qty = clampQty(Number(line.qty));
      if (!id || !name || qty < 1) return [];
      const note = str(line.note, 120);
      return [{ id, itemId: str(line.itemId, 64) || null, name, qty, sku: str(line.sku, 64) || null, price: numOrNull(line.price), priceLabel: str(line.priceLabel, 60) || null, currency: str(line.currency, 3), url: str(line.url, 500), image: str(line.image, 500) || null, ...(note ? { note } : {}) }];
    })
    .slice(0, MAX_ORDER_LINES);
  const fulfillment = input.fulfillment === 'pickup' || input.fulfillment === 'delivery' ? input.fulfillment : null;
  const payment = PAYMENT_METHODS.find((method) => method === input.payment) ?? null;
  const rawWhen = input.when as { date?: unknown; time?: unknown } | null | undefined;
  const when =
    rawWhen && typeof rawWhen.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawWhen.date) && typeof rawWhen.time === 'string' && /^\d{2}:\d{2}$/.test(rawWhen.time)
      ? { date: rawWhen.date, time: rawWhen.time }
      : null;
  return { lines, name: str(input.name, 80), note: str(input.note, 500), fulfillment, address: str(input.address, 300), payment, coupon: str(input.coupon, 24), when };
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
    if (state.lines.length || state.name || state.note || state.address) localStorage.setItem(key, JSON.stringify(state));
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

/* ---------------------------------------------------------------- Existencias */

type LineRef = Pick<OrderItem, 'id' | 'itemId'>;
/** Producto de una línea ("producto:opción+extra" → "producto"). */
const productOf = (item: LineRef) => item.itemId ?? item.id.split(/[:+]/)[0];
const unitsOf = (lines: OrderLine[], productId: string) => lines.filter((l) => productOf(l) === productId).reduce((sum, l) => sum + l.qty, 0);

/** ¿Cabe una unidad más de este producto? Cuenta todas sus líneas (opciones, extras). */
function withinStock(stock: Record<string, number>, lines: OrderLine[], item: LineRef) {
  const available = stock[productOf(item)];
  return available === undefined || unitsOf(lines, productOf(item)) < available;
}

/** Máximo para una línea: lo que queda descontando las otras líneas del mismo producto. */
function stockLimit(stock: Record<string, number>, lines: OrderLine[], line: OrderLine) {
  const available = stock[productOf(line)];
  return available === undefined ? Infinity : available - (unitsOf(lines, productOf(line)) - line.qty);
}

/* ------------------------------------------------------ Último pedido enviado */

/** El último pedido enviado desde este navegador, para repetirlo (90 días). */
type LastOrder = { lines: OrderLine[]; at: number };
const LAST_DAYS = 90;
const lastCache = new Map<string, LastOrder | null>();
const lastKey = (key: string) => `${key}:last`;

function readLast(key: string): LastOrder | null {
  if (lastCache.has(key)) return lastCache.get(key)!;
  let last: LastOrder | null = null;
  try {
    const raw = JSON.parse(localStorage.getItem(lastKey(key)) ?? 'null') as { lines?: unknown; at?: unknown } | null;
    const at = typeof raw?.at === 'number' ? raw.at : 0;
    const lines = sanitize({ lines: raw?.lines }).lines;
    if (lines.length && Date.now() - at < LAST_DAYS * 86_400_000) last = { lines, at };
  } catch {}
  lastCache.set(key, last);
  return last;
}

function writeLast(key: string, lines: OrderLine[]) {
  const last = { lines, at: Date.now() };
  lastCache.set(key, last);
  try {
    localStorage.setItem(lastKey(key), JSON.stringify(last));
  } catch {}
  notify(key);
}

/**
 * Avisa al servidor que se envió un pedido (sólo ids y cantidades, para las
 * estadísticas del negocio). sendBeacon no bloquea ni se cancela al abrir
 * WhatsApp; si el navegador no lo tiene, no pasa nada.
 */
function trackOrder(slug: string, lines: OrderLine[]) {
  try {
    const body = JSON.stringify({ slug, items: lines.map((line) => ({ id: line.itemId ?? line.id, qty: line.qty })) });
    navigator.sendBeacon?.('/api/orders', new Blob([body], { type: 'application/json' }));
  } catch {}
}

/* ------------------------------------------------------------------ Contexto */

type OrderApi = {
  config: OrderConfig;
  state: OrderState;
  /** Productos que estaban en el pedido guardado y ya no se pueden pedir. */
  removed: string[];
  /** Último pedido enviado (con precios de hoy), si se puede repetir. */
  last: OrderLine[] | null;
  repeatLast: () => void;
  /** Guarda el pedido actual como "último pedido" (al enviarlo). */
  remember: () => void;
  qtyOf: (id: string) => number;
  /** ¿Se puede sumar una unidad más de este producto? (existencias, contando todas sus líneas). */
  canAddMore: (item: Pick<OrderItem, 'id' | 'itemId'>) => boolean;
  add: (item: OrderItem) => void;
  setQty: (id: string, qty: number) => void;
  /** Nota del cliente para una línea ("sin cebolla"). */
  setNote: (id: string, note: string) => void;
  update: (patch: Partial<Omit<OrderState, 'lines'>>) => void;
  clear: () => void;
  open: () => void;
};

const OrderContext = createContext<OrderApi | null>(null);

/** Pedido por WhatsApp del sitio: estado, botón flotante y panel del pedido. */
export function OrderProvider({ config, children }: { config: OrderConfig; children: ReactNode }) {
  const t = useSiteT();
  const key = config.storageKey;
  const subscribeKey = useCallback((listener: () => void) => subscribe(key, listener), [key]);
  const saved = useSyncExternalStore(subscribeKey, () => read(key), () => EMPTY);
  const savedLast = useSyncExternalStore(subscribeKey, () => readLast(key), () => null);
  // Lo guardado con los precios de hoy; lo que ya no se puede pedir se quita (y se avisa).
  const fresh = useMemo(() => refreshLines(saved.lines, config.catalog), [saved.lines, config.catalog]);
  const state = useMemo(() => (fresh.lines === saved.lines ? saved : { ...saved, lines: fresh.lines }), [fresh.lines, saved]);
  const last = useMemo(() => (savedLast ? refreshLines(savedLast.lines, config.catalog).lines : []), [savedLast, config.catalog]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const api = useMemo<OrderApi>(() => {
    const current = () => {
      const raw = read(key);
      return { ...raw, lines: refreshLines(raw.lines, config.catalog).lines };
    };
    return {
      config,
      state,
      removed: fresh.removed,
      last: last.length ? last : null,
      repeatLast: () => {
        if (!last.length) return;
        write(key, { ...current(), lines: last });
        setAnnouncement(t('Agregamos tu último pedido.'));
        dialogRef.current?.showModal();
      },
      remember: () => writeLast(key, current().lines),
      qtyOf: (id) => state.lines.find((line) => line.id === id)?.qty ?? 0,
      canAddMore: (item) => withinStock(config.stock, state.lines, item),
      add: (item) => {
        const { lines, ...rest } = current();
        if (!withinStock(config.stock, lines, item)) {
          setAnnouncement(t('No hay más existencias de {name}.', { name: item.name }));
          return;
        }
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
        const line = lines.find((l) => l.id === id);
        // Con existencias: como máximo lo que queda (contando las otras líneas del mismo producto).
        const limit = line ? stockLimit(config.stock, lines, line) : Infinity;
        const value = Math.min(clampQty(qty), limit);
        write(key, { ...rest, lines: value ? lines.map((line) => (line.id === id ? { ...line, qty: value } : line)) : lines.filter((line) => line.id !== id) });
      },
      setNote: (id, note) => {
        const { lines, ...rest } = current();
        write(key, { ...rest, lines: lines.map((line) => (line.id === id ? { ...line, note: note.slice(0, 120) } : line)) });
      },
      update: (patch) => write(key, { ...current(), ...patch }),
      clear: () => write(key, EMPTY),
      open: () => dialogRef.current?.showModal(),
    };
  }, [config, fresh.removed, key, last, state, t]);

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

/** Formato de precios del pedido (null fuera de un sitio con pedidos). */
export const useOrderPricing = () => useContext(OrderContext)?.config.pricing ?? null;

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
  const minute = useMinute();
  const qty = order?.qtyOf(item.id) ?? 0;
  const iconSize = small ? 15 : 17;
  const hours = order?.config.orderHours[item.itemId ?? item.id] ?? null;

  // Fuera de su horario (desayunos…) no se agrega; se dice cuándo. Antes de hidratar se muestra normal.
  if (order && hours && minute !== null && !withinHours(hours, order.config.timeZone, new Date(minute * 60_000))) {
    const when = t('Se pide de {from} a {to}', { from: shortTime(hours.from), to: shortTime(hours.to) });
    return (
      <button type="button" className={className} data-variant="outline" data-hover={hover} disabled aria-label={iconOnly ? when : undefined} title={when}>
        {iconOnly ? <Clock size={iconSize} aria-hidden /> : when}
      </button>
    );
  }

  if (order && qty > 0) {
    return (
      <div className={styles.qtyStepper} data-small={small || undefined} data-block={block || undefined} role="group" aria-label={t('Cantidad de {name}', { name: item.name })}>
        <button type="button" onClick={() => order.setQty(item.id, qty - 1)} aria-label={qty === 1 ? t('Quitar del pedido') : t('Uno menos')}>
          {qty === 1 ? <Trash2 size={iconSize} aria-hidden /> : <Minus size={iconSize} aria-hidden />}
        </button>
        <button type="button" className={styles.qtyValue} onClick={order.open} aria-label={t('{count} en el pedido. Ver pedido', { count: qty })}>
          {qty}
        </button>
        <button type="button" onClick={() => order.add(item)} disabled={!order.canAddMore(item)} aria-label={t('Uno más')}>
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
  if (!order) return null;
  if (order.state.lines.length === 0) {
    if (!order.last) return null;
    return (
      <div className={styles.orderDock}>
        <button type="button" className={`${styles.orderFab} ${styles.orderRepeat}`} onClick={order.repeatLast}>
          <RotateCcw size={17} aria-hidden />
          <span>{t('Repetir mi último pedido')}</span>
        </button>
      </div>
    );
  }
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
  // Un mismo pedido abierto dos veces en WhatsApp cuenta una sola vez.
  const tracked = useRef<string | null>(null);
  const status = useOpenStatus(order?.config.schedule ?? null);
  const minute = useMinute();
  if (!order) return null;
  const { config, state } = order;
  const { options, pricing } = config;
  const coupon = findCoupon(config.coupons, config.couponScope, state.coupon);
  // "¿Para cuándo?": horarios disponibles ahora (en el navegador: la página está en caché).
  const pickupDays =
    options.scheduling !== 'off' && minute !== null
      ? pickupSlots(config.schedule, new Date(minute * 60_000), { leadMinutes: options.leadMinutes, days: options.scheduleDays, step: Number(options.slotMinutes) })
      : [];
  const when = state.when && pickupDays.some((d) => d.date === state.when!.date && d.slots.includes(state.when!.time)) ? state.when : null;
  const choices = { fulfillment: state.fulfillment, address: state.address, payment: state.payment, coupon, when };
  const summary = summarizeOrder(state.lines, pricing, options, choices);
  const { subtotal, delivery, total, discount } = summary;
  const modes = fulfillmentOptions(options);
  const fulfillment = effectiveFulfillment(options, state.fulfillment);
  const money = (value: number) => formatAmount(value, pricing);
  const message = buildOrderMessage({ lines: state.lines, pricing, intro: config.intro, businessName: config.businessName, customerName: state.name, note: state.note, siteUrl: config.siteUrl, t, options, choices });
  const now = minute === null ? null : new Date(minute * 60_000);
  const outOfHours = now
    ? state.lines.flatMap((line) => {
        const hours = config.orderHours[line.itemId ?? line.id];
        return hours && !withinHours(hours, config.timeZone, now) ? [{ name: line.name, hours }] : [];
      })
    : [];
  // Antes de hidratar (minute null) se toma la pausa como vigente: el reloj se revisa en el navegador.
  const paused = Boolean(config.pause && (minute === null || isOrderingPaused(config.pause, new Date(minute * 60_000))));
  const href = state.lines.length && !summary.blocker && !paused && outOfHours.length === 0 ? orderWhatsappHref(config.whatsapp, message) : null;
  const pauseText = config.pause
    ? [
        config.pause.until ? t('Pausamos los pedidos hasta el {date}.', { date: formatSaleDate(config.pause.until, pricing.locale) }) : t('Por ahora no estamos recibiendo pedidos.'),
        config.pause.message,
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  const more = config.suggestions.filter((item) => !state.lines.some((line) => line.id === item.id)).slice(0, 3);
  const blockerText = paused
    ? t('Los pedidos están en pausa.')
    : outOfHours.length
      ? t('{name} se pide de {from} a {to}. Quítalo o vuelve en ese horario.', { name: outOfHours[0].name, from: shortTime(outOfHours[0].hours.from), to: shortTime(outOfHours[0].hours.to) })
    : summary.blocker === 'fulfillment'
      ? t('Elige cómo quieres recibir tu pedido.')
      : summary.blocker === 'address'
        ? t('Escribe la dirección de entrega.')
        : summary.blocker === 'minimum' && options.minimumOrder !== null && summary.missingForMinimum !== null
          ? t('El pedido mínimo es de {minimum}: te faltan {amount}.', { minimum: money(options.minimumOrder), amount: money(summary.missingForMinimum) })
          : summary.blocker === 'when'
            ? t('Elige para cuándo quieres tu pedido.')
            : null;
  const deliveryHint =
    options.deliveryFee === 0
      ? t('Envío gratis')
      : [
          options.deliveryFee !== null ? t('Envío {amount}', { amount: money(options.deliveryFee) }) : t('Costo de envío por confirmar'),
          options.freeDeliveryFrom !== null ? t('gratis desde {amount}', { amount: money(options.freeDeliveryFrom) }) : null,
        ]
          .filter(Boolean)
          .join(' · ');
  const onSend = () => {
    order.remember();
    if (!config.trackSlug) return;
    const key = JSON.stringify(state.lines.map((line) => [line.id, line.qty]));
    if (tracked.current === key) return;
    tracked.current = key;
    trackOrder(config.trackSlug, state.lines);
  };
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

        {paused && <p className={styles.orderPaused} role="status">{pauseText}</p>}
        {order.removed.length > 0 && (
          <p className={styles.orderClosed} role="status">
            {t('Ya no están disponibles y se quitaron del pedido: {names}.', { names: order.removed.join(', ') })}
          </p>
        )}
        {state.lines.length === 0 ? (
          <p className={styles.orderEmpty}>{t('Tu pedido está vacío. Agrega productos desde el catálogo.')}</p>
        ) : (
          <>
            {status && !status.open && (
              <p className={styles.orderClosed}>
                {t('{status}. Puedes enviar tu pedido y te respondemos al abrir.', { status: opensText(status, t, pricing.locale) })}
              </p>
            )}
            <ul className={styles.orderLines}>
              {state.lines.map((line) => (
                <li key={line.id}>
                  <div className={styles.orderThumb}>{line.image && <SiteImage src={line.image} alt="" sizes="48px" />}</div>
                  <div className={styles.orderLineInfo}>
                    <span className={styles.orderLineName}>{line.name}</span>
                    <LineNote note={line.note ?? ''} name={line.name} onChange={(note) => order.setNote(line.id, note)} />
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
                    <button type="button" onClick={() => order.setQty(line.id, line.qty + 1)} disabled={!order.canAddMore(line)} aria-label={t('Uno más')}>
                      <Plus size={15} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {more.length > 0 && (
              <section className={styles.orderMore} aria-labelledby={`${titleId}-more`}>
                <h3 id={`${titleId}-more`}>{t('¿Agregas algo más?')}</h3>
                <ul>
                  {more.map((item) => (
                    <li key={item.id}>
                      <div className={styles.orderThumb}>{item.image && <SiteImage src={item.image} alt="" sizes="40px" />}</div>
                      <span className={styles.orderLineName}>{item.name}</span>
                      <span className={styles.orderLinePrice}>{item.priceLabel}</span>
                      <button type="button" className={styles.orderIconBtn} onClick={() => order.add(item)} aria-label={t('Agregar {name}', { name: item.name })}>
                        <Plus size={16} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {subtotal && (delivery || discount) && (
              <dl className={styles.orderBreakdown}>
                <div>
                  <dt>{t('Subtotal')}</dt>
                  <dd>{money(subtotal.value)}</dd>
                </div>
                {discount && (
                  <div>
                    <dt>{t('Cupón {code}', { code: discount.code })}</dt>
                    <dd>−{money(discount.value)}</dd>
                  </div>
                )}
                {delivery && (
                  <div>
                    <dt>{t('Envío')}</dt>
                    <dd>{delivery.kind === 'fee' ? money(delivery.value) : delivery.kind === 'free' ? t('Gratis') : t('Por confirmar')}</dd>
                  </div>
                )}
              </dl>
            )}
            {total && (
              <p className={styles.orderTotal}>
                <span>{t('Total')}</span>
                <strong>{money(total.value)}</strong>
              </p>
            )}
            {subtotal?.partial && <p className={styles.orderHint}>{t('Algunos precios se confirman por WhatsApp.')}</p>}
            {delivery?.kind === 'confirm' && <p className={styles.orderHint}>{t('El costo de envío se confirma por WhatsApp.')}</p>}
            {config.coupons.length > 0 && (
              <CouponField
                applied={coupon}
                issue={
                  coupon && summary.couponIssue === 'expired'
                    ? t('El cupón {code} ya venció.', { code: coupon.code })
                    : coupon && summary.couponIssue === 'minimum' && coupon.minSubtotal !== null
                      ? t('El cupón {code} aplica desde {amount}.', { code: coupon.code, amount: money(coupon.minSubtotal) })
                      : null
                }
                onApply={(code) => {
                  const found = findCoupon(config.coupons, config.couponScope, code);
                  if (found) order.update({ coupon: found.code });
                  return Boolean(found);
                }}
                onRemove={() => order.update({ coupon: '' })}
              />
            )}
            {summary.missingForFreeDelivery !== null && summary.missingForFreeDelivery > 0 && (
              <p className={styles.orderHint}>{t('Te faltan {amount} para el envío gratis.', { amount: money(summary.missingForFreeDelivery) })}</p>
            )}

            <div className={styles.orderFields}>
              {modes.length > 0 && (
                <fieldset className={styles.orderChoices}>
                  <legend>{t('¿Cómo lo recibes?')}</legend>
                  {modes.length === 1 ? (
                    <p className={styles.orderFixed}>{fulfillment === 'delivery' ? t('Envío a domicilio') : t('Recoger en el local')}</p>
                  ) : (
                    <div className={styles.orderOptions}>
                      {modes.map((mode) => (
                        <label key={mode} className={styles.orderOption}>
                          <input type="radio" name="fulfillment" value={mode} checked={state.fulfillment === mode} onChange={() => order.update({ fulfillment: mode })} />
                          <span>{mode === 'delivery' ? t('Envío a domicilio') : t('Recoger en el local')}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {options.delivery && (fulfillment === 'delivery' || modes.length > 1) && (
                    <p className={styles.orderHint}>{[deliveryHint, options.deliveryNote].filter(Boolean).join(' · ')}</p>
                  )}
                </fieldset>
              )}
              {fulfillment === 'delivery' && (
                <label>
                  <span>{t('Dirección de entrega')}</span>
                  <textarea
                    rows={2}
                    value={state.address}
                    maxLength={300}
                    autoComplete="street-address"
                    required
                    placeholder={t('Calle, número, colonia y referencias')}
                    onChange={(event) => order.update({ address: event.target.value })}
                  />
                </label>
              )}
              {options.scheduling !== 'off' && minute !== null && (
                <WhenField
                  days={pickupDays}
                  value={when}
                  stale={Boolean(state.when && !when)}
                  optional={options.scheduling === 'optional'}
                  locale={pricing.locale}
                  onChange={(next) => order.update({ when: next })}
                />
              )}
              {options.payments.length > 0 && (
                <fieldset className={styles.orderChoices}>
                  <legend>{t('Forma de pago')}</legend>
                  <div className={styles.orderOptions}>
                    {options.payments.map((method) => (
                      <label key={method} className={styles.orderOption}>
                        <input
                          type="radio"
                          name="payment"
                          value={method}
                          checked={state.payment === method}
                          onChange={() => order.update({ payment: method })}
                          // Un segundo clic quita la elección (es opcional).
                          onClick={() => state.payment === method && order.update({ payment: null })}
                        />
                        <span>{t(PAYMENT_LABELS[method])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
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
          {state.lines.length > 0 && blockerText && (
            <>
              <p className={styles.orderBlocker} role="status">{blockerText}</p>
              <button type="button" className={`${styles.btn} ${styles.btnBlock}`} data-variant="solid" disabled>
                <Icon id="message-circle" size={17} />
                {t('Enviar pedido por WhatsApp')}
              </button>
            </>
          )}
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnBlock}`} data-variant="solid" onClick={onSend}>
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

/** "¿Tienes un cupón?": campo y botón, o el cupón aplicado con "Quitar". */
function CouponField({ applied, issue, onApply, onRemove }: { applied: AppliedCoupon | null; issue: string | null; onApply: (code: string) => boolean; onRemove: () => void }) {
  const t = useSiteT();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const inputId = useId();

  if (applied) {
    return (
      <div className={styles.orderCoupon}>
        <p className={styles.orderCouponApplied}>
          <Ticket size={16} aria-hidden />
          <span>{t('Cupón {code} aplicado', { code: applied.code })}</span>
          <button type="button" className={styles.orderClear} onClick={onRemove}>
            {t('Quitar')}
          </button>
        </p>
        {issue && <p className={styles.orderHint} role="status">{issue}</p>}
      </div>
    );
  }
  const apply = () => {
    if (!code.trim()) return;
    const ok = onApply(code);
    setError(!ok);
    if (ok) setCode('');
  };
  return (
    <div className={styles.orderCoupon}>
      <label htmlFor={inputId} className={styles.orderCouponLabel}>{t('¿Tienes un cupón?')}</label>
      <div className={styles.orderCouponRow}>
        <input
          id={inputId}
          type="text"
          value={code}
          maxLength={24}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error || undefined}
          onChange={(event) => {
            setCode(event.target.value);
            setError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
          }}
        />
        <button type="button" className={styles.orderCouponBtn} onClick={apply}>
          {t('Aplicar')}
        </button>
      </div>
      {error && <p className={styles.orderCouponError} role="alert">{t('Ese cupón no existe o ya no está activo.')}</p>}
    </div>
  );
}

/** "Agregar nota" bajo cada producto del pedido ("sin cebolla"): se abre al pedirla o si ya tiene una. */
function LineNote({ note, name, onChange }: { note: string; name: string; onChange: (note: string) => void }) {
  const t = useSiteT();
  const [open, setOpen] = useState(false);
  if (!open && !note) {
    return (
      <button type="button" className={styles.orderNoteToggle} onClick={() => setOpen(true)}>
        {t('Agregar nota')}
      </button>
    );
  }
  return (
    <input
      type="text"
      className={styles.orderLineNote}
      value={note}
      maxLength={120}
      autoFocus={open && !note}
      placeholder={t('Ej. sin cebolla')}
      aria-label={t('Nota para {name}', { name })}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** "¿Para cuándo?": día (Hoy, Mañana, jue 23 oct…) y hora disponibles. */
function WhenField({ days, value, stale, optional, locale, onChange }: { days: PickupDay[]; value: When | null; stale: boolean; optional: boolean; locale: string; onChange: (when: When | null) => void }) {
  const t = useSiteT();
  const dayId = useId();
  const timeId = useId();
  const selectedDay = days.find((d) => d.date === value?.date) ?? null;
  const dayLabel = ({ date, day, offset }: PickupDay) => {
    if (offset === 0) return t('Hoy');
    if (offset === 1) return t('Mañana');
    const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
    return `${weekdayName(day, locale)} ${short}`;
  };
  return (
    <fieldset className={styles.orderChoices}>
      <legend>{optional ? t('¿Para cuándo? (opcional)') : t('¿Para cuándo?')}</legend>
      {days.length === 0 ? (
        <p className={styles.orderHint}>{t('No hay horarios disponibles en los próximos días.')}</p>
      ) : (
        <div className={styles.orderWhen}>
          <label htmlFor={dayId}>
            <span>{t('Día')}</span>
            <select
              id={dayId}
              value={value?.date ?? ''}
              onChange={(event) => {
                const day = days.find((d) => d.date === event.target.value);
                onChange(day ? { date: day.date, time: day.slots[0] } : null);
              }}
            >
              <option value="">{optional ? t('Lo antes posible') : t('Elige un día')}</option>
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={timeId}>
            <span>{t('Hora')}</span>
            <select id={timeId} value={value?.time ?? ''} disabled={!selectedDay} onChange={(event) => selectedDay && onChange({ date: selectedDay.date, time: event.target.value })}>
              {!selectedDay && <option value="">—</option>}
              {selectedDay?.slots.map((slot) => (
                <option key={slot} value={slot}>
                  {shortTime(slot)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {stale && <p className={styles.orderHint} role="status">{t('El horario que elegiste ya pasó: elige otro.')}</p>}
    </fieldset>
  );
}
