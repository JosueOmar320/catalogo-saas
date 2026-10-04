# Auditoría v5: media, Garfield local, builder y PDF

Objetivo: pasar de "generador de catálogos" a una plataforma para crear sitios, catálogos y PDFs comerciales asistida por Garfield, **sin** convertirla en un clon de Webflow/Canva y **sin** perder datos.

---

## 1. Estado actual (qué hay de verdad)

### 1.1 Media y storage

| Pregunta | Respuesta |
| --- | --- |
| ¿Los binarios están en la base? | **No.** Desde la v1 los archivos viven en **Supabase Storage** (bucket público `catalog-media`, CDN). La base sólo guarda **rutas** (`{business}/{kind}/{uuid}.jpg`). |
| ¿Cómo se sube? | En el navegador: se redimensiona y comprime con canvas (JPEG/PNG, máx. 1600–2000 px) y se sube directo a Storage (sin pasar por Vercel). Sólo los productos generan miniatura (480 px). |
| ¿Dónde se referencian? | En muchos lugares, siempre como ruta: `businesses.logo_path`, `catalogs.cover_path/favicon_path`, `categories.image_path`, `catalog_item_images.storage_path/thumb_path`, y dentro de JSONB (secciones, tema, PDF, SEO). La ruta → URL se resuelve en un solo lugar (`mediaUrl` / `publicStorageUrl`). |
| ¿Biblioteca? | `media_assets` (v4): metadatos (medidas, alt, origen, atribución). Se registra "best effort" al subir. |

**Problemas reales** (no es "binarios en la base", es acoplamiento entre referencia, carpeta y ciclo de vida):

1. **La carpeta decide dónde se puede usar una imagen.** `isValidMediaPath(ctx, path, 'logo' | 'category' | 'items' | …)` exige que la ruta esté en la carpeta del tipo. Una foto subida para una sección **no** se puede usar como imagen de producto o logo sin **copiarla** físicamente (Garfield ya lo hace: `catalog-actions.ts → imageFor` duplica archivos).
2. **Reemplazar borra el archivo.** Al cambiar logo, portada, imagen de categoría o quitar una foto de producto se llama a `removeStorageObjects` → si esa imagen se reutilizó en otra parte (biblioteca, sección, PDF), **se rompe**. Con una biblioteca reutilizable esto es un bug latente.
3. **Sin miniaturas fuera de productos.** La biblioteca muestra el archivo completo (hasta 2000 px) en una grilla.
4. **Sin URLs externas.** `mediaUrl` sabe dibujar `https://…`, pero el servidor rechaza cualquier ruta ajena al negocio.
5. **Sin gestión.** No hay pantalla de biblioteca: no se puede renombrar, mover, reemplazar, borrar con seguridad, ver dónde se usa ni subir varias a la vez.
6. **Acoplado a Supabase en 4 puntos**: subida del cliente (`supabase.storage.upload`), copia/borrado en el servidor, URL pública y el `CHECK storage_path_business_id(path)` de la base.

### 1.2 Garfield AI

```
Panel → POST /api/assistant → getAssistantModel()
          ├─ Gemini / OpenAI-compatible (Ollama…) / Claude  ── tools de lectura + import_image
          └─ RulesModel (modo básico) ← sólo si NO hay clave, o si la IA falla (cuota/5xx)
       → acciones (Zod) → executor puro → reducer del builder (preview, confirmación, deshacer)
```

**Modo local (básico) hoy:** `rules.ts`, ~320 líneas de palabras clave.

| Puede | No puede |
| --- | --- |
| Crear página desde blueprint, agregar/mover/duplicar/eliminar secciones, columnas y layout de productos, colores, preset de tema, fuente de títulos, forma de botones, fondo, menú, usar imágenes **adjuntadas** | **Un solo pedido por mensaje** ("agrega X y cambia Y" → hace sólo X) |
| | **No usa herramientas**: no puede "buscar en mis imágenes una foto de comida" ni "las últimas 6 imágenes" |
| | **No sabe de PDF** (Garfield sólo existe en el editor del sitio) |
| | Sin plantillas de sitio, sin logo, sin columnas por tipo de sección, sin tamaño de texto/espaciado/bordes/sombras |
| | **No es un router**: si hay IA configurada, *todo* va a la IA, aunque sea "cambia el color a azul" |

### 1.3 Website builder

`Página → Secciones (20 tipos de forma fija) → content`. Cada tipo tiene un contenido rígido: el hero tiene 2 botones, el texto 1 botón y 1 imagen, beneficios es una grilla de ícono+título+texto. **No hay columnas ni bloques libres**: "imagen + texto + 3 botones", "tarjetas con imagen", "proceso en 4 pasos", "lista con íconos" o "dos columnas con distinto contenido" no se pueden armar. Por eso las páginas quedan simples aunque haya muchos estilos.

Responsive: columnas por dispositivo en grillas, ocultar por dispositivo y tamaños de texto móvil (v4). Falta padding y alineación por dispositivo.

Plantillas: hay **presets de tema** (10) y **blueprints de página** (8), pero no **plantillas de sitio** (tema + páginas + contenido).

### 1.4 PDF builder

Ya es por bloques (portada, índice, catálogo por categorías con 4 estilos de portada de categoría, colección, comparación, texto, galería, página del sitio, contacto, salto) con 9 plantillas-preset y 12 layouts de producto. Faltan:

- Páginas: **imagen a página completa**, **promocional**, **contraportada**.
- Fondo por bloque; tipografía/colores propios del PDF (hoy siempre los del sitio); alineación del encabezado y posición del logo; nombre del negocio en el pie.
- Plantillas "Corporativo" y "Folleto de producto".
- Vista previa: un `<iframe>` del PDF con `#page=N`: sin miniaturas, sin zoom, sin saber qué bloque es cada página.
- **Garfield no existe en el PDF.**

### 1.5 Autenticación y permisos

Sólidos (v4): RLS + funciones SQL + Server Actions, roles por negocio (owner/admin/editor) y de plataforma. Storage: políticas por **primer segmento** de la ruta (negocio), independientes de la carpeta → se puede cambiar el esquema de carpetas sin tocar políticas.

---

## 2. Decisiones de arquitectura

### 2.1 Storage: **seguir en Supabase Storage**, detrás de una interfaz

| Opción | Pros | Contras | Veredicto |
| --- | --- | --- | --- |
| **Supabase Storage** (actual) | Ya en uso, RLS por negocio, CDN, subida directa desde el navegador, gratis hasta 1 GB | Transformaciones de imagen sólo en plan Pro | **Se queda** |
| Cloudinary | Transformaciones/formatos automáticos | Otro proveedor, otra cuenta, costos por transformación, firmar subidas | Innecesario: Next/Image ya sirve AVIF/WebP responsive |
| S3 / Cloudflare R2 | R2 sin costo de egress | Políticas y firmas propias, otro SDK | Buena opción futura → la interfaz lo permite |

```
MediaService (features/media/service.ts)      ← reglas: biblioteca, uso, reemplazo, importación
   └─ StorageProvider (lib/storage/provider.ts)  ← upload · remove · copy · publicUrl
        ├─ SupabaseStorageProvider  (hoy)
        └─ (R2 / S3 / Cloudinary: implementar la interfaz)
mediaUrl(ref, 'thumb' | 'full')  ← única puerta ruta → URL (web, PDF, editor)
```

### 2.2 Modelo de media

**Referencia = clave de storage** (`{business}/media/{uuid}.jpg`) o **URL externa registrada**. No se migra el contenido a ids de media: las rutas ya son únicas, estables e independientes del proveedor (la URL se arma en `mediaUrl`), y cambiar miles de referencias JSONB a ids agregaría una consulta extra en cada render público sin beneficio real. Lo que faltaba se resuelve así:

| Necesidad | Solución |
| --- | --- |
| Reutilizar sin duplicar | Se elimina la restricción por carpeta: cualquier imagen del negocio sirve para cualquier uso. Las nuevas se suben a `{business}/media/`. |
| Renombrar / organizar | Metadatos en `media_assets`: `name`, `original_name`, `folder` (Imágenes, Logos, Productos, Fondos, Banners, Otros), `alt`, `tags`. El archivo no cambia. |
| Reemplazar | Se sube el nuevo archivo y una función SQL **reescribe todas las referencias** del negocio (secciones, tema, PDF, productos, categorías, logo…) de la ruta vieja a la nueva. |
| Borrar con seguridad | `media_references()` lista dónde se usa. Si se usa, no se borra (se muestra dónde). Los flujos de logo/categoría/producto **ya no borran archivos**: la biblioteca es la dueña. |
| URL externa | `storage_provider = 'external'`: se guarda la URL validada; sólo URLs registradas en la biblioteca pasan la validación del servidor. |
| Miniaturas | Todas las subidas generan `thumb` (480 px). |

Columnas nuevas de `media_assets`: `name`, `original_name`, `folder`, `storage_provider`, `public_url`. `kind` se conserva (compatibilidad).

### 2.3 Imágenes por URL: importar (recomendado) o enlazar

```
URL → validación (https, sin credenciales, host público: DNS → IP pública, puertos 443)
    → descarga segura (redirecciones re-verificadas, 10 MB, timeout, bytes mágicos)
    → sharp: medidas, JPEG/PNG compatible con PDF, miniatura
    → Storage propio → media_assets(source='import', source_url)
```

| | Importar | Usar URL externa |
| --- | --- | --- |
| Disponibilidad | Garantizada | Depende del otro sitio (puede desaparecer) |
| Rendimiento | CDN propio + Next/Image | Sin optimizar (dominio no autorizado en Next/Image) |
| PDF | Directo | El servidor la descarga al generar (con la misma descarga segura) |
| Privacidad | Los visitantes no tocan terceros | El navegador del visitante pide al tercero |
| Dónde se puede usar | En todo | Secciones, fondos, galerías y PDF. Logo, productos y categorías exigen importar (un clic) |

La verificación de la URL externa (que es una imagen, medidas) también usa la descarga segura: nunca se hace `fetch` a una URL arbitraria sin validar.

### 2.4 Optimización

No se sobreoptimiza: **Next/Image** ya genera AVIF/WebP en el ancho justo (`sizes`) con lazy loading. Se agrega sólo lo que falta: **miniatura** (biblioteca, tarjetas del PDF) y **principal** (≤ 2000 px, suficiente para A4 a 150 ppp). No se guarda el original sin comprimir (costo de almacenamiento sin beneficio visible).

### 2.5 Garfield: router híbrido

```
Pedido → CommandRouter
          ├─ divide en cláusulas ("agrega X, luego cambia Y y pon Z")
          ├─ intérprete local por cláusula (determinista, conoce el MODO: sitio | PDF)
          │     resultado completo y seguro → responde LOCAL (0 costo, ~ms)
          ├─ si es creativo/ambiguo y hay modelo → LLM (Gemini/Claude/Ollama local)
          └─ si no hay modelo → lo local + "esto no lo entendí"
       → referencias de media simbólicas resueltas en el servidor
          ({ media: { query: "comida" } }, { latest: 6 }, { folder: "logos" })
       → acciones validadas (Zod) → executor del modo (sitio o PDF) → preview → aplicar
```

- **Modo explícito** en el contexto: `site` (editor del sitio) o `pdf` (estudio de PDF). Cada modo tiene su catálogo de acciones y su executor puro.
- **Media en modo local**: las reglas producen referencias simbólicas; el servidor las resuelve contra la biblioteca (búsqueda por nombre/alt/etiquetas/carpeta). Así "busca una foto de comida y ponla en el hero" funciona sin IA.
- Un **modelo local** (Ollama) ya está soportado como proveedor `openai-compatible`; el router lo trata igual que a cualquier LLM.

### 2.6 Builder: **una** sección de composición, no un árbol libre

En lugar de `Página → Contenedor → Fila → Columna → Componente` arbitrario (Webflow), se agrega la sección **Columnas**:

```
Sección "Columnas"
  layout: 1 | 1:1 | 1:2 | 2:1 | 1:1:1 | 1:1:1:1   (+ columnas en tablet/móvil, invertir en móvil)
  columnas[] → bloques[]: título · texto · imagen · botones (varios) · lista con íconos ·
                          tarjeta · ícono · etiqueta · cifra · separador · espacio · video
```

Un solo nivel de anidación: suficiente para imagen+texto, tarjetas, procesos, listas, varias CTA; sin el costo de UX de un editor de árbol. Las secciones "inteligentes" (productos, catálogo, contacto, galería…) se mantienen porque traen datos.

Responsive: además de columnas por dispositivo, cada sección puede definir **en móvil** padding y alineación.

**Plantillas de sitio** = preset de tema + páginas (blueprints existentes + nuevos) + contenido. Sin componentes duplicados. Garfield puede aplicarlas.

### 2.7 PDF

Bloques nuevos: **imagen**, **promocional**, **contraportada**. Fondo propio en bloques de contenido. **Estilo del PDF** (fuente de títulos/texto, colores, tamaño base, densidad) que por defecto hereda del sitio. Encabezado con alineación y logo a la izquierda/derecha/centro; pie con nombre del negocio. Plantillas nuevas: Corporativo y Folleto de producto. Vista previa con **pdf.js**: miniaturas, zoom, página actual, cada miniatura sabe a qué bloque pertenece (seleccionarla abre el bloque).

**Garfield en el PDF** con su propio executor puro sobre `PdfSettings` (vista previa y deshacer).

---

## 3. Fases

| Fase | Contenido | Riesgo |
| --- | --- | --- |
| 1. Arquitectura | `StorageProvider` + `MediaService`, `mediaUrl` con variantes, modo en el contexto de Garfield, router de comandos | Bajo |
| 2. Media/Storage | Migración aditiva de `media_assets`, funciones `media_references` / `replace_media_references`, quitar validación por carpeta y borrados en reemplazo, biblioteca `/dashboard/media` (subida múltiple, arrastrar, URL, buscar, filtrar, ordenar, renombrar, mover, reemplazar, borrar con uso, copiar URL, multiselección), selector en todos los campos de imagen | Medio |
| 3. Garfield | Cláusulas múltiples, media simbólica, plantillas, logo, acciones PDF, router local-primero | Medio |
| 4. Website builder | Sección Columnas (web + editor + PDF), responsive móvil, plantillas de sitio | Medio |
| 5. PDF builder | Bloques nuevos, estilo del PDF, encabezado/pie, plantillas, preview con pdf.js, Garfield en el estudio | Medio |
| 6. Integración y pruebas | Pruebas unitarias (router, media simbólica, executor PDF, URL segura), pruebas de base (referencias, reemplazo, aislamiento), build, verificación en navegador, docs | — |

## 4. Migración de imágenes existentes

**No hace falta mover archivos**: ya están fuera de la base, en Storage, y sus rutas siguen siendo válidas (las políticas de Storage sólo miran el negocio, no la carpeta). La migración es sólo de metadatos y es aditiva:

1. Agregar columnas a `media_assets` y completar `name` (del alt o el nombre de archivo), `folder` (desde `kind`: logo/favicon → Logos, items/category → Productos, cover → Banners, og → Otros, site → Imágenes) y `storage_provider = 'supabase'`.
2. Registrar en la biblioteca cualquier archivo referenciado que aún no esté (logo, portada, productos).
3. Las miniaturas faltantes se pueden generar desde la biblioteca ("Generar miniaturas") sin tocar los originales.
4. Nada se borra. La limpieza de huérfanos queda como tarea manual (biblioteca → "sin uso").

---

## 5. Estado de la implementación

Todas las fases están implementadas y probadas (87 pruebas unitarias, 121 de base de datos, build de producción y verificación en navegador del sitio, el editor, Garfield local y el PDF).

Diferencias con la propuesta:
- La descarga segura además fija la verificación de IP en la conexión (lookup propio de `https.request`): cierra la ventana de DNS rebinding que quedaba en la v4.
- Al verificar en el navegador apareció un error previo: "degradado + texto claro" sin colores (blueprints, plantillas, Garfield) se veía blanco sobre blanco. Ahora se completa con los colores de marca del tema al crear la sección (`withBrandGradients`).
- Las páginas enteras del PDF no se parten (`wrap={false}`), para que nunca generen una página en blanco extra.
- Sin probar en vivo: la biblioteca de medios y Garfield contra la base real requieren sesión (cubiertos por pruebas de base y unitarias), y Garfield con Gemini/Claude en vivo.
