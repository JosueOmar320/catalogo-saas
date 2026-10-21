import { msg } from '@/i18n/translate';

/**
 * Efectos para el código propio (sección HTML y widget): clases `fx-…` y
 * atributos `data-fx` que el negocio puede usar sin escribir JavaScript.
 * Todo respeta "reducir movimiento" del visitante. Lo usan el servidor, el
 * navegador y el documento del widget.
 */

/** Clases y atributos disponibles (para la ayuda del editor). */
export const FX_CATALOG = [
  { name: 'fx-fade-up', kind: 'entrance', description: msg('Aparece subiendo al llegar a la vista.') },
  { name: 'fx-fade-in', kind: 'entrance', description: msg('Aparece con un fundido.') },
  { name: 'fx-zoom-in', kind: 'entrance', description: msg('Aparece acercándose.') },
  { name: 'fx-blur-in', kind: 'entrance', description: msg('Aparece desenfocado y se aclara.') },
  { name: 'fx-slide-left', kind: 'entrance', description: msg('Entra desde la izquierda.') },
  { name: 'fx-slide-right', kind: 'entrance', description: msg('Entra desde la derecha.') },
  { name: 'fx-delay-1 / 2 / 3', kind: 'entrance', description: msg('Retrasa la entrada (para escalonar tarjetas).') },
  { name: 'fx-float', kind: 'loop', description: msg('Flota suavemente.') },
  { name: 'fx-pulse', kind: 'loop', description: msg('Late suavemente.') },
  { name: 'fx-bounce', kind: 'loop', description: msg('Rebota.') },
  { name: 'fx-glow', kind: 'loop', description: msg('Brillo que respira (color de acento).') },
  { name: 'fx-shimmer', kind: 'loop', description: msg('Un destello cruza el elemento.') },
  { name: 'fx-spin-slow', kind: 'loop', description: msg('Gira lento (íconos, insignias).') },
  { name: 'fx-gradient-text', kind: 'loop', description: msg('Texto con degradado de los colores del sitio en movimiento.') },
  { name: 'fx-gradient-bg', kind: 'loop', description: msg('Fondo con degradado en movimiento.') },
  { name: 'fx-hover-lift', kind: 'hover', description: msg('Se eleva con sombra al pasar el mouse.') },
  { name: 'fx-hover-grow', kind: 'hover', description: msg('Crece un poco al pasar el mouse.') },
  { name: 'fx-hover-glow', kind: 'hover', description: msg('Se ilumina con el color de acento al pasar el mouse.') },
  { name: 'data-fx="tilt"', kind: 'interaction', description: msg('Se inclina en 3D siguiendo el mouse (agrega dentro un <div class="fx-glare"></div> para el reflejo).') },
  { name: 'data-fx="spotlight"', kind: 'interaction', description: msg('Una luz sigue al mouse sobre el elemento.') },
  { name: 'data-fx="count"', kind: 'interaction', description: msg('El número cuenta desde 0 al aparecer (ej. <strong data-fx="count">1,450</strong>).') },
] as const;

const ENTRANCES = ['fade-up', 'fade-in', 'zoom-in', 'blur-in', 'slide-left', 'slide-right'] as const;

/**
 * Hoja de estilos de los efectos (sin limitar: quien la incluye la limita a
 * su contenedor). Las entradas usan la línea de tiempo del scroll si el
 * navegador la tiene; si no, se animan al cargar.
 */
export const FX_CSS = `
@keyframes fx-fade-up { from { opacity: 0; transform: translateY(32px); } }
@keyframes fx-fade-in { from { opacity: 0; } }
@keyframes fx-zoom-in { from { opacity: 0; transform: scale(0.9); } }
@keyframes fx-blur-in { from { opacity: 0; filter: blur(12px); } }
@keyframes fx-slide-left { from { opacity: 0; transform: translateX(-48px); } }
@keyframes fx-slide-right { from { opacity: 0; transform: translateX(48px); } }
@keyframes fx-float { 50% { transform: translateY(-10px); } }
@keyframes fx-pulse { 50% { transform: scale(1.04); } }
@keyframes fx-bounce { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-12px); } 60% { transform: translateY(-5px); } }
@keyframes fx-glow { 50% { box-shadow: 0 0 26px 4px var(--c-accent, #7c3aed); } }
@keyframes fx-shimmer { to { background-position: -200% 0; } }
@keyframes fx-spin { to { transform: rotate(1turn); } }
@keyframes fx-gradient { 50% { background-position: 100% 50%; } }
.fx-delay-1 { --fx-delay: 0.15s; }
.fx-delay-2 { --fx-delay: 0.3s; }
.fx-delay-3 { --fx-delay: 0.45s; }
.fx-gradient-text { background: linear-gradient(90deg, var(--c-primary, #7c3aed), var(--c-accent, #06b6d4), var(--c-primary, #7c3aed)); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; }
.fx-gradient-bg { background: linear-gradient(120deg, var(--c-primary, #7c3aed), var(--c-accent, #06b6d4), var(--c-primary, #7c3aed)); background-size: 200% 200%; }
.fx-hover-lift, .fx-hover-grow, .fx-hover-glow { transition: transform 0.25s ease, box-shadow 0.25s ease; }
.fx-hover-lift:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18); }
.fx-hover-grow:hover { transform: scale(1.04); }
.fx-hover-glow:hover { box-shadow: 0 0 0 2px var(--c-accent, #7c3aed), 0 0 28px var(--c-accent, #7c3aed); }
[data-fx~="tilt"], [data-fx~="spotlight"] { position: relative; }
[data-fx~="tilt"] { transform: perspective(900px) rotateX(var(--fx-rx, 0deg)) rotateY(var(--fx-ry, 0deg)); transition: transform 0.2s ease-out; }
.fx-glare, [data-fx~="spotlight"]::after { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: var(--fx-light, 0); transition: opacity 0.3s ease; }
.fx-glare { background: radial-gradient(circle at var(--fx-mx, 50%) var(--fx-my, 50%), rgba(255, 255, 255, 0.4), transparent 55%); mix-blend-mode: overlay; }
[data-fx~="spotlight"]::after { content: ''; background: radial-gradient(420px circle at var(--fx-mx, 50%) var(--fx-my, 50%), rgba(255, 255, 255, 0.16), transparent 45%); }
@media (prefers-reduced-motion: no-preference) {
${ENTRANCES.map((name) => `  .fx-${name} { animation: fx-${name} 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) var(--fx-delay, 0s) both; }`).join('\n')}
  @supports (animation-timeline: view()) {
    ${ENTRANCES.map((name) => `.fx-${name}`).join(', ')} { animation-timeline: view(); animation-range: entry 0% entry 60%; animation-delay: 0s; }
  }
  .fx-float { animation: fx-float 4s ease-in-out infinite; }
  .fx-pulse { animation: fx-pulse 2.4s ease-in-out infinite; }
  .fx-bounce { animation: fx-bounce 2s ease-in-out infinite; }
  .fx-glow { animation: fx-glow 2.6s ease-in-out infinite; }
  .fx-spin-slow { animation: fx-spin 12s linear infinite; }
  .fx-gradient-text, .fx-gradient-bg { animation: fx-gradient 6s ease infinite; }
  .fx-shimmer { background-image: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%); background-size: 200% 100%; animation: fx-shimmer 2.8s linear infinite; }
}
`;

/** "1,450.00" → 1450 con 2 decimales y separador de miles "," (o "1.450,00" al revés). */
export function parseCount(text: string): { value: number; decimals: number; group: string; decimal: string; prefix: string; suffix: string } | null {
  const match = /^(\D*?)(\d{1,3}(?:([.,\s])\d{3})*|\d+)(?:([.,])(\d+))?(\D*)$/.exec(text.trim());
  if (!match) return null;
  const [, prefix, integer, group = '', decimal = '.', fraction = '', suffix] = match;
  // "1.450" con un solo separador de 3 dígitos se lee como miles.
  const value = Number(integer.replace(/[.,\s]/g, '') + (fraction ? `.${fraction}` : ''));
  return Number.isFinite(value) ? { value, decimals: fraction.length, group, decimal, prefix, suffix } : null;
}

export function formatCount(value: number, { decimals, group, decimal, prefix, suffix }: NonNullable<ReturnType<typeof parseCount>>): string {
  const [int, frac] = value.toFixed(decimals).split('.');
  const grouped = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, group) : int;
  return `${prefix}${grouped}${frac ? `${decimal}${frac}` : ''}${suffix}`;
}

/**
 * Interacciones de `data-fx` dentro de `root` (inclinación 3D, luz que sigue
 * al mouse y contadores). Devuelve la limpieza. Sólo el código de la
 * plataforma toca el DOM: el HTML del negocio no ejecuta nada.
 */
export function installFx(root: HTMLElement): () => void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const cleanups: (() => void)[] = [];

  root.querySelectorAll<HTMLElement>('[data-fx~="tilt"], [data-fx~="spotlight"]').forEach((el) => {
    const tilt = !reduce && el.matches('[data-fx~="tilt"]');
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const box = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
      el.style.setProperty('--fx-mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--fx-my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--fx-light', '1');
      if (tilt) {
        el.style.setProperty('--fx-ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
        el.style.setProperty('--fx-rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
      }
    };
    const leave = () => {
      el.style.setProperty('--fx-light', '0');
      el.style.setProperty('--fx-rx', '0deg');
      el.style.setProperty('--fx-ry', '0deg');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    });
  });

  const counters = [...root.querySelectorAll<HTMLElement>('[data-fx~="count"]')].flatMap((el) => {
    const parsed = parseCount(el.textContent ?? '');
    return parsed ? [{ el, parsed, original: el.textContent ?? '' }] : [];
  });
  if (counters.length && !reduce && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const counter = counters.find((c) => c.el === entry.target);
        if (!counter) continue;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / 1200);
          const eased = 1 - (1 - progress) ** 3;
          counter.el.textContent = progress < 1 ? formatCount(counter.parsed.value * eased, counter.parsed) : counter.original;
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    counters.forEach(({ el }) => observer.observe(el));
    cleanups.push(() => observer.disconnect());
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
