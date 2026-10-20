import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countReview, isReviewFilter, REVIEW_FILTERS } from '@/features/items/review';
import { displayUrl, readableOn, shareMessages, wrapText } from '@/lib/share/kit';
import { nameFromFile } from '@/lib/catalog/photo-names';
import { APP_EN } from '@/i18n/en';
import { createTranslator } from '@/i18n/translate';
import { formatRelative } from '@/lib/utils/format';
import { labelsHtml } from '@/features/items/labels';
import { looksPersonal, topSearchMisses } from '@/lib/catalog/search-misses';
import { priceListText } from '@/site-renderer/price-list';
import { siteTranslator } from '@/site-renderer/site-i18n';

describe('Inicio del panel', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');

  it('fecha relativa en el idioma del usuario', () => {
    assert.equal(formatRelative('2026-10-19T11:59:40Z', 'es', now), 'ahora');
    assert.equal(formatRelative('2026-10-19T09:00:00Z', 'es', now), 'hace 3 horas');
    assert.equal(formatRelative('2026-10-18T12:00:00Z', 'es', now), 'ayer');
    assert.equal(formatRelative('2026-10-05T12:00:00Z', 'en', now), '2 weeks ago');
  });

  it('filtros de revisión', () => {
    const item = { hasImage: false, hasPrice: true, categoryId: null, isAvailable: true, isVisible: false };
    const matching = Object.entries(REVIEW_FILTERS).filter(([, f]) => f.test(item)).map(([key]) => key);
    assert.deepEqual(matching, ['sin-foto', 'sin-categoria', 'ocultos']);
    assert.ok(isReviewFilter('sin-foto'));
    assert.ok(!isReviewFilter('toString'));
    assert.ok(!isReviewFilter(['sin-foto']));
  });

  it('revisión: oferta vencida y sin descripción sólo cuentan si se manda el dato (el correo semanal no cambia)', () => {
    const base = { type: 'product' as const, hasImage: true, hasPrice: true, categoryId: 'c', isAvailable: true, isVisible: true };
    const counts = countReview([{ ...base, saleOver: true }, { ...base, hasDescription: false }, { ...base, hasDescription: true, saleOver: false }, base], true);
    assert.deepEqual([counts['oferta-vencida'].count, counts['sin-descripcion'].count], [1, 1]);
    assert.deepEqual(Object.entries(REVIEW_FILTERS).filter(([, f]) => f.test(base)).map(([key]) => key), []);
  });
});

describe('Kit para compartir', () => {
  it('mensajes listos con el enlace y el nombre, en el idioma del panel', () => {
    const es = shareMessages(createTranslator('es', null), 'Café Aurora', 'https://x.test/catalogo/cafe');
    assert.deepEqual(es.map((m) => m.id), ['whatsapp', 'status', 'bio']);
    // Expresión regular (no includes con la URL: CodeQL lo toma por una validación de URL incompleta).
    for (const m of es) assert.match(m.text, /(^|\s)https:\/\/x\.test\/catalogo\/cafe(\s|$)/);
    assert.match(es[1].text, /Café Aurora/);
    assert.equal(shareMessages(createTranslator('en', APP_EN), 'Café', 'https://x.test')[2].text, 'Order here: https://x.test');
    assert.equal(displayUrl('https://x.test/catalogo/cafe/'), 'x.test/catalogo/cafe');
  });

  it('parte el texto en líneas que caben y recorta con "…"', () => {
    const measure = (value: string) => value.length * 10; // 10 px por letra
    assert.deepEqual(wrapText('Haz tu pedido por WhatsApp', 120, measure), ['Haz tu', 'pedido por', 'WhatsApp']);
    assert.deepEqual(wrapText('uno dos tres cuatro cinco seis', 90, measure, 2), ['uno dos', 'tres…']);
    // Una palabra que no cabe (un enlace largo) se corta con "…" en vez de salirse.
    assert.deepEqual(wrapText('Supercalifragilístico', 50, measure), ['Supe…']);
  });

  it('texto blanco sobre colores oscuros y oscuro sobre claros', () => {
    assert.equal(readableOn('#1A1A1A'), '#ffffff');
    assert.equal(readableOn('#2F54D6'), '#ffffff');
    assert.equal(readableOn('#F5D76E'), '#111111');
  });
});

describe('Crear desde fotos', () => {
  it('sugiere el nombre del archivo e ignora los de cámara y WhatsApp', () => {
    assert.equal(nameFromFile('pastel-de-chocolate_2.jpg'), 'Pastel de chocolate 2');
    assert.equal(nameFromFile('croissant.PNG'), 'Croissant');
    assert.equal(nameFromFile('panDeMuerto.webp'), 'Pan De Muerto');
    for (const camera of ['IMG_1234.JPG', 'IMG_1234 (1).jpg', 'PXL_20261019_123456789.jpg', 'DSC0001.jpg', '2026-10-19 10.31.12.png', 'WhatsApp Image 2026-10-19 at 10.31.12.jpeg', 'Imagen de WhatsApp 2026-10-19 a las 10.31.12_ab12.jpg']) {
      assert.equal(nameFromFile(camera), '', camera);
    }
  });
});

describe('Búsquedas sin resultados, lista de precios y etiquetas', () => {
  it('no guarda lo que parece un dato personal', () => {
    assert.deepEqual(['pastel de chocolate', 'ana@correo.mx', '55 1234 5678', 'https://otro.sitio', 'café 340 g'].map(looksPersonal), [false, true, true, true, false]);
  });

  it('suma los días y ordena de más a menos buscado', () => {
    const rows = [
      { term: 'flan', searches: 2 },
      { term: 'pastel', searches: 1 },
      { term: 'flan', searches: 1 },
      { term: 'galletas', searches: 3 },
      { term: 'brownie', searches: 1 },
    ];
    assert.deepEqual(topSearchMisses(rows, 3), [
      { term: 'flan', searches: 3 },
      { term: 'galletas', searches: 3 },
      { term: 'brownie', searches: 1 },
    ]);
  });

  it('lista de precios en texto para WhatsApp, por categoría y en el idioma del sitio', () => {
    const groups = [
      { name: 'Café', items: [{ name: 'Espresso', price: '$45' }, { name: 'Latte', price: '$68', from: true }] },
      { name: 'Vacía', items: [] },
      { name: null, items: [{ name: 'Café para oficinas', price: null }] },
    ];
    assert.equal(
      priceListText(siteTranslator('es'), { businessName: 'Aurora', url: 'https://x.test/c', groups }),
      ['*Aurora* — Lista de precios', '', '*Café*\n• Espresso — $45\n• Latte — desde $68', '', '• Café para oficinas', '', 'Pide aquí: https://x.test/c'].join('\n'),
    );
    assert.match(priceListText(siteTranslator('en'), { businessName: 'Aurora', url: 'https://x.test/c', groups }), /^\*Aurora\* — Price list[\s\S]*• Latte — from \$68[\s\S]*Order here: https:\/\/x\.test\/c$/);
  });

  it('etiquetas con QR: una por producto, con el texto escapado', () => {
    const html = labelsHtml({ items: [{ name: 'Pan <dulce>', priceLabel: '$12', url: 'https://x.test/p/pan' }, { name: 'Flan', priceLabel: null, url: 'https://x.test/p/flan' }], businessName: 'Aurora & Co', title: 'Etiquetas', scanText: 'Escanea', lang: 'es' });
    assert.equal(html.match(/<section>/g)?.length, 2);
    assert.equal(html.match(/<svg /g)?.length, 2);
    assert.ok(html.includes('Pan &lt;dulce&gt;') && html.includes('Aurora &amp; Co'));
    assert.ok(!html.includes('<dulce>'));
  });
});
