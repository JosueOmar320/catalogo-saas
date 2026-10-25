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
  {
    id: 'tabs',
    label: msg('Pestañas (sólo CSS)'),
    html: `<div class="tabs">
  <input type="radio" name="menu" id="tab-1" checked><label for="tab-1">Desayunos</label>
  <input type="radio" name="menu" id="tab-2"><label for="tab-2">Comidas</label>
  <input type="radio" name="menu" id="tab-3"><label for="tab-3">Postres</label>
  <div class="tabs__panel tabs__panel--1"><h3>Desayunos</h3><p>Chilaquiles, molletes y fruta de temporada de 8 a 12.</p></div>
  <div class="tabs__panel tabs__panel--2"><h3>Comidas</h3><p>Menú del día con sopa, plato fuerte y agua fresca.</p></div>
  <div class="tabs__panel tabs__panel--3"><h3>Postres</h3><p>Pastel de elote, flan napolitano y galletas recién horneadas.</p></div>
</div>
<style>
.tabs { max-width: 720px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 8px; }
.tabs input { position: absolute; opacity: 0; pointer-events: none; }
.tabs label { padding: 10px 18px; border-radius: 999px; border: 1px solid var(--c-border); cursor: pointer; font-weight: 600; }
.tabs input:checked + label { background: var(--c-primary); border-color: var(--c-primary); color: #fff; }
.tabs input:focus-visible + label { outline: 2px solid var(--c-accent); outline-offset: 2px; }
.tabs__panel { display: none; width: 100%; margin-top: 12px; padding: 24px; border-radius: 16px; background: var(--c-surface, #fff); box-shadow: 0 10px 30px rgba(0,0,0,.06); }
#tab-1:checked ~ .tabs__panel--1, #tab-2:checked ~ .tabs__panel--2, #tab-3:checked ~ .tabs__panel--3 { display: block; }
</style>`,
  },
  {
    id: 'icon-features',
    label: msg('Beneficios con íconos SVG'),
    html: `<div class="benefits">
  <article class="benefit fx-fade-up fx-hover-lift">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
    <h3>Calidad garantizada</h3><p>Cada pieza se revisa a mano antes de salir.</p>
  </article>
  <article class="benefit fx-fade-up fx-delay-1 fx-hover-lift">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>
    <h3>Envío el mismo día</h3><p>Pide antes de las 2 p. m. y te llega hoy.</p>
  </article>
  <article class="benefit fx-fade-up fx-delay-2 fx-hover-lift">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z" /></svg>
    <h3>Hecho con cariño</h3><p>Negocio local, atendido por sus dueños.</p>
  </article>
</div>
<style>
.benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.benefit { padding: 28px; border-radius: 20px; background: var(--c-surface, #fff); border: 1px solid var(--c-border); }
.benefit svg { width: 44px; height: 44px; padding: 10px; border-radius: 14px; fill: var(--c-primary); background: var(--c-accent-soft, rgba(0,0,0,.05)); }
.benefit h3 { margin: 16px 0 6px; font-size: 19px; }
.benefit p { margin: 0; color: var(--c-muted); }
</style>`,
  },
  {
    id: 'timeline',
    label: msg('Línea de tiempo'),
    html: `<ol class="timeline">
  <li class="fx-slide-left"><time>2015</time><h3>Abrimos la primera tienda</h3><p>Un local pequeño y muchas ganas.</p></li>
  <li class="fx-slide-left fx-delay-1"><time>2019</time><h3>Llegamos a toda la ciudad</h3><p>Pedidos a domicilio en todas las colonias.</p></li>
  <li class="fx-slide-left fx-delay-2"><time>2024</time><h3>Más de 10,000 clientes</h3><p>Gracias por elegirnos cada día.</p></li>
</ol>
<style>
.timeline { list-style: none; max-width: 680px; margin: 0 auto; padding: 0 0 0 28px; border-left: 3px solid var(--c-accent); display: grid; gap: 28px; }
.timeline li { position: relative; }
.timeline li::before { content: ""; position: absolute; left: -38px; top: 4px; width: 17px; height: 17px; border-radius: 50%; background: var(--c-accent); box-shadow: 0 0 0 5px var(--c-accent-soft, rgba(0,0,0,.08)); }
.timeline time { font-weight: 800; color: var(--c-accent); letter-spacing: .04em; }
.timeline h3 { margin: 4px 0; }
.timeline p { margin: 0; color: var(--c-muted); }
</style>`,
  },
  {
    id: 'faq',
    label: msg('Preguntas desplegables'),
    html: `<div class="faq">
  <details name="faq" open><summary>¿Hacen envíos?</summary><p>Sí, a toda la ciudad. El costo depende de tu zona.</p></details>
  <details name="faq"><summary>¿Qué formas de pago aceptan?</summary><p>Efectivo, transferencia y tarjeta al recibir.</p></details>
  <details name="faq"><summary>¿Puedo apartar un pedido?</summary><p>Claro, con un anticipo del 50 %.</p></details>
</div>
<style>
.faq { max-width: 720px; margin: 0 auto; display: grid; gap: 10px; }
.faq details { border: 1px solid var(--c-border); border-radius: 14px; padding: 4px 20px; background: var(--c-surface, #fff); }
.faq summary { cursor: pointer; padding: 14px 0; font-weight: 700; list-style: none; display: flex; justify-content: space-between; }
.faq summary::after { content: "+"; color: var(--c-accent); font-size: 22px; line-height: 1; transition: transform .2s; }
.faq details[open] summary::after { transform: rotate(45deg); }
.faq p { margin: 0 0 16px; color: var(--c-muted); }
</style>`,
  },
  {
    id: 'pricing',
    label: msg('Tabla de planes destacada'),
    html: `<div class="plans">
  <article class="plan fx-fade-up"><h3>Básico</h3><p class="plan__price">$199<small>/mes</small></p><ul><li>1 servicio al mes</li><li>Soporte por WhatsApp</li></ul><a href="#contacto" class="plan__cta">Elegir</a></article>
  <article class="plan plan--featured fx-fade-up fx-delay-1" data-fx="spotlight"><span class="plan__badge">Más popular</span><h3>Plus</h3><p class="plan__price">$399<small>/mes</small></p><ul><li>3 servicios al mes</li><li>Prioridad en agenda</li><li>Descuento en productos</li></ul><a href="#contacto" class="plan__cta">Elegir</a></article>
  <article class="plan fx-fade-up fx-delay-2"><h3>Pro</h3><p class="plan__price">$699<small>/mes</small></p><ul><li>Servicios ilimitados</li><li>Atención a domicilio</li></ul><a href="#contacto" class="plan__cta">Elegir</a></article>
</div>
<style>
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 20px; align-items: center; }
.plan { position: relative; padding: 32px 26px; border-radius: 22px; border: 1px solid var(--c-border); background: var(--c-surface, #fff); text-align: center; }
.plan--featured { color: #fff; border: 0; padding-block: 44px; background: linear-gradient(160deg, var(--c-primary), var(--c-accent)); box-shadow: 0 24px 50px rgba(0,0,0,.18); }
.plan__badge { position: absolute; top: 14px; left: 50%; translate: -50% 0; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,.2); font-size: 12px; font-weight: 700; }
.plan__price { font-size: 40px; font-weight: 800; margin: 8px 0 16px; }
.plan__price small { font-size: 15px; font-weight: 500; opacity: .75; }
.plan ul { list-style: none; padding: 0; margin: 0 0 24px; display: grid; gap: 8px; }
.plan__cta { display: inline-block; padding: 10px 22px; border-radius: 999px; font-weight: 700; text-decoration: none; background: var(--c-primary); color: #fff; }
.plan--featured .plan__cta { background: #fff; color: var(--c-primary); }
</style>`,
  },
  {
    id: 'video',
    label: msg('Video de YouTube con texto'),
    html: `<div class="video-split">
  <div class="video-split__text fx-slide-left"><h2>Así lo hacemos</h2><p>Mira cómo preparamos cada pedido, de principio a fin.</p></div>
  <div class="video-split__frame fx-zoom-in"><iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Video de nuestro proceso" allowfullscreen></iframe></div>
</div>
<style>
.video-split { display: grid; grid-template-columns: 1fr 1.4fr; gap: 32px; align-items: center; }
.video-split__frame { aspect-ratio: 16 / 9; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,.2); }
.video-split__frame iframe { width: 100%; height: 100%; border: 0; }
@media (max-width: 720px) { .video-split { grid-template-columns: 1fr; } }
</style>`,
  },
] as const;
