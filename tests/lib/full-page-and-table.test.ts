import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseActions } from '@/lib/assistant/actions';
import { embedDocument } from '@/lib/site/custom-code';
import { isFullDocument, needsFullPageWidget } from '@/lib/site/custom-code-config';
import { createSection, sectionSchemas } from '@/lib/site/section-schemas';
import { addTableColumn, moveTableColumn, parseTablePaste, removeTableColumn } from '@/lib/site/table';

const page = `<!DOCTYPE html>
<html lang="es" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <title>Nexus</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.glass{backdrop-filter:blur(12px)}</style>
</head>
<body class="bg-gray-50"><header class="fixed top-0">Menú</header><a href="#servicios">Servicios</a><section id="servicios">…</section>
<script>localStorage.getItem('theme')</script></body></html>`;

describe('Widget con código: páginas completas', () => {
  it('reconoce una página completa y lo que sólo funciona como widget', () => {
    assert.ok(isFullDocument(page));
    assert.ok(isFullDocument('<!-- hecho con IA -->\n<html><body>x</body></html>'));
    assert.ok(!isFullDocument('<div><html-like>no</html-like></div>'));
    assert.ok(needsFullPageWidget(page));
    assert.ok(needsFullPageWidget('<div id="x"></div><script>x()</script>'));
    assert.ok(needsFullPageWidget('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'));
    assert.ok(!needsFullPageWidget('<div class="promo"><h2>Hola</h2></div><style>.promo{color:red}</style>'));
  });

  it('una página completa se usa tal cual: lo de la plataforma va al inicio de su <head>, antes de sus scripts', () => {
    const doc = embedDocument(page, { '--c-accent': '#06B6D4' });
    assert.ok(doc.startsWith('<!DOCTYPE html>\n<html lang="es" class="scroll-smooth">\n<head><meta charset="utf-8">'));
    // Una sola vez cada cosa: no se envuelve en otro documento.
    assert.equal((doc.match(/<html/gi) ?? []).length, 1);
    assert.equal((doc.match(/<body/gi) ?? []).length, 1);
    const shim = doc.indexOf('localStorage');
    assert.ok(shim > 0 && shim < doc.indexOf('cdn.tailwindcss.com'), 'el ajuste corre antes que sus scripts');
    assert.match(doc, /:root\{--c-accent:#06B6D4\}/);
    // Su diseño no se pisa: sin los estilos base del fragmento.
    assert.doesNotMatch(doc, /html,body\{margin:0;background:transparent\}/);
    assert.match(doc, /<body class="bg-gray-50">/);
  });

  it('el ajuste: almacenamiento y cookies en memoria, #anclas dentro del widget y freno al ciclo de alturas', () => {
    const doc = embedDocument('<p>x</p>');
    assert.match(doc, /\['localStorage','sessionStorage'\]\.forEach/);
    assert.match(doc, /defineProperty\(document,'cookie'/);
    assert.match(doc, /closest\('a\[href\^="#"\]'\)/);
    assert.match(doc, /if\(\+\+same>=3\)\{stop=true/);
    // Un fragmento sigue dentro del documento con los estilos base.
    assert.match(doc, /html,body\{margin:0;background:transparent\}/);
    // Sin <head>: se le agrega uno.
    assert.match(embedDocument('<html><body>x</body></html>'), /^<html><head><meta charset="utf-8">/);
  });

  it('el widget acepta páginas largas y tiene modo pantalla completa', () => {
    const widget = createSection('embed', { code: 'x'.repeat(120_000), fullScreen: true });
    assert.equal(widget.content.code.length, 120_000);
    assert.equal(widget.content.fullScreen, true);
    assert.equal(createSection('embed').content.fullScreen, false);
    assert.ok(!sectionSchemas.embed.safeParse({ ...widget, content: { ...widget.content, code: 'x'.repeat(150_001) } }).success);
  });
});

describe('Sección Tabla', () => {
  it('nace con un ejemplo de 3 columnas; Garfield también la puede crear', () => {
    const table = createSection('table');
    assert.deepEqual(table.content.columns.map((c) => c.label), ['Servicio', 'Básico', 'Completo']);
    assert.equal(table.content.rows.length, 3);
    assert.equal(table.content.mobile, 'scroll');
    const { errors } = parseActions([{ action: 'create_section', section: { type: 'table', content: { title: 'Tallas', columns: [{ label: 'Talla' }, { label: 'Pecho (cm)', align: 'right' }], rows: [{ cells: ['M', '96'] }] } } }]);
    assert.deepEqual(errors, []);
  });

  it('pegar desde Excel / Google Sheets (tabuladores), CSV con comillas y punto y coma', () => {
    const fromSheet = parseTablePaste('Producto\tPrecio\tStock\nCafé\t$55\t12\nTé\t$40\t8\n')!;
    assert.deepEqual(fromSheet.columns.map((c) => [c.label, c.align]), [['Producto', 'left'], ['Precio', 'right'], ['Stock', 'right']]);
    assert.deepEqual(fromSheet.rows.map((r) => r.cells), [['Café', '$55', '12'], ['Té', '$40', '8']]);
    const csv = parseTablePaste('Nombre,Nota\n"Pérez, Ana","Dijo ""hola"""\n')!;
    assert.deepEqual(csv.rows[0].cells, ['Pérez, Ana', 'Dijo "hola"']);
    const semicolon = parseTablePaste('a;b;c\n1,5;2,5;3', { header: false })!;
    assert.equal(semicolon.columns.length, 3);
    assert.deepEqual(semicolon.rows.map((r) => r.cells), [['a', 'b', 'c'], ['1,5', '2,5', '3']]);
    assert.equal(parseTablePaste('   \n  '), null);
    // Filas cortas se completan con celdas vacías.
    assert.deepEqual(parseTablePaste('a\tb\tc\n1')!.rows[0].cells, ['1', '', '']);
  });

  it('agregar, quitar y mover columnas mantiene alineadas las celdas', () => {
    const base = parseTablePaste('A\tB\n1\t2\n3\t4')!;
    const added = addTableColumn(base, 'C');
    assert.deepEqual(added.rows.map((r) => r.cells), [['1', '2', ''], ['3', '4', '']]);
    const moved = moveTableColumn(added, 2, 0);
    assert.deepEqual(moved.columns.map((c) => c.label), ['C', 'A', 'B']);
    assert.deepEqual(moved.rows[0].cells, ['', '1', '2']);
    const removed = removeTableColumn(moved, 1);
    assert.deepEqual(removed.columns.map((c) => c.label), ['C', 'B']);
    assert.deepEqual(removed.rows[1].cells, ['', '4']);
    assert.equal(removeTableColumn(parseTablePaste('A\n1')!, 0).columns.length, 1, 'siempre queda una columna');
  });
});
