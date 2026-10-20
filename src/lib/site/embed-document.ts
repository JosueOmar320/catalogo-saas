import { EMBED_MESSAGE, MAX_HTML_LENGTH } from './custom-code-config';

/**
 * Documento del widget. Avisa su altura al sitio (el sitio sólo acepta
 * mensajes de ESTE iframe y limita el valor). El script va en <head> para
 * que un HTML mal cerrado no lo rompa.
 */
export function embedDocument(code: string): string {
  const resize = `(function(){function s(){parent.postMessage({type:${JSON.stringify(EMBED_MESSAGE)},height:Math.ceil(document.body.scrollHeight)},'*')}addEventListener('load',s);addEventListener('DOMContentLoaded',function(){new ResizeObserver(s).observe(document.body);s()})})()`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;background:transparent}body{font-family:system-ui,sans-serif}</style><script>${resize}</script></head><body>${code.slice(0, MAX_HTML_LENGTH)}</body></html>`;
}
