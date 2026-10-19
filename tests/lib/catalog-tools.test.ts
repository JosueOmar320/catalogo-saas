import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { itemsToCsv, matchKey, parseCsv, parseItemTable, parsePriceCell, CSV_TEMPLATE_ROWS, MAX_IMPORT_ROWS } from '@/lib/catalog/csv';
import { adjustPrice, isValidAdjustment } from '@/lib/catalog/price-adjust';
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
      shortDescription: null, description: null, available: true, visible: true, featured: false, tags: ['caliente', 'grande'],
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

  it('reconoce existentes por código o por nombre sin acentos ni mayúsculas', () => {
    assert.equal(matchKey({ sku: ' CAF-1 ', name: 'x', type: 'product' }), 'sku:caf-1');
    assert.equal(matchKey({ sku: null, name: 'Café Latte', type: 'product' }), matchKey({ sku: null, name: 'cafe latte', type: 'product' }));
    assert.notEqual(matchKey({ sku: null, name: 'Clase', type: 'product' }), matchKey({ sku: null, name: 'Clase', type: 'service' }));
  });
});

describe('Ajuste masivo de precios', () => {
  it('porcentaje, monto y redondeos', () => {
    assert.equal(adjustPrice(100, { mode: 'percent', value: 10, rounding: 'none' }), 110);
    assert.equal(adjustPrice(48, { mode: 'percent', value: 10, rounding: 'unit' }), 53);
    assert.equal(adjustPrice(48, { mode: 'percent', value: 10, rounding: 'ten' }), 50);
    assert.equal(adjustPrice(52.8, { mode: 'amount', value: 0, rounding: 'nine' }), 49);
    assert.equal(adjustPrice(3, { mode: 'amount', value: 0, rounding: 'nine' }), 9);
    assert.equal(adjustPrice(19.99, { mode: 'percent', value: -15, rounding: 'none' }), 16.99);
    assert.equal(adjustPrice(10, { mode: 'amount', value: -25, rounding: 'none' }), 0);
    assert.equal(adjustPrice(null, { mode: 'percent', value: 10, rounding: 'none' }), null);
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
