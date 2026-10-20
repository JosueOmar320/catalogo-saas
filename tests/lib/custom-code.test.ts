import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampEmbedHeight, EMBED_SANDBOX, embedDocument, htmlToText, sanitizeCustomHtml, scopeCustomCss } from '@/lib/site/custom-code';

describe('Código propio: HTML', () => {
  it('quita scripts, eventos, iframes, formularios y URLs javascript:', () => {
    const dirty = `<div onclick="steal()" class="caja"><script>alert(1)</script><p>Hola <a href="javascript:alert(1)">x</a></p><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input name="p"></form><img src="x" onerror="alert(1)"><style>body{display:none}</style></div>`;
    const clean = sanitizeCustomHtml(dirty);
    assert.doesNotMatch(clean, /script|onclick|onerror|iframe|<form|<input|javascript:|<style|display:none/i);
    assert.match(clean, /<div class="caja"><p>Hola <a>x<\/a><\/p>/);
  });

  it('conserva el contenido y el estilo seguro; las imágenes sólo por https', () => {
    const clean = sanitizeCustomHtml('<section style="color: #c00; position: fixed; background: url(https://x.test/a.png); padding: 24px"><h2>Promo</h2><img src="https://cdn.test/a.jpg" alt="A"><img src="http://cdn.test/b.jpg" alt="B"><table><tr><td colspan="2">1</td></tr></table></section>');
    assert.match(clean, /style="color:#c00;padding:24px"/);
    assert.match(clean, /<h2>Promo<\/h2>/);
    assert.match(clean, /<img loading="lazy" src="https:\/\/cdn\.test\/a\.jpg" alt="A" \/>/);
    assert.doesNotMatch(clean, /http:\/\/cdn|position|url\(/);
    assert.match(clean, /<td colspan="2">1<\/td>/);
  });

  it('enlaces a otra pestaña sin acceso a esta ventana; sin id', () => {
    const clean = sanitizeCustomHtml('<a id="logout" href="https://ejemplo.com" target="_blank" rel="opener">Ir</a>');
    assert.equal(clean, '<a href="https://ejemplo.com" target="_blank" rel="noopener noreferrer">Ir</a>');
  });

  it('texto plano para el PDF', () => {
    assert.equal(htmlToText('<h2>Horario</h2><p>Lunes &amp; martes</p><ul><li>9:00</li><li>18:00</li></ul><script>x()</script>'), 'Horario\nLunes & martes\n9:00\n18:00');
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
    assert.ok(doc.indexOf('vitrina:embed-height') < doc.indexOf('<body>'));
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
