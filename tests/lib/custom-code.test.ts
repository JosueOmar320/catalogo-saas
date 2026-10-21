import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampEmbedHeight, cleanCustomHtmlSource, cleanInlineStyle, EMBED_MESSAGE, EMBED_SANDBOX, embedDocument, htmlToText, renderCustomHtml, sanitizeCustomHtml, scopeCustomCss } from '@/lib/site/custom-code';

describe('Código propio: HTML', () => {
  it('quita scripts, eventos, iframes, formularios y URLs javascript:', () => {
    const dirty = `<div onclick="steal()" class="caja"><script>alert(1)</script><p>Hola <a href="javascript:alert(1)">x</a></p><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input name="p"></form><img src="x" onerror="alert(1)"><style>body{display:none}</style></div>`;
    const clean = sanitizeCustomHtml(dirty);
    assert.doesNotMatch(clean, /script|onclick|onerror|iframe|<form|<input|javascript:|<style|display:none/i);
    assert.match(clean, /<div class="caja"><p>Hola <a>x<\/a><\/p>/);
  });

  it('conserva el contenido y el estilo seguro; las imágenes sólo por https', () => {
    const clean = sanitizeCustomHtml('<section style="color: #c00; position: fixed; background: url(https://x.test/a.png); padding: 24px"><h2>Promo</h2><img src="https://cdn.test/a.jpg" alt="A"><img src="http://cdn.test/b.jpg" alt="B"><table><tr><td colspan="2">1</td></tr></table></section>');
    assert.match(clean, /style="color:#c00;background:url\(https:\/\/x\.test\/a\.png\);padding:24px"/);
    assert.match(clean, /<h2>Promo<\/h2>/);
    assert.match(clean, /<img loading="lazy" src="https:\/\/cdn\.test\/a\.jpg" alt="A" \/>/);
    assert.doesNotMatch(clean, /http:\/\/cdn|position/);
    assert.match(clean, /<td colspan="2">1<\/td>/);
  });

  it('enlaces a otra pestaña sin acceso a esta ventana; sin id', () => {
    const clean = sanitizeCustomHtml('<a id="logout" href="https://ejemplo.com" target="_blank" rel="opener">Ir</a>');
    assert.equal(clean, '<a href="https://ejemplo.com" target="_blank" rel="noopener noreferrer">Ir</a>');
  });

  it('texto plano para el PDF', () => {
    assert.equal(htmlToText('<h2>Horario</h2><p>Lunes &amp; martes</p><ul><li>9:00</li><li>18:00</li></ul><script>x()</script>'), 'Horario\nLunes & martes\n9:00\n18:00');
    // Sin decodificar dos veces: el texto "&lt;b&gt;" escrito como entidades sigue siendo ese texto.
    assert.equal(htmlToText('<p>Usa &amp;lt;b&amp;gt; para negritas</p>'), 'Usa &lt;b&gt; para negritas');
  });
});

describe('Código propio: HTML con su CSS, variables y más etiquetas', () => {
  it('estilo en línea: variables CSS, transformaciones y animaciones sí; position: fixed y url() inseguras no', () => {
    assert.equal(cleanInlineStyle('--progress: 92%; transform: rotate(3deg); animation: spin 2s infinite; position: fixed; top: 0'), '--progress:92%;transform:rotate(3deg);animation:spin 2s infinite;top:0');
    assert.equal(cleanInlineStyle('position: absolute; background: url(javascript:alert(1)); color: red'), 'position:absolute;color:red');
    assert.equal(cleanInlineStyle('width: expression(alert(1)); behavior: url(x.htc)'), '');
    assert.equal(cleanInlineStyle('}} body { display:none'), '');
  });

  it('nav, botones (siempre type="button"), progress y tabindex 0/-1', () => {
    const clean = sanitizeCustomHtml('<nav aria-label="Vistas"><a href="#a">A</a></nav><button type="submit" onclick="x()">Ok</button><progress value="3" max="5"></progress><article tabindex="5">X</article>');
    assert.equal(clean, '<nav aria-label="Vistas"><a href="#a">A</a></nav><button type="button">Ok</button><progress value="3" max="5"></progress><article tabindex="0">X</article>');
  });

  it('el <style> del HTML se guarda limpio y al mostrarse sólo alcanza a su sección', () => {
    const source = '<article class="card" style="--progress: 92%">Hola</article><style>.card { border-radius: 24px } body { background: #000 } @import url(https://x.test/a.css); .x { background: url(javascript:alert(1)) }</style><script>alert(1)</script>';
    const saved = cleanCustomHtmlSource(source);
    assert.match(saved, /^<article class="card" style="--progress:92%">Hola<\/article>\n<style>/);
    assert.doesNotMatch(saved, /script|@import|javascript/);
    const { markup, css } = renderCustomHtml(saved, 'sec-1');
    assert.equal(markup, '<article class="card" style="--progress:92%">Hola</article>');
    assert.match(css, /\[data-custom-html="sec-1"\] \.card \{ border-radius: 24px \}/);
    assert.match(css, /\[data-custom-html="sec-1"\] \{ background: #000 \}/);
  });

  it('un </style> dentro del CSS no permite meter HTML', () => {
    const { markup, css } = renderCustomHtml('<style>.a{content:"x"}</style><img src=x onerror=alert(1)><style>.b{color:red}</style>', 'id"]{}*{');
    assert.equal(markup, '<img loading="lazy" src="x" />');
    assert.match(css, /\[data-custom-html="id"\] \.b\{color:red\}/);
  });
});

describe('Código propio: CSS del sitio', () => {
  it('cada regla queda dentro del sitio; body/html/:root son el sitio', () => {
    const css = scopeCustomCss('h1, .promo > p { color: red } body { background: #000 } :root { --x: 1px } html body .a { margin: 0 } @media (max-width: 600px) { .b { display: none } }');
    assert.match(css, /\[data-site\] h1,\s*\[data-site\] \.promo > p \{ color: red \}/);
    assert.match(css, /\[data-site\] \{ background: #000 \}/);
    assert.match(css, /\[data-site\] \{ --x: 1px \}/);
    assert.match(css, /\[data-site\] \.a \{ margin: 0 \}/);
    assert.match(css, /@media \(max-width: 600px\) \{ \[data-site\] \.b \{ display: none \} \}/);
  });

  it('sin @import, url() que no sea https ni trucos para salir de <style>', () => {
    const css = scopeCustomCss('@import url(https://evil.test/x.css); .a { background: url(javascript:alert(1)); color: blue } .b { background: url("https://cdn.test/f.png") } .c { content: "</style><script>alert(1)</script>" } .d { width: expression(alert(1)) }');
    assert.doesNotMatch(css, /@import|javascript:|expression|<\/style/i);
    assert.match(css, /\[data-site\] \.a \{ color: blue \}/);
    assert.match(css, /url\("https:\/\/cdn\.test\/f\.png"\)/);
    assert.match(css, /\\3c \/style>/);
  });

  it('las animaciones no se tocan por dentro; CSS ilegible no se aplica', () => {
    const css = scopeCustomCss('@keyframes pulso { from { opacity: 0 } to { opacity: 1 } } .a { animation: pulso 1s }');
    assert.match(css, /@keyframes pulso \{ from \{ opacity: 0 \} to \{ opacity: 1 \} \}/);
    assert.equal(scopeCustomCss('.a { color: red '), '');
    // Una llave de más no permite "salir" del alcance: no se aplica nada.
    assert.equal(scopeCustomCss('.a { color: red }} body { display: none }'), '');
    assert.equal(scopeCustomCss('}}} {{{'), '');
    assert.equal(scopeCustomCss('   '), '');
  });
});

describe('Código propio: widget', () => {
  it('iframe aislado: nunca con el mismo origen ni navegación de la página', () => {
    assert.doesNotMatch(EMBED_SANDBOX, /allow-same-origin|allow-top-navigation/);
    assert.match(EMBED_SANDBOX, /allow-scripts/);
    const doc = embedDocument('<div id="w"></div><script src="https://widget.test/a.js"></script>');
    assert.ok(doc.indexOf(`type:'${EMBED_MESSAGE}'`) > 0 && doc.indexOf(EMBED_MESSAGE) < doc.indexOf('<body>'));
    assert.match(doc, /<body><div id="w"><\/div><script src="https:\/\/widget\.test\/a\.js"><\/script><\/body>/);
  });

  it('altura informada por el widget, dentro de un rango', () => {
    assert.equal(clampEmbedHeight(320.4), 320);
    assert.equal(clampEmbedHeight(5), 40);
    assert.equal(clampEmbedHeight(99999), 4000);
    assert.equal(clampEmbedHeight('300'), null);
    assert.equal(clampEmbedHeight(Number.NaN), null);
  });
});

describe('Código propio: efectos fx', () => {
  it('los contadores leen y escriben números con miles, decimales y texto alrededor', async () => {
    const { parseCount, formatCount } = await import('@/lib/site/fx');
    const price = parseCount('$1,450.00 MXN')!;
    assert.deepEqual([price.value, price.decimals, price.prefix, price.suffix], [1450, 2, '$', ' MXN']);
    assert.equal(formatCount(725, price), '$725.00 MXN');
    const percent = parseCount('98%')!;
    assert.equal(formatCount(49.4, percent), '49%');
    assert.equal(formatCount(1234567, parseCount('1.000.000')!), '1.234.567');
    assert.equal(parseCount('sin número'), null);
  });

  it('los efectos quedan limitados a las secciones HTML; las animaciones respetan "reducir movimiento"', async () => {
    const { customHtmlFxCss } = await import('@/lib/site/custom-code');
    const css = customHtmlFxCss();
    assert.match(css, /\[data-custom-html\] \.fx-hover-lift:hover/);
    assert.match(css, /\[data-custom-html\] \[data-fx~="tilt"\]/);
    assert.match(css, /@keyframes fx-fade-up/);
    assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*\[data-custom-html\] \.fx-float \{ animation: fx-float/);
    assert.doesNotMatch(css, /(^|\})\s*\.fx-/);
  });

  it('el widget trae los colores del sitio y los efectos; valores raros no pasan', () => {
    const doc = embedDocument('<p class="fx-pulse">Hola</p>', { '--c-accent': '#06B6D4', '--c-primary': 'red;}</style><script>alert(1)</script>', '--font-x': 'x' });
    assert.match(doc, /:root\{--c-accent:#06B6D4\}/);
    assert.doesNotMatch(doc, /alert|--font-x/);
    assert.match(doc, /\.fx-pulse \{ animation: fx-pulse/);
  });
});
