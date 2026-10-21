import { msg } from '@/i18n/translate';

/**
 * Ejemplos para la sección HTML: muestran cómo combinar HTML, su <style>
 * (limitado a la sección), variables CSS y los efectos fx-… / data-fx.
 * Usan los colores del sitio (var(--c-…)) para verse bien con cualquier tema.
 */
export const HTML_EXAMPLES = [
  {
    id: 'tilt-card',
    label: msg('Tarjeta 3D con reflejo'),
    html: `<article class="holo fx-fade-up" data-fx="tilt">
  <div class="fx-glare"></div>
  <span class="holo__badge fx-shimmer">Edición limitada</span>
  <h3 class="holo__title">Colección Aurora</h3>
  <p class="holo__text">Pasa el mouse por encima: la tarjeta se inclina y refleja la luz.</p>
  <ul class="holo__traits">
    <li><span>Calidad</span><span class="holo__bar" style="--progress: 92%"></span></li>
    <li><span>Diseño</span><span class="holo__bar" style="--progress: 85%"></span></li>
  </ul>
  <a class="holo__cta fx-hover-glow" href="#contacto">Lo quiero</a>
</article>
<style>
.holo { max-width: 380px; margin: 0 auto; padding: 28px; border-radius: 24px; color: #fff; overflow: hidden;
  background: linear-gradient(135deg, var(--c-primary), var(--c-accent)); box-shadow: 0 24px 60px rgba(0,0,0,.25); }
.holo__badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background-color: rgba(255,255,255,.18); font-size: 12px; font-weight: 700; }
.holo__title { margin: 14px 0 6px; font-size: 26px; color: #fff; }
.holo__text { margin: 0 0 18px; opacity: .85; }
.holo__traits { list-style: none; margin: 0 0 22px; padding: 0; display: grid; gap: 10px; }
.holo__traits li { display: grid; gap: 4px; font-size: 13px; }
.holo__bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.2); position: relative; overflow: hidden; }
.holo__bar::after { content: ""; position: absolute; inset: 0; width: var(--progress); border-radius: inherit; background: #fff; }
.holo__cta { display: inline-block; padding: 10px 18px; border-radius: 12px; background: #fff; color: var(--c-primary); font-weight: 700; text-decoration: none; }
</style>`,
  },
  {
    id: 'counters',
    label: msg('Cifras que cuentan'),
    html: `<div class="cifras">
  <div class="cifras__item fx-fade-up"><strong data-fx="count">1,250</strong><span>clientes felices</span></div>
  <div class="cifras__item fx-fade-up fx-delay-1"><strong data-fx="count">98%</strong><span>recomiendan</span></div>
  <div class="cifras__item fx-fade-up fx-delay-2"><strong data-fx="count">15</strong><span>años de experiencia</span></div>
</div>
<style>
.cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; text-align: center; }
.cifras__item { padding: 24px 16px; border-radius: 18px; background: var(--c-surface); border: 1px solid var(--c-border); }
.cifras__item strong { display: block; font-size: 40px; line-height: 1.1; color: var(--c-accent); }
.cifras__item span { color: var(--c-muted); }
</style>`,
  },
  {
    id: 'cta',
    label: msg('Llamado con fondo animado'),
    html: `<div class="cta fx-gradient-bg" data-fx="spotlight">
  <h2 class="cta__title fx-blur-in">¿Listo para empezar?</h2>
  <p class="cta__text">Escríbenos y te respondemos hoy mismo.</p>
  <a class="cta__button fx-float fx-hover-lift" href="#contacto">Hablemos</a>
</div>
<style>
.cta { padding: 56px 24px; border-radius: 28px; text-align: center; color: #fff; overflow: hidden; }
.cta__title { margin: 0 0 8px; font-size: 34px; color: #fff; }
.cta__text { margin: 0 0 24px; opacity: .9; }
.cta__button { display: inline-block; padding: 12px 22px; border-radius: 999px; background: #fff; color: var(--c-primary); font-weight: 700; text-decoration: none; }
</style>`,
  },
] as const;
