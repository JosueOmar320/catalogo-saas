import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importUpdatePatch, itemsToCsv, matchKey, parseCsv, parseImageCell, parseItemTable, parsePriceCell, toCsv, CSV_TEMPLATE_ROWS, MAX_IMPORT_IMAGES, MAX_IMPORT_ROWS, type ImportRow } from '@/lib/catalog/csv';
import { adjustItemPrices, adjustPrice, isValidAdjustment } from '@/lib/catalog/price-adjust';
import { qrMatrix, qrSvg } from '@/lib/qr';
import { buildSampleSite } from '@/lib/site/sample-site';
import { relatedItems } from '@/site-renderer/related';

describe('CSV de productos', () => {
  it('lee comillas, comillas escapadas, saltos de línea y separador ; de Excel en español', () => {
    assert.deepEqual(parseCsv('a,b\r\n"x, y","di ""hola""\nmundo"\n'), [['a', 'b'], ['x, y', 'di "hola"\nmundo']]);
    assert.deepEqual(parseCsv('﻿nombre;precio\nCafé;1.200,50\n\n'), [['nombre', 'precio'], ['Café', '1.200,50']]);
  });

  it('entiende precios con miles y decimales en ambos formatos', () => {
    assert.equal(parsePriceCell('1,200.50'), 1200.5);
    assert.equal(parsePriceCell('1.200,50'), 1200.5);
    assert.equal(parsePriceCell('$ 48'), 48);
    assert.equal(parsePriceCell('1,200'), 1200);
    assert.equal(parsePriceCell('48,5'), 48.5);
    assert.equal(parsePriceCell(''), null);
    assert.ok(Number.isNaN(parsePriceCell('gratis')));
    assert.ok(Number.isNaN(parsePriceCell('-5')));
  });

  it('valida filas, acepta encabezados en inglés y reporta errores por línea', () => {
    const table = parseCsv(
      ['Name,Type,Category,Price,Compare at price,SKU,Available,Tags', 'Café,product,Bebidas,35,,CAF-1,sí,caliente | grande', ',product,,1,,,,', 'Té,algo,,1,,,,', 'Pan,,,10,5,,,', 'Jugo,servicio,,x,,,,', 'Agua,,,12,,,quizá,'].join('\n'),
    );
    const { rows, issues, columns } = parseItemTable(table, 'product');
    assert.ok(columns.includes('compareAt') && columns.includes('sku'));
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0], line: undefined }, {
      line: undefined, name: 'Café', type: 'product', category: 'Bebidas', price: 35, compareAt: null, priceNote: null, sku: 'CAF-1',
      shortDescription: null, description: null, available: true, visible: true, featured: false, tags: ['caliente', 'grande'], images: [],
    });
    assert.deepEqual(issues.map((i) => [i.line, i.message]), [
      [3, 'Falta el nombre.'],
      [4, 'Tipo inválido: usa "producto" o "servicio".'],
      [5, 'El precio anterior debe ser mayor que el precio.'],
      [6, 'Precio inválido.'],
      [7, 'Usa "sí" o "no" en disponible, visible y destacado.'],
    ]);
  });

  it('sin columna de nombre no importa nada; avisa si hay demasiadas filas', () => {
    assert.equal(parseItemTable([['precio'], ['1']]).issues[0].message, 'Falta la columna "nombre".');
    const many = [['nombre'], ...Array.from({ length: MAX_IMPORT_ROWS + 3 }, (_, i) => [`P${i}`])];
    const result = parseItemTable(many);
    assert.equal(result.rows.length, MAX_IMPORT_ROWS);
    assert.match(result.issues[0].message, /hasta \{max\} filas/);
  });

  it('exportar y volver a importar da los mismos datos', () => {
    const { rows } = parseItemTable(parseCsv(itemsToCsv(CSV_TEMPLATE_ROWS)));
    assert.deepEqual(
      rows.map((r) => [r.name, r.category, r.price, r.compareAt, r.priceNote, r.sku, r.featured, r.tags]),
      CSV_TEMPLATE_ROWS.map((r) => [r.name, r.categoryName, r.price, r.compareAt, r.priceNote, r.sku, r.featured, r.tags]),
    );
  });

  it('lee enlaces de fotos (varios, sin repetir, máximo 5) y rechaza los que no son http(s)', () => {
    assert.deepEqual(parseImageCell(''), []);
    assert.deepEqual(parseImageCell('https://a.com/1.jpg | https://a.com/2.jpg\nhttps://a.com/1.jpg'), ['https://a.com/1.jpg', 'https://a.com/2.jpg']);
    assert.equal(parseImageCell(Array.from({ length: 8 }, (_, i) => `https://a.com/${i}.jpg`).join(' '))?.length, MAX_IMPORT_IMAGES);
    assert.equal(parseImageCell('javascript:alert(1)'), null);
    assert.equal(parseImageCell('foto.jpg'), null);

    const { rows, issues } = parseItemTable(parseCsv('name,photos\nCafé,https://a.com/c.jpg\nTé,ftp://a.com/t.jpg'));
    assert.deepEqual(rows.map((r) => [r.name, r.images]), [['Café', ['https://a.com/c.jpg']]]);
    assert.deepEqual(issues.map((i) => i.line), [3]);
    const exported = parseItemTable(parseCsv(itemsToCsv([{ ...CSV_TEMPLATE_ROWS[0], images: ['https://a.com/1.jpg', 'https://a.com/2.jpg'] }])));
    assert.deepEqual(exported.rows[0].images, ['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  });

  it('reconoce existentes por código o por nombre sin acentos ni mayúsculas', () => {
    assert.equal(matchKey({ sku: ' CAF-1 ', name: 'x', type: 'product' }), 'sku:caf-1');
    assert.equal(matchKey({ sku: null, name: 'Café Latte', type: 'product' }), matchKey({ sku: null, name: 'cafe latte', type: 'product' }));
    assert.notEqual(matchKey({ sku: null, name: 'Clase', type: 'product' }), matchKey({ sku: null, name: 'Clase', type: 'service' }));
    // Sin columna de código en el archivo, el ítem guardado con código se reconoce por nombre (no se duplica).
    assert.equal(matchKey({ sku: 'CAF-1', name: 'Café', type: 'product' }, false), matchKey({ sku: null, name: 'café', type: 'product' }));
  });

  it('fórmulas: al exportar se neutralizan con apóstrofo (Excel no las ejecuta) y al reimportar vuelven tal cual', () => {
    const csv = toCsv([['nombre', 'nota'], ['=HYPERLINK("http://x")', '+52 55 1234'], ['-Promo', '@user'], ['Normal', "D'Angelo"]]);
    const lines = csv.replace(/^\ufeff/, '').trim().split('\r\n');
    assert.equal(lines[1], `"'=HYPERLINK(""http://x"")","'+52 55 1234"`);
    assert.equal(lines[2], `"'-Promo","'@user"`);
    assert.equal(lines[3], `Normal,D'Angelo`);
    assert.deepEqual(parseCsv(csv).slice(1), [['=HYPERLINK("http://x")', '+52 55 1234'], ['-Promo', '@user'], ['Normal', "D'Angelo"]]);
    // Un apóstrofo "de verdad" no se toca; sólo el que precede a un carácter de fórmula.
    assert.deepEqual(parseCsv("a\n'hola\n'=x"), [['a'], ["'hola"], ['=x']]);
  });

  it('la vista previa sabe qué columnas trae el archivo (las ausentes no se tocan al actualizar)', () => {
    const { columns, rows } = parseItemTable(parseCsv('nombre,precio\nCafé,35'));
    assert.deepEqual(columns, ['name', 'price']);
    assert.equal(rows[0].visible, true, 'sin la columna, la fila lleva el valor por defecto (sólo vale para los nuevos)');
  });

  it('importUpdatePatch: sólo cambia las columnas presentes y mantiene válido el precio anterior', () => {
    const row: Omit<ImportRow, 'line' | 'images'> = { name: 'Café', type: 'product', category: null, price: 40, compareAt: null, priceNote: null, sku: null, shortDescription: null, description: null, available: true, visible: true, featured: false, tags: [] };
    // Sólo nombre y precio: código, descripciones, visible, etiquetas… quedan como estaban.
    assert.deepEqual(importUpdatePatch(row, ['name', 'price'], { price: 30, compareAt: 50 }, 'cat-1'), { name: 'Café', price: 40, compare_at_price: 50 });
    // El precio sube por encima del anterior guardado: deja de ser oferta.
    assert.deepEqual(importUpdatePatch(row, ['name', 'price'], { price: 30, compareAt: 35 }, null), { name: 'Café', price: 40, compare_at_price: null });
    // Sólo precio anterior: se compara con el precio guardado.
    assert.deepEqual(importUpdatePatch({ ...row, compareAt: 60 }, ['name', 'compareAt'], { price: 30, compareAt: null }, null), { name: 'Café', compare_at_price: 60 });
    // Con todas las columnas, se escribe todo (como antes).
    const all = importUpdatePatch(row, ['name', 'type', 'category', 'price', 'compareAt', 'priceNote', 'sku', 'shortDescription', 'description', 'available', 'visible', 'featured', 'tags'], { price: null, compareAt: null }, 'cat-1');
    assert.deepEqual(all, { name: 'Café', type: 'product', category_id: 'cat-1', price: 40, compare_at_price: null, price_note: null, sku: null, short_description: null, description: null, is_available: true, is_visible: true, is_featured: false, tags: [] });
  });
});

describe('Ajuste masivo de precios', () => {
  it('porcentaje, monto y redondeos', () => {
    assert.equal(adjustPrice(100, { mode: 'percent', value: 10, rounding: 'none' }), 110);
    assert.equal(adjustPrice(48, { mode: 'percent', value: 10, rounding: 'unit' }), 53);
    assert.equal(adjustPrice(48, { mode: 'percent', value: 10, rounding: 'ten' }), 50);
    assert.equal(adjustPrice(52.8, { mode: 'amount', value: 0, rounding: 'nine' }), 49);
    assert.equal(adjustPrice(19.99, { mode: 'percent', value: -15, rounding: 'none' }), 16.99);
    assert.equal(adjustPrice(10, { mode: 'amount', value: -25, rounding: 'none' }), 0);
    assert.equal(adjustPrice(null, { mode: 'percent', value: 10, rounding: 'none' }), null);
  });

  it('regresión: "terminado en 9" no sube una rebaja ni baja un aumento', () => {
    // 5 − 10 % = 4.5: antes daba 9 (más caro que antes de la rebaja).
    assert.equal(adjustPrice(5, { mode: 'percent', value: -10, rounding: 'nine' }), 4.5);
    assert.equal(adjustPrice(3, { mode: 'amount', value: -1, rounding: 'nine' }), 2);
    assert.equal(adjustPrice(12, { mode: 'percent', value: -10, rounding: 'nine' }), 9);
    // 10 − 5 % = 9.5 → 9 (sigue siendo una rebaja).
    assert.equal(adjustPrice(10, { mode: 'percent', value: -5, rounding: 'nine' }), 9);
    // 100 + 1 % = 101 → 99 sería una rebaja: se queda en 100.
    assert.equal(adjustPrice(100, { mode: 'percent', value: 1, rounding: 'nine' }), 100);
    assert.equal(adjustPrice(100, { mode: 'percent', value: 10, rounding: 'nine' }), 109);
    // 49 − 0.5 = 48.5 → 49 con "unit": el redondeo puede anular una rebaja chica, pero nunca pasar del original.
    assert.equal(adjustPrice(49, { mode: 'amount', value: -0.5, rounding: 'unit' }), 49);
  });

  it('ajusta también opciones, mayoreo y precio programado (y quita el precio anterior si deja de ser mayor)', () => {
    const item = {
      price: 100,
      compareAtPrice: 105,
      attributes: {
        variants: { label: 'Tamaño', options: [{ id: 'a', name: 'Chico', price: 80, sku: null, available: true }, { id: 'b', name: 'Grande', price: null, sku: null, available: true }] },
        tiers: [{ minQty: 12, price: 90 }],
        nextPrice: { on: '2027-01-01', price: 110, timeZone: 'America/Mexico_City' },
      },
    };
    const up = adjustItemPrices(item, { mode: 'percent', value: 10, rounding: 'none' })!;
    assert.equal(up.price, 110);
    assert.equal(up.compareAtPrice, 115.5);
    assert.deepEqual(up.attributes.variants!.options.map((o) => o.price), [88, null]);
    assert.deepEqual(up.attributes.tiers, [{ minQty: 12, price: 99 }]);
    assert.equal(up.attributes.nextPrice!.price, 121);
    // El precio anterior (100.5 → 90.45 → 90 con "unit") ya no es mayor que el nuevo (90): deja de ser oferta.
    const down = adjustItemPrices({ ...item, compareAtPrice: 100.5 }, { mode: 'percent', value: -10, rounding: 'unit' })!;
    assert.equal(down.price, 90);
    assert.equal(down.compareAtPrice, null);
    // Sin ningún precio: nada que ajustar. Con precio sólo en una opción: sí.
    assert.equal(adjustItemPrices({ price: null, compareAtPrice: null, attributes: { variants: null, tiers: [], nextPrice: null } }, { mode: 'amount', value: 5, rounding: 'none' }), null);
    const onlyOption = adjustItemPrices({ price: null, compareAtPrice: null, attributes: { variants: { label: 'T', options: [{ id: 'a', name: 'A', price: 20, sku: null, available: true }] }, tiers: [], nextPrice: null } }, { mode: 'amount', value: 5, rounding: 'none' })!;
    assert.equal(onlyOption.price, null);
    assert.equal(onlyOption.attributes.variants!.options[0].price, 25);
  });

  it('rechaza ajustes fuera de rango o nulos', () => {
    assert.ok(isValidAdjustment({ mode: 'percent', value: -90, rounding: 'none' }));
    assert.ok(!isValidAdjustment({ mode: 'percent', value: -95, rounding: 'none' }));
    assert.ok(!isValidAdjustment({ mode: 'percent', value: 0, rounding: 'none' }));
    assert.ok(!isValidAdjustment({ mode: 'amount', value: Number.NaN, rounding: 'none' }));
  });
});

describe('Código QR y relacionados', () => {
  it('QR con los patrones de posición y SVG con zona tranquila', () => {
    const matrix = qrMatrix('https://x.test/catalogo/cafe');
    assert.equal(matrix.length % 4, 1); // 21, 25, 29…: tamaño válido de QR
    assert.deepEqual(matrix[0].slice(0, 7), [true, true, true, true, true, true, true]);
    assert.match(qrSvg('https://x.test'), /^<svg[^>]+viewBox="0 0 (\d+) \1"/);
  });

  it('relacionados: misma categoría primero, del mismo tipo y sin repetir el actual', () => {
    const site = buildSampleSite();
    const espresso = site.items.find((i) => i.name === 'Espresso doble')!;
    const related = relatedItems(site, espresso);
    assert.equal(related.length, 4);
    assert.ok(related.every((i) => i.id !== espresso.id && i.type === 'product'));
    assert.ok(related.slice(0, 3).every((i) => i.categoryId === espresso.categoryId));
  });
});
