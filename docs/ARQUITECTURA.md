# Vitrina: arquitectura (v5: medios, Garfield híbrido, composición y PDF)

> Auditoría de la v1 y plan de la v2: [AUDITORIA-V2.md](AUDITORIA-V2.md). Análisis de los catálogos PDF de referencia y propuesta de la v3: [ANALISIS-CATALOGOS-PDF.md](ANALISIS-CATALOGOS-PDF.md). Auditoría y propuesta de la v4: [AUDITORIA-V4.md](AUDITORIA-V4.md). Auditoría y propuesta de la v5: [AUDITORIA-V5.md](AUDITORIA-V5.md).

## Concepto

```
Plataforma (ADMIN) ──crea──► Usuarios (USER) ──miembros (owner/admin/editor)──► Business
                                                                                    │
Business ──► Catálogo / Sitio
               ├── Tema (sistema de diseño: colores, tipografía, espaciado, bordes,
               │         sombras, botones, fondo, header, footer, tarjetas, badges)
               ├── Navegación (ítems ordenados: páginas, enlaces, WhatsApp…)
               ├── Páginas ──► Secciones (21 tipos, JSONB; "Columnas" = columnas → bloques) ──► Productos / Servicios / Contenido
               ├── Configuración de PDF (plantilla, papel, portada, header/footer, contenido)
               └── Categorías, ítems, imágenes (sin cambios de la v1)
                          │
                    SiteViewModel  (lib/site/view-model.ts: un único modelo)
                          │
            ┌─────────────┴─────────────┐
       Web renderer                 PDF renderer
   (src/site-renderer)          (src/features/pdf)
   público · preview · demo     9 plantillas · preview
```

**Un solo modelo, dos destinos.** La lógica de negocio (qué ítems muestra una sección, badges, texto del hero, color de texto sobre un fondo, enlaces) vive en `lib/site/resolve.ts` y `lib/site/links.ts`, y la comparten ambos renderers. Los estilos salen de `lib/design/tokens.ts`: la web los convierte en variables CSS y el PDF en estilos en puntos.

## Modelo de datos

| Tabla / columna | Qué guarda | Por qué así |
| --- | --- | --- |
| `catalog_pages` | título, slug, inicio, publicada, posición, `sections jsonb`, `style jsonb`, `seo jsonb` | La página es entidad (URL única, orden, SEO propio). Las secciones son configuración: JSONB validado con Zod. Un tipo de sección nuevo no requiere migración. |
| `catalogs.theme` (v2) | sistema de diseño completo | Se migra desde v1 en código (`parseTheme`), sin perder datos. |
| `catalogs.navigation` | `{ items: [...] }` | Única fuente de verdad del menú. |
| `catalogs.pdf` | configuración del PDF (v2: bloques) | Crece independiente de `settings`. Se convierte en código desde la v1 del PDF y desde `settings.pdf`. |
| `businesses.slogan` | slogan | Reutilizado en hero, footer, PDF y SEO. |
| `catalog_items.attributes` | `badges`, `customBadge`, `values` (atributos personalizados) | JSONB extensible que ya existía: sin migración. |
| `catalogs.attribute_defs` (v3) | definiciones de atributos `[{ id, name, type, unit, options, filterable, showInCard, showInDetail, showInPdf }]` | Se leen y editan juntas; máx. 40. Borrar una definición oculta sus valores sin tocar los ítems. |
| `catalogs.settings.priceFormat` (v3) | prefijo, moneda (símbolo/código/ninguna), posición, decimales | Lo usan web y PDF vía `formatPrice`. |
| `profiles` (v4) | `username` (único), `email` (opcional, de contacto), `platform_role` (`admin`/`user`), `status` (`active`/`disabled`), `last_login_at`, `max_businesses`, `created_by` | El rol y el estado viven en la base. Los usuarios no pueden escribir esas columnas (privilegio de columna revocado): sólo las funciones `admin_*`. |
| `businesses.status` (v4) | `active` / `suspended` | Un negocio suspendido no se publica ni se puede editar (lo aplican `is_business_member` y `get_public_catalog`). |
| `catalogs.is_active` (v4) | activo / desactivado por el administrador | Un catálogo desactivado no se publica. |
| `audit_log` (v4) | actor, acción, tabla, id, negocio, columnas cambiadas, metadatos, fecha | Lo llenan triggers (`audit_row_change`) en las tablas principales y `log_audit` para eventos explícitos. Sólo lo leen administradores. Sin FK a negocios: el historial sobrevive a un borrado. |
| `media_assets` (v4) | ruta, tipo, medidas, peso, alt, origen (`upload`/`stock`/`chat`/`import`), atribución | Biblioteca de imágenes por negocio (RLS). Se llenó con lo que ya había en Storage. |

- **RPC `save_site`**: guarda tema, navegación y páginas (upsert, borrado lógico, orden, inicio único) en una transacción con RLS. Detecta ids ajenos (`page_conflict`).
- **RPC `get_public_catalog`**: agrega páginas publicadas, navegación y slogan. Sigue siendo 1 llamada por sitio (cacheada por tag).
- **Migración de datos**: cada catálogo existente recibe "Inicio" = Hero (portada/descripción) + Catálogo completo (con las opciones de su tema v1) + Contacto. Además, si un sitio no tuviera páginas, el sitio público y el builder generan la misma página en memoria.

## Qué es global, por página o por sección

| Configuración | Global | Página | Sección |
| --- | :---: | :---: | :---: |
| Colores, tipografía, botones, sombras, radios, espaciado | ✔ | | |
| Fondo (color, degradado, imagen, patrón/textura, overlay) | ✔ | ✔ | ✔ |
| Color de texto (auto/claro/oscuro) | | | ✔ |
| Padding vertical, margen, superposición, ancho, altura mínima, alineación, ocultar en móvil/escritorio, ancla | | | ✔ |
| Caja, borde, radio, sombra, divisores decorativos | | | ✔ |
| Jerarquía tipográfica (H1–H3, texto, pequeño, etiqueta, botón; escritorio y móvil) | ✔ | | |
| Estilo de tarjeta | ✔ | | ✔ (opcional) |
| Columnas escritorio / tablet / móvil | | | ✔ |
| Header, footer | ✔ | | |
| SEO | ✔ | ✔ | |

La identidad (colores, tipografía, botones) es global a propósito: si cada página pudiera cambiarla, el sitio perdería coherencia. Los fondos sí van en cascada (sección > página > global), porque son lo que más diferencia una página de otra.

## Registros extensibles (agregar sin tocar el resto)

| Qué | Dónde se registra | TypeScript obliga a completar |
| --- | --- | --- |
| Tipo de sección | `lib/site/section-schemas.ts` + `section-registry.ts` | renderer web (`site-renderer/sections/index.ts`), editor (`builder/components/editors`), adaptador PDF (`features/pdf/sections.tsx`, switch exhaustivo) |
| Preset de tema | `lib/design/presets.ts` | nada más |
| Estilo de header / tarjeta / footer | `lib/design/styles-registry.ts` | CSS por `data-style` |
| Fuente | `lib/design/fonts.ts` | `site-renderer/fonts.ts` |
| Patrón / textura | `lib/design/patterns.ts` (geometría) | web y PDF lo dibujan solos |
| Ícono | `lib/design/icons.ts` | web y PDF lo dibujan solos |
| Layout de producto | `lib/catalog/presentation.ts` (`PRODUCT_LAYOUTS`, `LAYOUT_OPTIONS`) | web (`site-renderer/ProductCollection.tsx`), PDF (`features/pdf/products.tsx`), miniatura del selector |
| Rol tipográfico | `lib/design/theme.ts` (`TYPE_ROLES`) | variables `--ty-*` (`theme-vars.ts`), tokens del PDF |
| Acción de Garfield | `lib/assistant/actions.ts` | ejecutor (`features/assistant/executor.ts`) o, si es de catálogo, `catalog-actions.ts` |
| Herramienta de Garfield | `features/assistant/server/tools.ts` (`TOOL_SCHEMAS`) | `runTool` |
| Fuente de colección | `lib/catalog/collections.ts` | nada más (web y PDF usan `resolveCollection`) |
| Plantilla PDF | `lib/pdf/settings.ts` (`TEMPLATE_PRESETS`) | skin en `features/pdf/doc.ts` |
| Bloque PDF | `lib/pdf/settings.ts` (`PDF_BLOCK_TYPES`) | render en `SitePdfDocument.tsx` y editor en `PdfStudio.tsx` |
| Acción de contacto | `lib/catalog/settings.ts` + `lib/contact/actions.ts` | |

## Render web

- `site-renderer/`: `SiteShell` (variables del tema + fondo global) → `SiteHeader` (cliente: 7 estilos, menú móvil, header transparente que se vuelve sólido al hacer scroll) → `PageView` (fondo de página + secciones) → `SiteFooter`.
- `SectionFrame`: fondo de la sección, color de texto automático, padding, ancho, visibilidad por dispositivo, ancla y `data-section-id` (el builder permite editar una sección haciendo clic en la preview).
- **Container queries** (no media queries): la preview de tablet y móvil del editor se comporta como el dispositivo real.
- Rutas públicas: `/catalogo/[slug]` (inicio), `/catalogo/[slug]/[pagina]` (cualquier página creada por el usuario), `/catalogo/[slug]/p/[item]`. Header y footer viven en un layout compartido (navegar no los vuelve a renderizar). ISR + tag por negocio.

## Builder (`/dashboard/sitio`)

- Estado local con `useReducer` (borrador de tema, navegación y páginas) y banderas de cambios por parte. La preview usa `useDeferredValue`: los controles nunca se traban.
- Las secciones se renderizan con `memo`; los cambios de tema sólo cambian variables CSS en la raíz.
- Guardado único y atómico (`saveSite` → Zod → verificación de rutas de imagen → RPC `save_site`).

## Motor de catálogo (v3)

```
Colección (qué ítems)  ──►  Presentación (cómo se ven)  ──►  Renderer
source · itemType · sort       layout (12) + opciones            web: ProductCollection (CSS, container queries)
limit · categoría · atributo   columns {desktop,tablet,          PDF: productRows (filas indivisibles en pt)
elegidos a mano                mobile,pdf} · shape · fields…
```

- **`presentation`** es la única decisión "¿cómo muestro mis productos?". La usan las secciones Productos, Servicios y Catálogo, y los bloques Catálogo y Colección del PDF. `LAYOUT_OPTIONS` define qué opciones aplican a cada layout: el editor sólo muestra ésas.
- **`collection`** reemplaza los campos sueltos `source/limit/itemIds` de la v2. Las secciones guardadas antes se convierten al leerlas (`migrateLegacySection`) conservando las decisiones del usuario.
- **Catálogo web**: filtros (`site-renderer/filter.ts`: búsqueda sin acentos por nombre, código, etiquetas y atributos; categoría; tipo; precio; estado; atributos), orden (`sortItems`) y paginación (`all | pages | loadMore | infinite`). Todo en el cliente sobre los ítems ya cargados (el sitio público se sirve con ISR).
- **Atributos**: definiciones por catálogo, valores por ítem (normalizados con `parseAttributeValues` según el tipo actual). `visibleAttributes(values, defs, 'card' | 'detail' | 'pdf')` decide dónde se muestran.
- **Campos visibles**: la configuración global de tarjetas del tema actúa como permiso (si el tema oculta precios, se ocultan en todo el sitio); la presentación de cada sección decide dentro de ese permiso (incluye precio anterior, % de descuento calculado con `discountPercent` y aviso de no disponible).

## PDF (v2: bloques)

- **Configuración** (`lib/pdf/settings.ts`): `blocks[]` ordenables (portada, índice, catálogo por categorías, colección, comparación, información, galería, página del sitio, contacto, salto de página), cada uno con "empieza en página nueva"; `cover` (7 composiciones, textos, imagen y forma, fondo/overlay, color de texto, decoración); `header` (none/line/title/band); `footer` (none/line/band con @redes); `decorations` (esquinas, destellos, marco); papel, márgenes, fondo y ahorro de tinta.
- **Plantillas = presets** (`TEMPLATE_PRESETS`) + **skin** (`PDF_SKINS`): el preset rellena portada, encabezado, pie, decoración, presentación y estilo de categoría de cada bloque; la skin define detalles no configurables (tarjeta con borde/suave/marco, precio en texto/píldora/etiqueta, título de categoría). Cambiar de plantilla no borra contenido.
- **Motor** (`features/pdf/`): `cover.tsx`, `chrome.tsx` (encabezado, pie, decoraciones), `products.tsx` (12 layouts como filas indivisibles), `blocks.tsx` (índice, catálogo, colección, comparación, información, galería, contacto, paginación "N por página"), `sections.tsx` (páginas del sitio adaptadas), `SitePdfDocument.tsx` (portada + flujo con encabezado/pie/fondo fijos).
- **Índice en dos pasadas**: la primera registra en qué página cae cada ancla; la segunda escribe los números. Los enlaces del índice son internos (`#ancla`).
- **Sin páginas en blanco**: bloques vacíos se descartan y un salto nunca queda al final.
- `POST /api/catalogs/[id]/pdf` genera la vista previa con el borrador y devuelve `X-Pdf-Pages` y `X-Pdf-Marks` (página de cada bloque): el estudio muestra "Pág. N / total" y salta al bloque elegido. `GET` descarga con la configuración guardada. El servidor sólo descarga imágenes del propio negocio (sin SSRF) y usa la foto completa sólo en layouts de imagen grande.

## Garfield AI (asistente del editor)

Detalle completo en [GARFIELD-AI.md](GARFIELD-AI.md).

```
Panel (cliente) ──mensajes + contexto del borrador + adjuntos──► POST /api/assistant (sesión, rol, límite, Zod)
                                                          ├─ contexto del servidor: productos, categorías, medios
                                                          ├─ AssistantModel: Gemini / OpenAI-compatible (JSON) | Claude (tool use) | modo básico
                                                          └─ herramientas de SÓLO LECTURA o importación controlada:
                                                             search_products · list_categories · search_media ·
                                                             search_stock_images · import_image
         ◄──── { message, actions[], suggestions, allowedMedia } (validado con assistantResponseSchema)
Aplicar:  acciones de catálogo → applyCatalogActions (mismas Server Actions que los formularios: Zod, RLS, límites)
          acciones del editor → planAssistantActions(borrador) → builderReducer → "Guardar cambios" → saveSite
```

- `lib/assistant/actions.ts`: lista blanca de acciones (Zod) → genera la herramienta del modelo y valida su salida.
- `lib/assistant/capabilities.ts`: guía para el modelo generada desde los registros (secciones, layouts, presets, fuentes, íconos, blueprints).
- `features/assistant/executor.ts`: función pura; resuelve referencias, valida con los schemas estrictos, descarta imágenes desconocidas, clasifica riesgo y ejecuta con el reducer del builder. Probada en `tests/assistant/`.
- La ruta del asistente no escribe datos de negocio: sólo `import_image` sube una imagen a la biblioteca del negocio (HTTPS, IP pública, re-verificación en redirecciones, 5 MB, bytes mágicos de imagen). Los cambios de catálogo se aplican cuando el usuario pulsa "Aplicar", con sus permisos; los del editor, al guardar.

## Medios (v5)

```
Navegador ──(canvas: ≤2000 px + miniatura 480)──► Storage  {negocio}/media/{uuid}.jpg
URL externa ──safeDownload (IP pública verificada al conectar)──► sharp ──► Storage   (Importar)
                                                         └──► sólo la referencia https (Enlace)
                     ▼
media_assets: nombre, alt, carpeta, proveedor (supabase|external), medidas, origen, miniatura
                     ▼
contenido (secciones, tema, PDF, productos, logo) guarda la CLAVE o la URL registrada
mediaUrl(clave) → URL pública  ·  Next/Image → AVIF/WebP responsive  ·  PDF → JPEG/PNG (sharp)
```

- `lib/storage/provider.ts` (StorageProvider) y `features/media/service.ts` (MediaService): la app no conoce el proveedor; cambiar a R2/S3 = otra implementación de la interfaz y de `publicStorageUrl`. Las claves guardadas no cambian.
- Cualquier imagen del negocio sirve para cualquier uso (ya no se valida por carpeta): no hay copias.
- `media_references()` (SQL, RLS) dice dónde se usa una imagen; borrar sólo se permite si no se usa. `replace_media_references()` cambia la ruta en secciones, tema, PDF, productos, categorías, logo y portada de una vez (reemplazar / importar una externa).
- Los formularios (logo, categoría, fotos de producto) ya no borran archivos al reemplazar: `releaseStorageObjects` sólo elimina archivos fuera de la biblioteca y sin uso.
- Las URLs externas sólo pasan la validación del servidor si están registradas en la biblioteca del negocio; el PDF las descarga con la misma descarga segura.

## Garfield: modos, router y herramientas (v5)

```
Panel (sitio o PDF) ──contexto del modo──► /api/assistant
   HybridModel: cláusulas → intérprete local (rules.ts / pdf-rules.ts)
      simple → responde local (routed: local) · creativo/no entendido → LLM (routed: llm)
   resolveMediaQueries: media {query|latest|folder} → rutas reales de la biblioteca
   parseModeActions (Zod del modo) → validatedMedia
Cliente: GarfieldEngine + adaptador del editor
   sitio → planAssistantActions (reducer del builder) · PDF → planPdfActions (PdfSettings)
```

- `lib/assistant/modes.ts`: catálogo de acciones por modo (sitio: páginas, secciones, tema, menú, imágenes, logo, plantillas, productos, categorías; PDF: plantilla, formato, estilo, portada, encabezado, pie, bloques, productos).
- Plantillas de sitio (`lib/site/templates.ts`) y composiciones de Columnas (`lib/site/column-presets.ts`): combinaciones de secciones existentes, las usan el editor y Garfield.

## PDF (v5)

- Tramos: el documento se arma como portada + tramos de FLUJO (encabezado, pie, fondo) y páginas ENTERAS de diseño (imagen a sangre, promocional, contraportada) con su propio fondo y sin partirse.
- `settings.style`: fuentes, colores, escala y densidad propias del PDF; vacío = las del sitio.
- Encabezado con logo a la izquierda/centro/derecha y "título de la sección" (de la pasada anterior del render).
- Vista previa con pdf.js (`PdfPreview`): miniaturas, zoom, cada página sabe a qué bloque pertenece.

## Acceso, roles y administración (v4)

```
/login (usuario + contraseña) ──► signIn (Server Action)
    username ──service role──► email interno de Auth (username@AUTH_USERNAME_DOMAIN)
    signInWithPassword ──► profiles.status = 'active'? ──► /admin (ADMIN) o /dashboard (USER)
```

- **Sin registro público.** Las cuentas las crea un administrador (`features/admin/actions.ts` → Auth Admin API con `app_metadata.provisioned`). El trigger `handle_new_user` deja **deshabilitada** cualquier cuenta creada por otro camino, aunque el registro de Supabase siguiera abierto.
- **Email opcional de verdad.** Supabase Auth necesita un email: se usa uno interno no entregable (`usuarios.invalid`). El email real, si existe, es un dato de contacto en `profiles.email`.
- **Roles en la base.** `profiles.platform_role` no se puede escribir desde la API (privilegio de columna revocado); sólo `admin_update_profile` (SECURITY DEFINER, exige `is_platform_admin()`), que impide quitarse el rol a sí mismo y dejar la plataforma sin administradores. El primer administrador se crea con `npm run admin:create` (service role) o `bootstrap_platform_admin` desde el SQL Editor; no hay usuarios fijos en el código.
- **Tres capas.** Proxy (sesión) → `requireBusinessContext` / `requirePlatformAdmin` en cada página y Server Action → RLS y funciones SQL (`is_business_member`, `has_business_role` exigen usuario y negocio activos). La interfaz sólo oculta lo que la base ya prohíbe.
- **Negocios asignados.** Un USER sólo ve los negocios donde es miembro. El ADMIN puede abrir cualquiera (cookie `vitrina_business`, validada contra la base) y crea negocios con `admin_create_business` (dueño, plan y límite `max_businesses`). `create_business` ya no se puede llamar desde la app.
- **Auditoría.** Triggers en negocios, miembros, catálogos, páginas, categorías, ítems, perfiles y medios registran quién cambió qué (columnas cambiadas, sin valores sensibles). `/admin/auditoria` filtra por acción, negocio y actor.
- **Preparado para planes.** `plans` + `businesses.plan_id` + `entitlements` ya limitan ítems e imágenes; `max_businesses` por usuario y `metadata` en auditoría dejan lugar a límites y funciones por plan sin cambiar el modelo.

## Seguridad

Igual que la v1 (RLS, FKs compuestas, privilegios por columna, Storage por carpeta, Zod en servidor), más:

- `catalog_pages`: RLS por negocio; escritura sólo owner/admin.
- `save_site` es `SECURITY INVOKER` (aplica RLS) y rechaza ids de páginas de otro catálogo.
- Cualquier ruta de imagen dentro del tema, las secciones o el PDF se valida en el servidor (`collectMediaPaths` + `isPathOwnedBy`).
- Colores validados como hex y texto enriquecido parseado a nodos React (sin `dangerouslySetInnerHTML`). La única excepción es el JSON-LD de Preguntas frecuentes: `JSON.stringify` + escape de `<`.
- Videos: sólo `https`; YouTube (dominio `youtube-nocookie`), Vimeo (`dnt=1`) o archivos `.mp4/.webm`. Nada se inserta como HTML.
- `attribute_defs`: validado con Zod en la acción (`saveAttributeDefs`, sólo owner/admin) y con un CHECK en la base (arreglo, máx. 40).
- Service role sólo en el servidor (`lib/supabase/admin.ts`, `server-only`) y sólo para la API de Auth y la búsqueda de usuario al iniciar sesión.
- 126 pruebas de base de datos (`npm run test:db`): aislamiento, migración v1, atributos, v4 (autopromoción bloqueada, suspensión, cuotas, auditoría, catálogo inactivo) v5 (URLs externas, dónde se usa, reemplazo, aislamiento) y conteos del panel admin (sólo administradores). 95 pruebas unitarias (`npm run test:unit`).

## Rendimiento

- **Sin zod en el navegador del sitio público**: los componentes de `site-renderer/` importan lógica de módulos `*-core.ts` sin esquemas (`background-core`, `collections-core`, `attributes-core`, `price`, `find-home`, `type-roles`, `utils/phone`). Los módulos con esquema los re-exportan, así el resto del código no cambia. Al agregar lógica que use el sitio público, ponla en el módulo sin zod.
- **Consultas sin límite de 1000 filas**: `lib/supabase/paginate.ts` (`fetchAllRows`) pagina lecturas que pueden crecer; nunca usar `.in()` con listas de ids sin acotar (la URL se corta cerca de 450 uuids).
- **Panel admin**: conteos con `admin_catalog_counts()` y `admin_stats()` (migración `20261005000000_performance.sql`), con respaldo al método anterior si la migración no está aplicada.
- **Vista previa del builder**: las secciones se memorizan (`PageView.tsx`) y sólo se re-renderizan si cambia su contenido o algo del sitio que las afecta.
- **PDF**: caché de imágenes LRU (64 MB, 10 min) en `features/pdf/images.ts`.

