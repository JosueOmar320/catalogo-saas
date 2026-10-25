import { isFullDocument, MAX_EMBED_LENGTH } from './custom-code-config';
import { FX_CSS } from './fx';

/** Variables de color del sitio para el widget (sólo valores de color simples). */
const themeStyle = (vars: Record<string, string>) =>
  Object.entries(vars)
    .filter(([name, value]) => /^--c-[a-z-]+$/.test(name) && /^[#a-z0-9(),.%\s-]{1,60}$/i.test(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/**
 * Script fijo de la plataforma (sin valores interpolados), antes que el código del negocio:
 *  · localStorage, sessionStorage y cookies en memoria: en el aislamiento (origen
 *    opaco) el navegador los niega y muchas páginas dejan de funcionar por eso.
 *  · Los enlaces #ancla desplazan dentro del widget (no abren otra pestaña ni
 *    mueven la página del sitio, como haría scrollIntoView).
 *  · Avisa su altura al sitio (tipo EMBED_MESSAGE; el sitio sólo acepta los de
 *    ESTE iframe y limita el valor). Si la altura crece sola en ciclo (algo
 *    mide 100vh, que es la altura del propio widget), deja de avisar.
 */
const SHIM = `(function(){
function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
try{document.cookie}catch(e){var c='';try{Object.defineProperty(document,'cookie',{get:function(){return c},set:function(v){var p=String(v).split(';')[0];c=c?c+'; '+p:p},configurable:true})}catch(_){}}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href^="#"]'):null;if(!a)return;var id=a.getAttribute('href').slice(1);e.preventDefault();var el=id?document.getElementById(decodeURIComponent(id)):null;if(el)scrollTo({top:el.getBoundingClientRect().top+scrollY,behavior:'smooth'});else if(!id)scrollTo({top:0,behavior:'smooth'})});
var last=0,delta=0,same=0,stop=false;
function s(){if(stop||!document.body)return;var h=Math.ceil(document.body.scrollHeight);var d=h-last;if(d>0&&d===delta){if(++same>=3){stop=true;return}}else same=0;delta=d;last=h;parent.postMessage({type:'vitrina:embed-height',height:h},'*')}
addEventListener('load',s);addEventListener('DOMContentLoaded',function(){if(window.ResizeObserver)new ResizeObserver(s).observe(document.body);s()});
})()`;

const head = (vars: Record<string, string>, base: boolean) =>
  `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><script>${SHIM}</script><style>:root{${themeStyle(vars)}}${base ? 'html,body{margin:0;background:transparent}body{font-family:system-ui,sans-serif;color:var(--c-text,inherit)}' : ''}${FX_CSS}</style>`;

/**
 * Documento del widget. Un fragmento va dentro de un documento con los
 * colores del sitio (var(--c-accent)…), sus estilos base y las clases de
 * efectos fx-…. Una página completa (<!doctype>/<html>) se usa tal cual: sólo
 * se le agrega al inicio del <head> lo de la plataforma (sin pisar su diseño).
 */
export function embedDocument(code: string, vars: Record<string, string> = {}): string {
  const source = code.slice(0, MAX_EMBED_LENGTH);
  if (!isFullDocument(source)) return `<!doctype html><html><head>${head(vars, true)}</head><body>${source}</body></html>`;
  const inject = head(vars, false);
  if (/<head[\s>]/i.test(source)) return source.replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}${inject}`);
  return source.replace(/<html(\s[^>]*)?>/i, (tag) => `${tag}<head>${inject}</head>`);
}
