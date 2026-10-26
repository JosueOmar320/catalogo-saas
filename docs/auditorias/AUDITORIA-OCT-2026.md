# Auditoría integral y endurecimiento (21-oct-2026)

Auditoría de todo el sistema (arquitectura, seguridad, base de datos, lógica de negocio, interfaz, rendimiento, pruebas y CI) seguida de la implementación de las mejoras en el mismo árbol de trabajo. **Nada se ha confirmado en Git**: todos los cambios están en el working tree de `main` para revisarlos y confirmarlos.

## A. Resumen ejecutivo

**Estado previo.** Un producto maduro con cuatro auditorías anteriores: RLS en todas las tablas, funciones `SECURITY DEFINER` con `search_path` vacío, privilegios por columna, anti-SSRF, límites de intentos en Postgres, CI con acciones fijadas por SHA. Typecheck, lint, 349 pruebas unitarias, 270 de base de datos y 57 E2E públicas pasaban.

**Debilidades más importantes encontradas** (todas confirmadas leyendo el código y, en su mayoría, reproducidas con pruebas):

1. **Bucle de redirecciones** para una cuenta desactivada o bloqueada con sesión viva (`/dashboard` → `/login?error=disabled` → `/dashboard`…).
2. **Inyección de fórmulas en CSV**: el nombre, la dirección y la nota que escribe un visitante al pedir llegaban tal cual al CSV que el negocio abre en Excel.
3. **Existencias infladas**: cancelar un pedido devolvía la cantidad pedida, no la descontada (stock 2, pedido de 5 → confirmar → 0 → cancelar → 5).
4. **Importar CSV borraba campos**: un archivo con sólo `nombre,precio` dejaba los ítems sin categoría, código, descripción ni etiquetas, y los volvía visibles; sin columna de código, creaba duplicados.
5. **Garfield perdía datos al editar un producto**: "sube el precio a 50" borraba el costo privado, la temporada y el precio programado.
6. **Guardados cruzados en el editor**: dos personas editando el sitio se pisaban en silencio (`save_site` sin versión).
7. **Zod en el bundle público** (~100 KB de validación en cada visita), contradiciendo el README; la sección de catálogo enviaba el sitio completo al navegador y las pantallas de error cargaban todo el catálogo de traducciones.
8. **Datos personales sin caducar**: la limpieza a los 180 días sólo corría cuando ese negocio recibía otro pedido; sin retención en auditoría, rate limit ni estadísticas.
9. **CSS propio que escapaba del sitio** (`~ *`, `position: fixed`) y podía tapar el panel en la vista previa o esconder la marca de la plataforma.
10. **Reglas contradictorias entre capas**: "sin precio" calculado de tres formas, sitemap con productos que dan 404, PDF con productos fuera de temporada, ajuste masivo de precios que no tocaba opciones ni mayoreo, tipo de sitio "web" aplicado sólo en el panel.

**Mejoras más valiosas implementadas**: todas las anteriores corregidas con pruebas de regresión; una migración aditiva (`20261102000000_hardening.sql`) con retención, versión del sitio, existencias exactas, topes de tamaño, privilegios por columna y candados; el sitio público sin Zod y con un modelo recortado para la cuadrícula; cuatro rutas de API unificadas; CI con caché de navegadores y umbrales de cobertura; documentación sincronizada.

**Estado final.** Typecheck y lint limpios; **395** pruebas unitarias (+46), **309** de base de datos (+39), **57** E2E públicas y las E2E con sesión (ver F). Cobertura de los módulos probados: 93,7 % líneas / 85,5 % ramas, con umbrales 85/75/75 en CI.

## B. Hallazgos y correcciones

### Seguridad

| Problema | Por qué importaba | Solución | Archivos | Validación |
| --- | --- | --- | --- | --- |
| Bucle `/login` ↔ `/dashboard` con cuenta desactivada o bloqueada en Auth (el JWT sigue válido hasta expirar). | La persona ve `ERR_TOO_MANY_REDIRECTS` en vez del aviso. | El proxy cierra la sesión local cuando llega `?error=disabled` o `getUser()` rechaza el JWT, y muestra el login. | `src/lib/supabase/proxy.ts` | Traza de código; typecheck. Sin prueba automática (requiere Auth real). |
| Inyección de fórmulas en CSV (ALTA): `=HYPERLINK(...)`, `=cmd\|...` desde `/api/orders` (anónimo) al CSV de pedidos. | Ejecución o exfiltración al abrir el export en Excel/LibreOffice. | `escapeCell` antepone `'` y entrecomilla las celdas que empiezan con `= + - @ \t \r`; `parseCsv` lo quita al reimportar. | `src/lib/catalog/csv.ts` | `tests/lib/catalog-tools.test.ts` (fórmulas + ida y vuelta). |
| CSS propio escapaba del sitio: `~ * {}` → `[data-site] ~ *`; `position: fixed` permitido en `<style>` y CSS del sitio (sólo bloqueado en línea). | La vista previa del editor vive en el mismo documento que el panel: un overlay a pantalla completa con "tu sesión expiró" sobre `/dashboard`. | Se descartan selectores que empiezan con `> + ~ & \|`; se quita `position: fixed`; `contain: paint` en `.customHtml` y en el contenedor de la vista previa. | `src/lib/site/custom-code.ts`, `site.module.css`, `BuilderPreview.tsx` | `tests/lib/custom-code.test.ts`. |
| Marca "Sitio creado con…" ocultable con CSS propio sin `remove_branding`. | Función de pago evitable. | La marca se dibuja fuera de `[data-site]` (hermano del sitio), fuera del alcance del CSS limitado. | `src/site-renderer/SiteShell.tsx`, `SiteFooter.tsx`, `catalogo/[slug]/layout.tsx` | Typecheck; E2E públicas. |
| `/api/catalogs/[id]/pdf` sin tope de cuerpo ni límite de solicitudes; descarga en abanico de imágenes. | Coste/CPU por un miembro que repite la vista previa. | Tope 256 KB, `consumeRateLimit('pdf:<user>', 30, 600)`, 404 para sitios sin catálogo, cabecera `X-Pdf-Marks` saneada. | `src/app/api/catalogs/[catalogId]/pdf/route.ts` | Typecheck; revisión manual. |
| Perfiles de compañeros legibles por la API (`profiles: team read`: email, rol, estado, último acceso); la app nunca lista al equipo. | Fuga de datos entre miembros. | Política eliminada. | migración 20261102 | `rls.test.mjs` (Juan sólo ve su perfil). |
| `business_id`/`catalog_id`/`item_id` actualizables por la API en tablas de contenido (un usuario miembro de dos negocios podía mover filas). | Fuga entre inquilinos. | Privilegios de UPDATE por columna en `categories`, `catalog_items`, `catalog_item_images`, `catalog_pages`. | migración 20261102 | `rls.test.mjs` (miembro doble no puede mover; renombrar, reordenar y `save_site` siguen). |
| Clave del límite de login divisible (`ana` y `ana@usuarios.invalid`). | 20 intentos en vez de 10. | Se normaliza el sufijo interno antes de la clave. | `src/features/auth/actions.ts`, `src/lib/auth/username.ts` | Typecheck. |
| Cron: comparación por longitud de cadena + `timingSafeEqual` → `RangeError` 500 con bytes multibyte. | Robustez. | Comparación de resúmenes SHA-256. | `src/app/api/cron/catalog-review/route.ts` | E2E pública (401 sin secreto). |
| Errores del proveedor de IA registrados completos (pueden incluir el prompt). | PII en logs. | `logAssistantError`: tipo, estado y mensaje recortado. | `src/features/assistant/server/guard.ts` + 3 rutas | Typecheck. |
| `replace_media_references` aceptaba cualquier texto en `p_old`/`p_new` (reemplazo sobre el JSON del sitio). | Corrupción del propio sitio. | Validación de forma (ruta de Storage o URL https). | migración 20261102 | `rls.test.mjs`. |
| `get_public_reviews` no limitaba el producto al catálogo publicado. | Reseñas de otro catálogo del negocio. | `and i.catalog_id = c.id`. | migración 20261102 | `rls.test.mjs`. |

### Integridad de datos y base de datos

| Problema | Solución | Validación |
| --- | --- | --- |
| Existencias infladas al cancelar (`greatest(0, …)` al descontar, suma completa al devolver). | `orders.stock_deltas` guarda lo descontado por producto; se devuelve exactamente eso (pedidos anteriores a la migración conservan el comportamiento antiguo). | `rls.test.mjs`: stock 2, pedido 5 → 0 → cancelar → 2. |
| `save_site` sin control de concurrencia (último en guardar gana). | `site_version(catálogo)` + `save_site(…, p_expected_version)`; `site_changed` → "Otra persona modificó el sitio". El editor carga la versión y guarda la nueva tras cada guardado. | `rls.test.mjs` (versión vieja rechazada, actual aceptada, borrado avanza la versión); typecheck. |
| Cada guardado del sitio escribía ~2N+1 filas de auditoría por los pasos transitorios (slug temporal, quitar inicio). | `vitrina.skip_audit` en los pasos transitorios; sólo se tocan las páginas que cambian de slug o de inicio. | `rls.test.mjs`: 3 páginas, 1 título cambiado → 1 fila con `changed: ['title']`; guardado sin cambios → 0 filas. |
| Limpieza de datos personales sólo por negocio activo; sin retención en `audit_log`, `rate_limit_events`, estadísticas, `notification_log`. | `purge_old_data()` (sólo service role; pg_cron diario si la extensión existe; además la llama `/api/cron/catalog-review`). Índices nuevos para los barridos. | `rls.test.mjs` (limpia negocio sin pedidos nuevos; `authenticated` no puede ejecutarla). |
| JSONB sin tope escribible por PostgREST (theme, settings, seo, navigation, pdf, attributes, tags, contact, social_links). | `CHECK (pg_column_size(...) <= N)` NOT VALID + VALIDATE (si hay filas que exceden, avisa y queda NOT VALID). | `rls.test.mjs` (theme de 400 KB rechazado; 31 etiquetas rechazadas). |
| Límites de plan contados sin candado (dos inserciones simultáneas pasaban el último cupo). | `pg_advisory_xact_lock` en `enforce_item_limit`, `enforce_image_limit`, `enforce_section_template_limit`. | `rls.test.mjs` (frontera). |
| `admin_create_catalog` no respetaba `max_catalogs` (el encabezado de 20261020 decía que sí). | Lo respeta. | `rls.test.mjs`. |
| `restoreItems` saltaba el límite de ítems (trigger sólo BEFORE INSERT); `duplicateItem` copiaba código y existencias. | Conteo previo en la acción; la copia nace sin código ni existencias. | Typecheck; revisión. |
| Transiciones de estado del pedido libres en la acción (la UI las limita). | Mapa de transiciones en `features/orders/actions.ts`; mensaje propio. | Typecheck. |
| Fallos a medias sin invalidar caché (importación y ajuste masivo escribían por lotes y, al fallar uno, no invalidaban el sitio público). | `afterCatalogChange(ctx)` única y en `finally` cuando hubo escrituras; todas las Server Actions la usan. | Revisión; unitarias. |
| Tipos desalineados: `create_business` muerta, `record_order` obsoleta. | Función y tipos eliminados; `save_site`, `site_version`, `purge_old_data`, `orders.stock_deltas` tipados. | Typecheck. |

### Lógica de negocio

| Problema | Solución | Validación |
| --- | --- | --- |
| Importar CSV sin alguna columna borraba ese campo en los ítems existentes; sin columna de código, duplicaba. | Sólo se actualizan las columnas presentes en el archivo (`importUpdatePatch`); sin columna de código se empareja por nombre y tipo. | `tests/lib/catalog-tools.test.ts`. |
| Garfield `update_product` borraba costo, temporada y precio programado (zona horaria sólo derivada de `saleEnds`; costo no cargado). | Carga el costo; `storedTimeZone` = saleEnds ?? season ?? nextPrice; `saveItem` conserva la zona guardada si no llega. | `tests/lib/items-review.test.ts` (ida y vuelta). |
| Ajuste masivo de precios ignoraba opciones, mayoreo y precio programado (mayoreo quedaba más caro que menudeo). | `adjustItemPrices` ajusta precio, precio anterior (se quita si deja de ser mayor), opciones, escalones y precio programado. | `tests/lib/catalog-tools.test.ts`. |
| Redondeo "termina en 9" subía una rebaja (5 −10 % → 9). | Sólo desde 9; el redondeo nunca invierte el sentido del ajuste. | `tests/lib/catalog-tools.test.ts`. |
| "Sin precio" calculado de tres formas (inicio del panel, lista, aviso semanal). | `itemHasPrice` único (precio vigente o el de las opciones). | `tests/lib/items-review.test.ts`. |
| Sitemap listaba productos de categorías inactivas (404 en el sitio). | Se filtran por categoría activa y no borrada. | `tests/lib/seo.test.ts`. |
| PDF del panel incluía productos fuera de temporada que la web oculta. | `getSiteForAdmin(ctx, { inSeasonOnly })` para la ruta del PDF. | Typecheck; revisión. |
| Tipo de sitio "web" sólo aplicado en el panel: el sitio público seguía vendiendo, el sitemap y los exports respondían. | `get_public_catalog` publica `site_kind`; el modelo público vacía ítems y apaga pedidos y reseñas; rutas de PDF y exports devuelven 404. | `rls.test.mjs`; typecheck. |
| `parseCatalogSettings` todo-o-nada: un cupón corrupto apagaba pedidos y reseteaba moneda e idioma. | Parseo por sección con respaldo por campo. | `tests/lib/domain.test.ts`. |
| La página de inicio podía quedar sin publicar (se servía otra página en la raíz). | Invariante "inicio ⇒ publicada" en el reducer y en el esquema de guardado. | `tests/builder/reducer.test.ts`. |
| El ejecutor de Garfield creaba páginas sin respetar el máximo de 30. | Rechaza con mensaje. | `tests/assistant/executor.test.ts`. |

### Rendimiento e interfaz

| Problema | Solución | Validación |
| --- | --- | --- |
| Zod en el bundle público (≈100 KB; chunks con `ZodError` en `/catalogo/[slug]`). | Módulos `*-core.ts` sin Zod (`schedule-core`, `sale-core`, `item-attributes-core`, `settings-core`) reexportados por los módulos con esquema. | `tests/lib/bundle-boundaries.test.ts` (recorre el grafo de imports); build nuevo: 0 chunks con Zod en la ruta pública. |
| `CatalogSection` (cliente) recibía el `SiteViewModel` entero (páginas, SEO, reseñas, descripciones largas) en el payload RSC. | `toCatalogClientSite` recorta el modelo a lo que dibuja la cuadrícula; `CatalogGrid` es el cliente. | `tests/lib/order.test.ts`; E2E públicas (cuadrícula, filtros, pedido). |
| `error.tsx`/`not-found.tsx` cargaban el catálogo completo de traducciones (172 KB). | `i18n/en/status.ts` con 11 textos. | `tests/i18n/catalog.test.ts`. |
| Cada tecla en nombre/nota/dirección escribía en localStorage y re-renderizaba todos los botones "Agregar". | Borradores locales en el diálogo; se guardan al salir del campo y al enviar. | E2E `order.spec.ts` (22/22). |
| `ItemForm`, Garfield y tableros: re-renders y desajustes de hidratación (`Date.now()` en render). | `now` viene del servidor; sugerencias de Garfield memorizadas por las partes del estado que leen. | Lint `react-hooks/purity` limpio. |
| Accesibilidad: `role="radio"` sin flechas, anuncios `aria-live` repetidos, videos sin `prefers-reduced-motion`, botones de icono sin nombre, foco en "Eliminar" en confirmaciones destructivas, `<html lang>` fijo, promedio sin formato de idioma. | Roving tabindex + flechas; anuncio con cantidad; video oculto/sin autoplay con movimiento reducido; `aria-label`; foco en Cancelar; `SiteLang`; `Intl.NumberFormat`. | E2E con axe (públicas). |
| Sin aviso al navegar dentro de la app con cambios sin guardar. | `useUnsavedChangesWarning` intercepta enlaces internos y Atrás (mejor esfuerzo). | Revisión manual del código. |
| Imágenes: `priority` en todas las galerías; `img` sin `height: auto`. | `priority` sólo en la ficha; `img { height: auto }`. | Build. |

### API, infraestructura y calidad

| Problema | Solución |
| --- | --- |
| Cuatro rutas de avisos anónimos con 25 líneas repetidas. | `lib/api/beacon.ts` (`readJsonBody`, `isBot`, `noContent`). |
| Respaldo a `record_order` y a conteos "sin migración" ya aplicadas en todas partes. | Eliminados; `pages`/`custom_code` obligatorios en el payload público. |
| Un error transitorio de reseñas se cacheaba 1 h como "sin reseñas". | Se lanza dentro de `unstable_cache` y se captura fuera. |
| `/api/assistant` duplicaba `guardAssistantRequest`; `basic.ts` era código muerto sostenido por pruebas. | Usa el guard; `basic.ts` borrado y pruebas portadas a `HybridModel`/`withFallback`. |
| El proxy refrescaba sesión en cada aviso anónimo (`/api/:path*`). | Matcher explícito sólo para rutas con sesión. |
| `/api/health` sin timeout. | `AbortSignal.timeout(8 s)` en el cliente público. |
| Variables opcionales mal escritas fallaban en silencio. | `src/instrumentation.ts` avisa una vez al arrancar (sin valores). |
| Capas: `lib` importaba `site-renderer`; `site-renderer` importaba `components`. | `PAYMENT_LABELS` → `lib/orders/payment-labels.ts`; `SocialIcon` → `site-renderer/`. |
| `escapeHtml` ×3, constantes `PAGE` duplicadas, barrel `lib/design/index.ts` sin uso, `@react-pdf/types` sin declarar. | Centralizados / eliminados / declarado. |
| CI: Chromium reinstalado en cada corrida; sin umbral de cobertura. | Caché de `~/.cache/ms-playwright` por lockfile; `--test-coverage-lines=85 --test-coverage-branches=75 --test-coverage-functions=75`. |
| Docs desactualizadas (conteos, 8 de 20 migraciones, variables, roadmap con lo ya hecho). | README, ARQUITECTURA, CONTRIBUTING, ROADMAP sincronizados. |

## C. Cambios de arquitectura y diseño

- **Frontera Zod / navegador explícita y verificada**: la convención `*-core.ts` que ya existía para fondos, colecciones y atributos se extendió a horarios, ofertas, atributos del ítem y configuración; `tests/lib/bundle-boundaries.test.ts` la hace obligatoria (y prohíbe `lib → site-renderer/features`).
- **Modelo recortado para la cuadrícula** (`CatalogClientSite`): los componentes compartidos (`ItemCard`, `ProductCollection`, `ContactActions`, `Reviews`) ahora declaran con `Pick<>` lo que leen del sitio, así el modelo completo y el recortado los satisfacen sin duplicar componentes.
- **Una sola forma de invalidar** (`afterCatalogChange`) y **una sola forma de leer un aviso anónimo** (`readJsonBody`).
- **Guardado del sitio con versión** (optimista, por `timestamptz`), con candado por catálogo en la base.
- **Retención como función de base de datos** reutilizable por pg_cron y por la ruta de cron.
- Código muerto retirado: `basic.ts`, `buildFallbackHome`, `create_business`, `record_order` (tipo), barrel de diseño, respaldos de migraciones.

## D. Seguridad y datos: resumen

Investigado y encontrado sólido (sin cambios): modelo de privilegios y RLS, FKs compuestas, funciones service-role-only, anti-SSRF con IP fijada al conectar, subida de archivos (sharp re-codifica, bucket limitado), saneado del HTML propio (etiquetas, atributos, `srcset`, `javascript:` ofuscado), widget en iframe `sandbox` sin `allow-same-origin`, JSON-LD escapado, cabeceras, Server Actions con comprobación de origen, enlaces de baja HMAC + POST, rate limiting en Postgres.

Vulnerabilidades confirmadas y corregidas: inyección de fórmulas CSV (alta), escape del ámbito CSS y `position: fixed` (media), ruta PDF sin tope/límite (media), lectura de perfiles ajenos (media), movimiento de filas entre inquilinos por un miembro doble (baja), clave de login divisible (baja), cron con `RangeError` (baja), validación de `replace_media_references` (baja).

Riesgos que quedan (decisiones, no defectos): el limitador es *fail-open* si Postgres no responde (por diseño: no bloquear el login por una caída del límite); `/api/health` expone el SHA del commit y la latencia; `x-forwarded-for` se confía porque Vercel lo fija (documentar si se autoaloja); un negocio con código propio puede reestilizar su propio pie (la marca ya no); `set_order_status` sigue disponible para `editor` (regla de negocio sin cambiar).

## E. Rendimiento

Medido sobre `next build`:
- Ruta `/catalogo/[slug]`: antes, 9+ chunks cliente incluyendo `2rrsedm16_pbk.js` (109 KB, con `ZodError`) y `03tsbccuxmr6k.js` (49 KB, esquemas de horario); después, **0 chunks con Zod** en el manifiesto de referencias cliente (254 KB totales sin comprimir para los 9 chunks de la ruta, framework incluido).
- `error.tsx`/`not-found.tsx` ya no referencian el chunk de 172 KB del catálogo de traducciones.
- Payload RSC de la sección de catálogo: sin descripciones largas, páginas, SEO, navegación ni reseñas completas (no se midió en bytes; depende del catálogo).
- Guardado del sitio: de ~2N+1 filas de auditoría por guardado a sólo las páginas que cambian (medido en la prueba de base de datos: 3 páginas, 1 cambio → 1 fila).
- Cada tecla en el pedido ya no escribe en localStorage ni re-renderiza las tarjetas.
No se inventaron cifras de latencia: no hay entorno de carga reproducible en este repositorio.

## F. Pruebas y validación (resultados reales)

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | OK |
| `npm run lint` | OK, 0 advertencias |
| `npm run test:unit` | 395 / 395 (antes 349) |
| `npm run test:coverage` | 93,7 % líneas · 85,5 % ramas · 86,0 % funciones (145 módulos); umbrales nuevos 85 / 75 / 75 |
| `npm run test:db` (PGlite, 20 migraciones) | 309 / 309 (antes 270) |
| `npm run build` | OK |
| `npm run test:e2e` (escritorio + móvil, sin Supabase, como CI) | 57 / 57 |
| `npm run test:e2e:app` (Supabase local en Docker, base reiniciada con las 20 migraciones) | 40 / 40 (login, admin, panel, publicar, pedido, bandeja, editor con versión, reseñas, axe) |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades |

No se pudo ejecutar: pruebas contra los proyectos de Supabase en la nube (por diseño, nunca se hacen desde E2E) ni una medición de carga.

## G. Pendientes

Prioridad alta (operativo, lo hace el usuario):
1. **Aplicar `20261102000000_hardening.sql` en DEV y PROD** junto con el despliegue. Antes, revisar filas que excedan los topes: `select id, pg_column_size(theme) from public.catalogs where pg_column_size(theme) > 307200` (y el resto de columnas). Activar la extensión `pg_cron` en Supabase si se quiere la limpieza diaria (si no, corre con el cron semanal).
2. Confirmar y subir los cambios (no se hizo ningún commit).

Prioridad media (deuda técnica identificada, no abordada):
- `get_public_catalog` devuelve el catálogo completo en un solo JSONB; con miles de ítems supera el tope de la caché de datos de Next (~2 MB) y cada visita volvería a la base. Separar ítems/páginas o paginar por RPC (hipótesis, no medida: verificar con `pg_column_size(get_public_catalog('<slug>'))` en producción).
- Estadísticas: `.limit(5000|10000)` en lecturas por día e ítem truncan en silencio catálogos grandes; mover la agregación a una función SQL.
- Importación CSV e ítems masivos: actualizaciones por lotes de 20 en vez de una RPC transaccional.
- `router.push` desde la paleta de comandos y el cambio de negocio no pasan por el aviso de cambios sin guardar (sólo enlaces y Atrás).
- Folio de pedido de 4 caracteres: con cientos de pedidos al día la bandeja puede descartar uno distinto como duplicado (0,5 % a 100/día).
- Horas de DST en turnos nocturnos (`schedule-core.ts` asume días de 1440 minutos).
- `ItemsTable` dibuja todas las filas (sin ventana) — aceptable hasta unos cientos de ítems.
- `types/database.ts` sigue mantenido a mano (generar y comparar en CI).

Prioridad baja: `use-action` vive en `lib/hooks` pero es un hook de UI; ciclo de imports entre los editores del builder (`content-editors` ↔ `columns-editor`…); tamaños de texto del sitio en `px` (ignoran la preferencia de tamaño del navegador); objetivos táctiles de 34–36 px en favoritos y chips.

## H. Próximos pasos recomendados

1. Monitoreo de errores (Sentry o Vercel Observability) para Server Actions, PDF y Garfield; hoy sólo hay `digest` en logs.
2. Snapshot al publicar (`catalog_publications`) para separar borrador de sitio público y aliviar la carga del RPC público.
3. Paginación en el servidor para catálogos grandes (RPC con filtros) y para la bandeja de pedidos.
4. Generar `types/database.ts` en CI y fallar si difiere.
5. Reutilizar el build de producción entre el job `build` y las E2E públicas (artefacto) cuando las versiones de `upload/download-artifact` coincidan.
6. Validar `max_members` por plan (nunca se aplica) y decidir si `editor` puede confirmar pedidos.
