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
 *  · Avisa su altura al sitio (tipo EMBED_MESSAGE; el sitio sólo acepta los de
 *    ESTE iframe y limita el valor). Si la altura crece sola en ciclo, deja de avisar.
 *  · Con su propio scroll (pantalla completa o alto fijo), los enlaces #ancla
 *    desplazan dentro del widget.
 *  · En línea (data-mode="inline": alto automático, entre el menú y el pie del
 *    sitio) el widget no tiene scroll propio: es la página del sitio la que se
 *    desplaza. El sitio le avisa qué parte se ve (EMBED_VIEWPORT) y aquí se
 *    simula una ventana de ese tamaño para el código de la página:
 *      - 100vh (min-h-screen…) = alto de la ventana visible, no del widget;
 *      - lo position: fixed hijo de <body> (ventanas, avisos, «volver arriba»)
 *        va en una capa sobre la parte del widget que se ve; si al abrir una
 *        ventana grande casi no se ve el widget, la página se desplaza a él;
 *      - scrollY, innerHeight, getBoundingClientRect, clientY,
 *        IntersectionObserver y el evento scroll siguen a la página del sitio;
 *      - scrollTo, scrollIntoView y los #ancla piden al sitio desplazarse
 *        (EMBED_SCROLL), sólo justo después de un clic en el widget.
 */
const SHIM = `(function(){
var me=document.currentScript,inline=!!me&&me.getAttribute('data-mode')==='inline';
function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
try{document.cookie}catch(e){var c='';try{Object.defineProperty(document,'cookie',{get:function(){return c},set:function(v){var p=String(v).split(';')[0];c=c?c+'; '+p:p},configurable:true})}catch(_){}}
var rect0=Element.prototype.getBoundingClientRect;
function send(m){parent.postMessage(m,'*')}
var last=0,delta=0,same=0,stop=false;
function s(){if(stop||!document.body)return;var h=Math.ceil(document.body.scrollHeight);var d=h-last;if(d>0&&d===delta){if(++same>=3){stop=true;return}}else same=0;delta=d;last=h;send({type:'vitrina:embed-height',height:h})}
addEventListener('load',s);addEventListener('DOMContentLoaded',function(){if(window.ResizeObserver)new ResizeObserver(s).observe(document.body);s()});
if(!inline){
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href^="#"]'):null;if(!a||e.defaultPrevented)return;var id=a.getAttribute('href').slice(1);e.preventDefault();var el=id?document.getElementById(decodeURIComponent(id)):null;if(el)scrollTo({top:rect0.call(el).top+scrollY,behavior:'smooth'});else if(!id)scrollTo({top:0,behavior:'smooth'})});
return}
var off=0,vh=Math.round((screen.availHeight||800)*0.85);
function own(o,n){var d;while(o&&!(d=Object.getOwnPropertyDescriptor(o,n)))o=Object.getPrototypeOf(o);return d}
var innerD=own(window,'innerHeight');function realH(){return innerD&&innerD.get?innerD.get.call(window):document.documentElement.clientHeight}
function def(o,n,get,set){try{Object.defineProperty(o,n,{get:get,set:set,configurable:true})}catch(_){}}
def(window,'scrollY',function(){return off});def(window,'pageYOffset',function(){return off});
def(window,'innerHeight',function(){return vh});
def(document.documentElement,'clientHeight',function(){return vh});
def(document.documentElement,'scrollTop',function(){return off},function(v){go(+v,false)});
Element.prototype.getBoundingClientRect=function(){var r=rect0.call(this);return new DOMRect(r.x,r.y-off,r.width,r.height)};
[[window.MouseEvent,'clientY'],[window.MouseEvent,'y'],[window.Touch,'clientY']].forEach(function(p){var d=p[0]&&own(p[0].prototype,p[1]);if(d&&d.get)def(p[0].prototype,p[1],function(){return d.get.call(this)-off})});
['elementFromPoint','elementsFromPoint'].forEach(function(n){var f=document[n];if(f)document[n]=function(x,y){return f.call(document,x,y+off)}});
function active(){return!navigator.userActivation||navigator.userActivation.isActive}
function go(top,smooth){if(isFinite(top)&&active())send({type:'vitrina:embed-scroll',top:Math.round(top),smooth:!!smooth})}
function target(a,b){if(a&&typeof a==='object')return{top:a.top,smooth:a.behavior==='smooth'};return{top:b,smooth:false}}
window.scrollTo=window.scroll=function(a,b){var t=target(a,b);if(t.top!=null)go(+t.top,t.smooth)};
window.scrollBy=function(a,b){var t=target(a,b);if(t.top)go(off+ +t.top,t.smooth)};
var into=Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView=function(o){try{into.call(this,o&&typeof o==='object'?Object.assign({},o,{block:'nearest'}):{block:'nearest'})}catch(_){}
var r=rect0.call(this),b=o===false?'end':o&&o.block||'start',top=r.top,smooth=!!(o&&o.behavior==='smooth');
if(b==='center')top=r.top-(vh-r.height)/2;else if(b==='end')top=r.bottom-vh;else if(b==='nearest'){if(r.top>=off&&r.bottom<=off+vh)return;if(r.top>off)top=r.bottom-vh}
go(top,smooth)};
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href^="#"]'):null;if(!a||e.defaultPrevented)return;var id=a.getAttribute('href').slice(1);e.preventDefault();var el=id?document.getElementById(decodeURIComponent(id)):null;go(el?rect0.call(el).top:0,true)});
var layer=null,VH=/(-?\\d*\\.?\\d+)(?:s|l|d)?vh\\b/i,VHG=/(-?\\d*\\.?\\d+)(?:s|l|d)?vh\\b/gi;
function place(){if(!layer)return;var H=realH(),t=Math.max(0,off),h=Math.min(H,off+vh)-t,min=Math.min(vh,H,360);if(h<min){h=min;t=Math.max(0,Math.min(t,H-h))}layer.style.top=t+'px';layer.style.height=h+'px'}
function adopt(el){if(!el||el.nodeType!==1||el===layer||el.parentNode!==document.body||/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName))return;if(getComputedStyle(el).position!=='fixed')return;
if(!layer){layer=document.createElement('div');layer.setAttribute('data-vitrina-viewport','');layer.style.cssText='position:fixed;left:0;right:0;top:0;height:0;margin:0;padding:0;border:0;transform:translateZ(0);pointer-events:none;z-index:2147483000';document.body.appendChild(layer);place()}
layer.appendChild(el)}
function rewrite(st){for(var i=0;i<st.length;i++){var p=st[i],v=st.getPropertyValue(p);if(v&&VH.test(v))st.setProperty(p,v.replace(VHG,function(_,n){return'calc('+n+' * var(--vitrina-vh))'}),st.getPropertyPriority(p))}}
function walk(rules){for(var i=0;i<rules.length;i++){var r=rules[i];if(r.style)rewrite(r.style);if(r.cssRules)walk(r.cssRules)}}
function units(){for(var i=0;i<document.styleSheets.length;i++){try{walk(document.styleSheets[i].cssRules)}catch(_){}}
var els=document.querySelectorAll('[style*="vh"]');for(var j=0;j<els.length;j++)rewrite(els[j].style)}
var seen=new WeakMap();
function reveal(){if(!layer)return;var k=layer.children,fresh=false;for(var i=0;i<k.length;i++){var el=k[i],r=el.getClientRects().length?rect0.call(el):null,big=!!r&&r.width>=innerWidth*0.5&&r.height>=120;if(big&&seen.get(k[i])===false)fresh=true;seen.set(el,big)}
if(!fresh)return;var H=realH(),t=Math.max(0,off),h=Math.min(H,off+vh)-t;if(h<Math.min(vh,H)*0.6)go(off<0?0:Math.max(0,H-vh),true)}
function scan(){if(!document.body)return;var k=[].slice.call(document.body.children);for(var i=0;i<k.length;i++)adopt(k[i])}
document.documentElement.style.setProperty('--vitrina-vh',vh/100+'px');
var NativeIO=window.IntersectionObserver,watchers=[];
function margin(m){var p=String(m||'0px').trim().split(/\\s+/);while(p.length<4)p.push(p.length===1?p[0]:p.length===2?p[0]:p[1]);return p.map(function(x,i){var n=parseFloat(x)||0;return/%$/.test(x)?n/100*(i%2?innerWidth:vh):n})}
function VIO(cb,o){this.cb=cb;this.root=null;this.rootMargin=o.rootMargin||'0px';var t=o.threshold==null?[0]:[].concat(o.threshold);this.thresholds=t.slice().sort(function(a,b){return a-b});this.m=margin(o.rootMargin);this.targets=[];watchers.push(this)}
VIO.prototype.observe=function(el){if(this.targets.some(function(x){return x.el===el}))return;this.targets.push({el:el,last:null});later()};
VIO.prototype.unobserve=function(el){this.targets=this.targets.filter(function(x){return x.el!==el})};
VIO.prototype.disconnect=function(){this.targets=[]};
VIO.prototype.takeRecords=function(){return[]};
VIO.prototype.check=function(){var self=this,out=[],m=this.m,top=-m[0],bottom=vh+m[2],left=-m[3],right=innerWidth+m[1];
this.targets.forEach(function(x){var r=x.el.getBoundingClientRect(),shown=x.el.isConnected&&(r.width>0||r.height>0);
var it=Math.max(r.top,top),ib=Math.min(r.bottom,bottom),il=Math.max(r.left,left),ir=Math.min(r.right,right),hit=shown&&ib>=it&&ir>=il;
var area=r.width*r.height,ratio=hit?(area>0?Math.max(0,ib-it)*Math.max(0,ir-il)/area:1):0,step=0;
self.thresholds.forEach(function(t){if(hit&&ratio>=t)step++});
if(x.last&&x.last.step===step&&x.last.hit===hit)return;x.last={step:step,hit:hit};
out.push({target:x.el,isIntersecting:hit,intersectionRatio:ratio,boundingClientRect:r,intersectionRect:hit?new DOMRect(il,it,ir-il,ib-it):new DOMRect(0,0,0,0),rootBounds:new DOMRect(left,top,right-left,bottom-top),time:performance.now()})});
if(out.length)this.cb(out,this)};
if(NativeIO)window.IntersectionObserver=function(cb,o){o=o||{};return o.root?new NativeIO(cb,o):new VIO(cb,o)};
var queued=0;function later(){if(!queued)queued=requestAnimationFrame(function(){queued=0;scan();units();reveal();watchers.forEach(function(w){w.check()})})}
addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||d.type!=='vitrina:embed-viewport'||!isFinite(d.top)||!isFinite(d.height)||d.height<=0)return;
var resized=Math.round(d.height)!==vh,moved=Math.round(d.top)!==off;off=Math.round(d.top);vh=Math.round(d.height);
if(resized)document.documentElement.style.setProperty('--vitrina-vh',vh/100+'px');place();
if(resized)dispatchEvent(new Event('resize'));if(moved||resized)document.dispatchEvent(new Event('scroll',{bubbles:true}));watchers.forEach(function(w){w.check()})});
addEventListener('resize',place);
addEventListener('DOMContentLoaded',function(){scan();units();new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style'],characterData:true})});
addEventListener('load',later);
})()`;

const head = (vars: Record<string, string>, base: boolean, inline: boolean) =>
  `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><script${inline ? ' data-mode="inline"' : ''}>${SHIM}</script><style>:root{${themeStyle(vars)}}${base ? 'html,body{margin:0;background:transparent}body{font-family:system-ui,sans-serif;color:var(--c-text,inherit)}' : ''}:where([data-vitrina-viewport])>*{pointer-events:auto}${FX_CSS}</style>`;

/**
 * Documento del widget. Un fragmento va dentro de un documento con los
 * colores del sitio (var(--c-accent)…), sus estilos base y las clases de
 * efectos fx-…. Una página completa (<!doctype>/<html>) se usa tal cual: sólo
 * se le agrega al inicio del <head> lo de la plataforma (sin pisar su diseño).
 * `inline`: alto automático dentro de la página del sitio (ver SHIM).
 */
export function embedDocument(code: string, vars: Record<string, string> = {}, { inline = false }: { inline?: boolean } = {}): string {
  const source = code.slice(0, MAX_EMBED_LENGTH);
  if (!isFullDocument(source)) return `<!doctype html><html><head>${head(vars, true, inline)}</head><body>${source}</body></html>`;
  const inject = head(vars, false, inline);
  if (/<head[\s>]/i.test(source)) return source.replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}${inject}`);
  return source.replace(/<html(\s[^>]*)?>/i, (tag) => `${tag}<head>${inject}</head>`);
}
