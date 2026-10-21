import { qrSvg } from '@/lib/qr';
import { escapeHtml } from '@/lib/utils/text';

/**
 * Etiquetas para imprimir (anaquel, mostrador, vitrina): nombre, precio y un
 * código QR que abre la ficha del producto en el sitio. HTML de una página
 * con estilos de impresión; los textos llegan ya traducidos y se escapan.
 */
export type LabelItem = { name: string; priceLabel: string | null; url: string };

export function labelsHtml({ items, businessName, title, scanText, lang }: { items: LabelItem[]; businessName: string; title: string; scanText: string; lang: string }): string {
  const labels = items
    .map(
      (item) => `<section><div class="text"><h2>${escapeHtml(item.name)}</h2>${item.priceLabel ? `<p class="price">${escapeHtml(item.priceLabel)}</p>` : ''}<p class="scan">${escapeHtml(scanText)}</p><p class="brand">${escapeHtml(businessName)}</p></div>${qrSvg(item.url)}</section>`,
    )
    .join('');
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{size:auto;margin:10mm}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;margin:0}main{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm}section{break-inside:avoid;display:flex;align-items:center;justify-content:space-between;gap:4mm;border:1px dashed #999;border-radius:3mm;padding:4mm 5mm;min-height:38mm}.text{min-width:0}h2{margin:0 0 1.5mm;font-size:14pt;line-height:1.2}.price{margin:0 0 2mm;font-size:18pt;font-weight:700}.scan{margin:0;font-size:9pt;color:#444}.brand{margin:1mm 0 0;font-size:8pt;color:#777}svg{width:30mm;height:30mm;flex-shrink:0}</style></head>
<body><main>${labels}</main></body></html>`;
}
