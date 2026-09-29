# Garfield AI: análisis y arquitectura

Asistente conversacional del editor: "le digo a Garfield qué quiero y Garfield me ayuda a construir mi página".

## 1. Análisis del sistema actual

| Pregunta | Respuesta (código actual) |
| --- | --- |
| ¿Cómo se guardan las páginas? | Tabla `catalog_pages` (título, slug, inicio, publicada, posición, `sections jsonb`, `style jsonb`, `seo jsonb`). Tipo `SitePage` (`lib/site/pages.ts`). |
| ¿Y las secciones? | JSONB dentro de la página. 13 tipos, cada uno con schema Zod estricto y leniente (`lib/site/section-schemas.ts`); `createSection(type, content, style)` crea una válida con defaults. Metadatos en `section-registry.ts`. |
| ¿Cómo se renderizan? | `site-renderer/` (web, mismo renderer en público, preview y builder) y `features/pdf/` (PDF). |
| ¿Productos? | `catalog_items` + `categories`; las secciones no guardan productos, guardan una **colección** (`lib/catalog/collections.ts`) y una **presentación** (`lib/catalog/presentation.ts`). |
| ¿Tema? | `catalogs.theme` (`lib/design/theme.ts`): colores, tipografía, espaciado, forma, botones, fondo, header, footer, tarjetas, badges. `applyPreset` aplica 10 presets. |
| ¿Navegación? | `catalogs.navigation` (`lib/site/navigation.ts`): lista ordenada de ítems (página, url, WhatsApp, teléfono, email). |
| ¿Preview? | `BuilderPreview` renderiza `SiteView` con el **borrador** del builder (`useDeferredValue`). |
| ¿Cómo se manejan los cambios? | Todo el builder es un **borrador local**: `useReducer(builderReducer)` con acciones (`addPage`, `addSection`, `updateSection`, `reorderSections`, `setTheme`…). Nada toca la base hasta "Guardar", que llama a `saveSite` (Server Action: Zod estricto + verificación de rutas de imagen + RPC `save_site` con RLS, atómico). |
| ¿Qué es reutilizable? | El reducer (operaciones del editor), `createSection`, los schemas Zod, `applyPreset`, los blueprints de páginas, `SECTION_META`, `PRODUCT_LAYOUT_META`, `COLLECTION_LABELS`, la preview y `saveSite`. |

**Conclusión clave:** el builder ya tiene exactamente la capa que pide Garfield. Las operaciones del editor son acciones del reducer sobre un borrador validado, y la persistencia pasa por una única puerta segura (`saveSite`). Garfield no necesita (ni debe) escribir en la base: propone acciones, la app las valida y las ejecuta con el mismo reducer que usan los botones del editor.

## 2. Arquitectura

```
Usuario
  ↓  "Agrega una sección de productos destacados debajo de esta"
Panel de Garfield (cliente)
  ↓  mensajes + CONTEXTO del editor (página actual, sección seleccionada, secciones con id/tipo/título,
  ↓  tema, navegación, categorías, atributos, cantidad de ítems)
POST /api/assistant  (sesión + permiso owner/admin, límite de uso, Zod sobre la entrada)
  ↓
Modelo (interfaz AssistantModel)
  ├─ Gemini (gratis) u otra API compatible con OpenAI: modo JSON, cadena de modelos (Flash → Flash-Lite)
  ├─ Claude (tool use forzado: `respond` → { message, actions[], suggestions[] })
  └─ Modo básico (sin clave o sin cuota): intérprete de reglas en español para los pedidos frecuentes
  ↓  JSON validado con assistantResponseSchema (acciones desconocidas se descartan)
Cliente: planAssistantActions(borrador, acciones)            ← función pura, testeable
  ├─ resuelve referencias ("selected", "last", "$alias", "type:products", slug, título)
  ├─ valida cada resultado con los schemas Zod estrictos existentes
  ├─ limpia rutas de imagen que no existan en el sitio (la IA no puede inventar archivos)
  ├─ clasifica riesgo (segura / requiere confirmación)
  └─ ejecuta con builderReducer (mismas operaciones que los botones)
  ↓
Plan: pasos ✓/✗ + estado siguiente
  ├─ simple y seguro → se aplica al instante (con "Deshacer")
  ├─ grande → [Vista previa] (la preview del builder muestra el estado propuesto) · [Aplicar]
  └─ destructivo → confirmación explícita ("Eliminar sección")
  ↓
Borrador del builder  →  "Guardar cambios"  →  saveSite (Zod + RLS)  →  base de datos
```

La IA **interpreta la intención**; la aplicación **decide** si la acción es válida y cómo ejecutarla.

### Catálogo de acciones (`lib/assistant/actions.ts`)

| Grupo | Acciones |
| --- | --- |
| Estructura | `create_page` (con blueprint o secciones propias), `update_page` (título, slug, publicada, SEO, en menú), `duplicate_page`, `delete_page`, `set_home_page` |
| Secciones | `create_section`, `update_section` (contenido y estilo, merge profundo), `move_section`, `duplicate_section`, `delete_section` |
| Productos | `update_product_display` (presentación, colección, filtros, orden, paginación de secciones Productos/Servicios/Catálogo) |
| Diseño | `update_theme` (preset, colores, tipografía, espaciado, forma, botones, header, footer, tarjetas, badges), `update_background` (sitio, página, sección, header, footer) |
| Navegación | `add_nav_item`, `update_nav_item`, `remove_nav_item`, `reorder_navigation` |
| Editor | `focus` (abrir una página o sección en el editor) |

Cada acción es un schema Zod. El mismo schema genera el JSON Schema de la herramienta del modelo y valida la respuesta en el servidor y en el cliente: una sola fuente de verdad.

### Conocimiento del modelo sin duplicar lógica

El prompt se **genera** desde los registros existentes: tipos de sección (`SECTION_META` + JSON Schema del contenido de cada tipo), layouts de producto, fuentes de colección, presets, fuentes tipográficas, estilos de header/tarjeta/footer, íconos y blueprints. Agregar un tipo de sección o un layout lo enseña automáticamente a Garfield.

### Riesgo y confirmación

- Requieren confirmación: `delete_page`, `delete_section`, `remove_nav_item`, `set_home_page`, cambio de slug, aplicar un preset de tema (reemplaza muchos valores) y planes de más de 6 pasos.
- Se aplican al instante: planes de hasta 2 pasos sin riesgo (agregar contacto, cambiar columnas…). Siempre hay "Deshacer".
- Crear páginas completas muestra el plan con "Vista previa" y "Aplicar".

### Contexto y referencias

El editor envía la página y la sección seleccionadas, y las secciones tocadas en el último cambio. Las acciones pueden referirse a `selected` ("esta sección"), `last` ("la anterior", lo recién creado), `$alias` (algo creado en el mismo plan), `type:products` ("la de productos"), un id, un slug o un título.

### Seguridad

- Sin acceso a la base: la ruta del asistente no escribe nada; los cambios viven en el borrador hasta que el usuario guarda con `saveSite` (validación estricta + RLS, igual que siempre).
- Sólo acciones de la lista blanca; parámetros validados con Zod; referencias resueltas contra el estado real.
- Las imágenes sólo pueden ser rutas que ya existen en el sitio (y `saveSite` verifica igualmente que pertenezcan al negocio).
- Sin HTML: el contenido son campos tipados de las secciones; el texto enriquecido usa el parser existente (sin `dangerouslySetInnerHTML`).
- Sesión + rol owner/admin, límite de solicitudes por usuario y tamaño máximo de entrada.

## 3. Cambios necesarios

**Base de datos: ninguno.** El historial de conversación no es necesario para el MVP: se conserva en el navegador (por negocio) y se envían al modelo los últimos mensajes. Si más adelante se quiere historial entre dispositivos o analítica, basta con una tabla `assistant_conversations (id, business_id, page_id, created_at, updated_at)` y `assistant_messages (conversation_id, role, content, actions jsonb, created_at)` con RLS por negocio.

**Backend:** `POST /api/assistant`, proveedores de modelo, prompt generado desde registros.

## 3.1 Proveedores de IA

| Proveedor | Cómo se activa | Notas |
| --- | --- | --- |
| **Google Gemini** (recomendado, gratis) | `GEMINI_API_KEY` | API compatible con OpenAI en modo JSON. `ASSISTANT_MODEL` acepta una cadena: `gemini-3.8-flash,gemini-3.5-flash-lite` (cuando el primero agota su cuota diaria gratuita se usa el siguiente). En el plan gratuito Google puede usar los prompts para mejorar sus productos (salvo UE/Reino Unido/Suiza): Garfield sólo envía la estructura del sitio, no datos de clientes. |
| Claude (Anthropic) | `ANTHROPIC_API_KEY` | Herramienta forzada `respond`; la guía va en un bloque cacheado. |
| Cualquier API compatible con OpenAI | `ASSISTANT_PROVIDER=openai-compatible` + `ASSISTANT_BASE_URL` + `ASSISTANT_MODEL` | Ollama (local y gratis), Mistral, Groq, OpenRouter… Si el proveedor no admite `response_format`, se reintenta sin él. |
| Modo básico | Sin claves | Reglas en español. También es el **respaldo automático** cuando se agota la cuota o el proveedor no responde (con aviso al usuario). Una clave inválida NO se oculta: muestra un error claro. |

Todas las salidas se validan con el mismo `assistantResponseSchema`; si una acción es inválida, se pide una corrección al modelo una vez. El formato de respuesta en modo JSON también se genera del schema Zod (`responseFormatGuide`).

**Frontend:** mascota (SVG original de gato naranja, con estados), botón flotante, panel lateral, tarjetas de plan (pasos, riesgo, vista previa, aplicar, deshacer), sugerencias por contexto, ayudas pequeñas en el editor ("Pídeselo a Garfield"), y en el reducer un `pageId` opcional en las acciones de sección.

## 4. Preparado para después

- **Nuevas capacidades = nuevas acciones** en el catálogo (p. ej. `generate_image`, `translate_page`, `update_item_description` vía Server Action con confirmación). El panel, el plan, la confirmación y la preview no cambian.
- **Nuevos proveedores** implementan `AssistantModel`.
- **Otros editores** (Estudio PDF, productos) sólo necesitan su propio contexto y su propio ejecutor.
- **Análisis/UX/SEO**: acciones de sólo lectura que devuelven recomendaciones con acciones sugeridas.

## 5. Nota sobre el nombre

"Garfield" es una marca registrada. La mascota es una ilustración original (gato naranja), pero antes de un lanzamiento comercial conviene revisar el uso del nombre. Está centralizado en `lib/assistant/identity.ts` para cambiarlo en un solo lugar.
