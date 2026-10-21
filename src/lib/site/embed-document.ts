import { MAX_HTML_LENGTH } from './custom-code-config';
import { FX_CSS } from './fx';

/** Variables de color del sitio para el widget (sólo valores de color simples). */
const themeStyle = (vars: Record<string, string>) =>
  Object.entries(vars)
    .filter(([name, value]) => /^--c-[a-z-]+$/.test(name) && /^[#a-z0-9(),.%\s-]{1,60}$/i.test(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/**
 * Documento del widget. Avisa su altura al sitio (el sitio sólo acepta
 * mensajes de ESTE iframe y limita el valor). El script va en <head> para
 * que un HTML mal cerrado no lo rompa. Trae los colores del sitio
 * (var(--c-accent)…) y las clases de efectos fx-….
 */
export function embedDocument(code: string, vars: Record<string, string> = {}): string {
  // Script fijo (sin valores interpolados); el tipo del mensaje es EMBED_MESSAGE (lo comprueban las pruebas).
  const resize = `(function(){function s(){parent.postMessage({type:'vitrina:embed-height',height:Math.ceil(document.body.scrollHeight)},'*')}addEventListener('load',s);addEventListener('DOMContentLoaded',function(){new ResizeObserver(s).observe(document.body);s()})})()`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>:root{${themeStyle(vars)}}html,body{margin:0;background:transparent}body{font-family:system-ui,sans-serif;color:var(--c-text,inherit)}${FX_CSS}</style><script>${resize}</script></head><body>${code.slice(0, MAX_HTML_LENGTH)}</body></html>`;
}
