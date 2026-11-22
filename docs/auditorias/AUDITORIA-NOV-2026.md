# Auditoría de producto, diseño y delta técnico (22-nov-2026)

Segunda auditoría integral, un mes después de la de octubre ([AUDITORIA-OCT-2026.md](AUDITORIA-OCT-2026.md)). Cubre las 30 PRs mezcladas desde entonces (#47–#77: respuestas a reseñas, historial del sitio, clientes, avisos push, analítica, código completo y tablas, widget en línea, menú del catálogo, funciones por negocio, estudio de PDF, dominios propios, cuenta demo) y, por primera vez, la experiencia de producto y el diseño con la metodología de Impeccable. **Nada se ha confirmado en Git**: todo está en el working tree de `main`.

## A. Descripción del proyecto

Vitrina es un SaaS multi-tenant (Next.js 16 App Router, React 19, TypeScript estricto, Supabase con RLS, Zod 4, MUI 9 en el panel, react-pdf) con el que un negocio pequeño arma sin código su sitio web con catálogo, recibe pedidos por WhatsApp y descarga el mismo catálogo en PDF. Un administrador de la plataforma crea cuentas y negocios; un asistente (Garfield) edita a partir de lenguaje natural. Arquitectura: un `SiteViewModel` único renderizado en React (web) y react-pdf (PDF); Server Actions con `requireBusinessContext` + Zod; la base de datos como última línea (RLS, claves compuestas, funciones `SECURITY DEFINER` con `search_path` vacío); catálogo público estático (ISR) sin Zod en el navegador.

Estado al empezar: typecheck y lint limpios, 472 pruebas unitarias, 436 de base de datos, 51 E2E públicas y 48 con sesión pasando; Next.js 16.4.3 con siete avisos de seguridad publicados; sin `PRODUCT.md` ni `DESIGN.md`.

## B. Hallazgos (clasificados)

### Críticos
| Hallazgo | Evidencia | Estado |
| --- | --- | --- |
| **Derribo de dominios ajenos por el alias www/apex.** La unicidad de `custom_domain` era por cadena exacta; Vercel responde 409 «ya está en el proyecto» y se tomaba como éxito; al desconectar se borraba el dominio y su contraparte www/apex. B registra `www.mitienda.com` de A → A queda fuera de línea. | `domain-actions.ts`, `lib/domains/vercel.ts`, migración `20261109` | Corregido (columna `custom_domain_apex` única, 409 sólo es éxito si el registro es el propio, el dominio previo se quita después de guardar). |
| **Next.js 16.4.3 vulnerable** (exposición de cookies HttpOnly en rutas Edge, bypass de SVG en el optimizador de imágenes, fugas de caché en `use cache`…). | `npm audit`, aviso del overlay de desarrollo | Corregido: 16.4.6; CI exige `--audit-level=moderate`. |

### Altos
| Hallazgo | Evidencia | Estado |
| --- | --- | --- |
| La función «Pedidos y clientes» apagada por el administrador sólo se respetaba en el panel: el sitio seguía pidiendo WhatsApp y guardando copia y teléfono 180 días sin interfaz para verlos; los avisos push seguían llegando. | `order/config.ts`, `record_order_v2`, `claim_order_push` | Corregido (gate en SQL, `orders_enabled` en el catálogo público, view-model fuerza `inbox=false`). |
| Lecturas de estadísticas truncadas en silencio por `max_rows = 1000` de PostgREST (`.limit(5000|20000)` no hace nada): totales y «lo más visto» incorrectos con más de 1 000 filas día×ítem. | `features/analytics/queries.ts`, `views/queries.ts`, `orders/queries.ts`, `api/stats/export` | Corregido (RPC `analytics_summary` e `item_performance` agregan en SQL; `fetchAllRows` donde se listan filas). |
| El estudio de PDF agotaba el límite compartido de 30 solicitudes/10 min con su vista previa automática y luego «Descargar» fallaba. | `api/catalogs/[id]/pdf/route.ts` | Corregido (cubos separados: vista previa 120, descarga 30). |
| El panel de filtros del catálogo robaba el foco en cada tecla (efecto con `onClose` inline): escribir «10» perdía el «0». | `site-renderer/sections/catalog-parts.tsx` | Corregido (`useEffectEvent`, foco sólo al cerrar). |
| La sección Tabla desalineaba celdas y columna destacada cuando una columna intermedia quedaba vacía; web ≠ editor ≠ PDF. | `TableSection.tsx`, `lib/site/table.ts` | Corregido (índices originales; `highlight` viaja con la columna). |
| **Landing**: el marco del sitio de ejemplo era un scroller de 560 px con 5 315 px dentro (trampa de scroll en móvil y escritorio), duplicaba `h1`, `main` y `nav`, y sumaba 38 paradas de tabulación. | `app/page.tsx`, `landing.module.css` | Corregido (vista recortada e `inert`, enlace a la demo, skip link). |
| **Panel**: la bienvenida nunca se mostraba (`?bienvenida=demo` vs `welcome`); en teléfono el alta de producto dejaba «Crear» cuatro pantallas arriba, la barra superior se rompía y la lista perdía precio y existencias; «Avisos de pedidos» con un error irresoluble se interponía antes de los pedidos. | `dashboard/page.tsx`, `ItemForm.tsx`, `PublishControl.tsx`, `ItemsTable.tsx`, `pedidos/page.tsx` | Corregido. |

### Medios (corregidos)
Reserva de dominios sin dueño (límite 5/h y liberación de pendientes a los 14 días desde el cron); subdominios de la plataforma o de otro negocio rechazados; purga de demos que dejaba archivos huérfanos (>1 000); `purge_old_data` no limpiaba la analítica desde pg_cron; `register_push_subscription` borraba la suscripción de otro usuario con el mismo endpoint; `site_versions` sin tope de bytes; rutas con sesión fuera del proxy y el host de la plataforma tratado como dominio ajeno si `NEXT_PUBLIC_SITE_URL` difería; `customCode` de Garfield confiado al cliente; `save_site` releía la versión en otro viaje (ventana de pisado); guardado del PDF «último gana» y error 23514 sin mensaje; cuatro patrones de guardar en el panel y «Guardar» duplicado; menú de 24 filas sin filtrar por rol (un `editor` veía 11 entradas que terminan en un botón gris); inicio con módulos repetidos y tres botones azules; contorno de encabezados h1→h3→h6; menú móvil del sitio sin `aria-modal`, sin foco atrapado ni bloqueo de scroll; mensajes `vitrina:embed-scroll` aceptados sin interacción (secuestro de scroll); `toLocaleString()` sin idioma en la analítica (desajuste de hidratación); diálogo de versiones sin estado de error; formulario de pedidos sin aviso de cambios sin guardar; cerrar sesión no cancelaba la suscripción push del dispositivo; cancelar pedido, rechazar reseña y quitar respuesta sin confirmación; eyebrows ilegibles en presets con acento claro (2.1:1).

### Bajos (corregidos)
Hex fijos en estrellas y chip destacado; «Badges», «Garfield AI», plurales «(s)»; copia de «Dominio propio» con campo deshabilitado; cifras de la landing desactualizadas («21 secciones», «300+ pruebas»); sin estados hover/active/disabled en la landing; `.demoError` fuera de variables; `<dl>` invertido; enlaces de sección invisibles en móvil; objetivos táctiles de 25–31 px.

### Abiertos (documentados, no corregidos)
- El enlace profundo del aviso push no lleva el negocio (`?negocio=` no existe como ruta): con dos negocios se abre la bandeja del activo.
- Identidad de cliente por nombre en minúsculas sin teléfono (une homónimos, separa «José»/«Jose»); los totales de cliente encogen a 180 días al borrarse el teléfono.
- Cortes de día en UTC en analítica y contadores frente a zona del negocio en CSV e «Hoy».
- Horarios nocturnos en cambios de horario de verano (día de 1 440 min).
- `max_members` por plan nunca se aplica; `types/database.ts` sigue a mano; `ItemsTable` sin virtualización.
- La landing no muestra «Pide tu acceso» hasta que el operador defina `NEXT_PUBLIC_CONTACT_URL` (WhatsApp, correo o formulario): no se inventó un canal.

## C. Mejoras implementadas

**Base y seguridad** (`supabase/migrations/20261123000000_delta_hardening.sql`, aditiva, 468 pruebas de base de datos): `analytics_summary`, `item_performance`, `stale_pending_domains`, `purge_old_data` + analítica con la misma fecha UTC, `register_push_subscription` por dueño, `prune_site_versions` con tope de 50 MB, `businesses.custom_domain_apex` + índice único, `record_order_v2`/`claim_order_push`/`get_public_catalog` con la función `orders`, `save_site` devuelve `timestamptz`. App: `domain-actions.ts` (límite, apex, orden de borrado, 23505 sin tocar Vercel), `vercel.ts` (409 estricto), `demo/server.ts` (paginación de Storage), `proxy.ts` (rutas con sesión, host de plataforma), `instrumentation.ts` (aviso de host en producción), `api/assistant` (`customCode` del servidor), `pdf/route.ts` (dos cubos), `pdf/actions.ts` (`expectedUpdatedAt`), `builder/actions.ts` (versión devuelta), cron (`domainsExpired`).

**Panel** (`src/components/**`, `src/features/*/components/**`, `src/app/dashboard/**`, `src/i18n/en/ux.ts`): bienvenida con siguiente paso; `SaveBar` como único control de guardado (también al crear, con «Guardar y agregar otro»); «Ver en el sitio» desde el producto; control de publicación compacto en `xs` con la razón visible; precio y existencias en la fila móvil; avisos de pedidos como una fila bajo las pestañas y sólo si el servidor los soporta; confirmaciones en cancelar pedido, rechazar reseña y quitar respuesta; menú por rol (`manageOnly`) y grupo «Catálogo»; inicio sin «Accesos rápidos», un solo «Abrir el editor», plan en una línea, gráfica en grises con «Hoy» en azul; `SectionCard` con `h2`; estrellas con `warning.main`; «Insignias», «Garfield», plurales; error visible al activar avisos; baja de push al cerrar sesión.

**Sitio público** (`src/site-renderer/**`): `useEffectEvent` en el panel de filtros; tabla con índices originales; menú móvil como diálogo modal con `inert` y bloqueo de scroll; `embed-scroll` sólo tras interacción y acotado; `--c-accent-ink` (acento legible sobre el fondo, `ensureContrast` en `lib/design/color.ts`) para eyebrows; analítica con `Intl.NumberFormat` por idioma; diálogo de versiones con error y reintento; aviso de cambios sin guardar en pedidos.

**Landing** (`src/app/page.tsx`, `landing.module.css`, `i18n/en/landing.ts`): sin eyebrows; lead para la audiencia; un primario y un secundario; tres frases de valor en vez de cifras de inventario; marco del sitio recortado, inerte y con enlace a la demo; «Ver un PDF de ejemplo» dentro de la tarjeta de PDF; «Ver el código» en la sección técnica; cierre dirigido a la dueña («¿Quieres Vitrina para tu negocio?») con «Pide tu acceso» configurable; enlaces de sección en móvil; estados hover/active/disabled; objetivos de 34–44 px; skip link.

**Plataforma y documentación**: Next.js 16.4.6; `npm run dev:local` + `scripts/dev-local.mjs` + configuración `web-local` (panel contra Supabase local); `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` (9 componentes), `.impeccable/live/config.json`; CI con `audit-level=moderate`; CONTRIBUTING, CHANGELOG y `.env.example` (`NEXT_PUBLIC_CONTACT_URL`).

## D. Diseño con Impeccable

Se ejecutaron `init` (PRODUCT.md confirmado con el usuario: dueño de negocio pequeño como usuario principal, «un modelo, web + PDF» como diferencia, nombre y logo fijos, sin pagos, sin clientes reales), `document` (DESIGN.md con el norte «La vitrina en blanco», azul tinta como único acento, regla del borde, regla del 14, componentes y sidecar) y dos `critique` con agentes aislados (revisión de diseño + detector/evidencia en navegador):

| Superficie | Puntaje | Problemas P0/P1 |
| --- | --- | --- |
| Landing (`/`, persuadir) | 19 / 32 (7 y 10 n/a) | trampa de scroll; estructura accesible rota; sin siguiente paso para la dueña |
| Panel (`/dashboard`, operar) | 27 / 40 | bienvenida que no aparece; alta de producto y barra en el celular; avisos antes de los pedidos |

Las correcciones de la sección C siguen DESIGN.md (sin sombras, un primario por pantalla, 6 px, 14 px, variables en vez de hex) y el `craft-floor` de Impeccable (sin eyebrows, estados reales, objetivos táctiles). Los hallazgos del detector sobre `html-examples.ts` y los documentos de impresión son contenido, no interfaz; los dos de `tests/lib/full-page-and-table.test.ts` se ignoraron con ámbito de archivo. Las dos críticas quedaron guardadas en `.impeccable/critique/` para medir el siguiente `/impeccable critique`.

## E. Pruebas y validación (resultados reales)

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck`, `npm run lint` | OK, 0 avisos |
| `npm run test:unit` | 488 / 488 (antes 472) |
| `npm run test:db` (PGlite, 29 migraciones) | 468 / 468 (antes 436) |
| `npm run build` (Next.js 16.4.6) | OK |
| `npm run test:e2e` (escritorio + móvil, sin Supabase, como CI) | 59 / 59, axe sin problemas en landing, login y sitio de ejemplo |
| `npm run test:e2e:app` (Supabase local en Docker, base reiniciada) | 49 / 49 (cuatro aserciones actualizadas a la copia nueva: plural «1 producto sin precio», fila de avisos ausente sin VAPID, sin formulario de dominio con la función apagada, dos botones «Probar el panel» en la landing) |
| `npm audit --omit=dev --audit-level=moderate` | 0 vulnerabilidades (antes 1 moderada con 7 avisos en Next.js) |
| `impeccable detect` | 0 hallazgos en la landing; en el panel sólo reglas de tokens sobre contenido de ejemplo y documentos de impresión |

No se pudo ejecutar: pruebas contra los proyectos de Supabase en la nube (por diseño); una medición de carga; la verificación manual de Vercel para los dominios (los helpers se probaron con `fetch` simulado).

## F. Pendientes y siguientes pasos

1. **Aplicar `20261123000000_delta_hardening.sql` en DEV y PROD** junto con el despliegue (cambia la firma de `save_site`; la app nueva contra la base vieja guarda sin verificación). Después: `select custom_domain_apex, count(*) from businesses group by 1 having count(*) > 1` (si hay dos negocios con la misma raíz, el índice único se omite con un aviso).
2. Definir `NEXT_PUBLIC_CONTACT_URL` en Vercel para que la landing ofrezca «Pide tu acceso».
3. Los abiertos de la sección B: enlace push por negocio, identidad de clientes, zona horaria de los cortes diarios, DST, `max_members`, tipos generados en CI, virtualización de la lista.
4. Repetir `/impeccable critique` sobre la landing y el panel tras un ciclo de uso real para medir el cambio de puntaje.

## G. Valoración

Antes: una base técnica sólida (RLS, pruebas, CI) con un producto que había crecido 13 700 líneas en un mes y acumulaba contradicciones entre capas (funciones apagadas sólo en el panel, estadísticas incorrectas por el tope de PostgREST, un derribo de dominios posible), una landing que hablaba al ingeniero y un panel que funcionaba en escritorio y se desarmaba en el celular. Después: las contradicciones conocidas están cerradas con pruebas, la plataforma tiene su verdad de producto y su sistema visual escritos, y la landing y el panel siguen una misma línea. No es «listo para producción» sin aplicar la migración ni sin probar los dominios contra Vercel real; sí es un producto medible: 19/32 y 27/40 son los puntos de partida de las próximas críticas.
