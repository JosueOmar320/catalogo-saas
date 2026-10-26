# Auditoría y plan: de "catálogo" a "Website & Catalog Builder"

## 1. Arquitectura actual (v1)

- Next.js 16 App Router + Server Actions + Supabase (RLS). Sin backend separado.
- Tenant resuelto en servidor (`getBusinessContext`), mutaciones validadas con Zod y protegidas por RLS, FKs compuestas y políticas de Storage.
- Un único paquete visual `src/catalog-renderer` usado por el catálogo público, la preview del editor, la demo y el onboarding.
- La página pública lee todo con **una** RPC (`get_public_catalog`) cacheada por tag.

## 2. Cómo funciona hoy el catálogo

```
Business → Catalog (1) → Categories → Items → Images
                 └── theme (JSONB v1) · settings (JSONB) · seo (JSONB)
```

- **Una sola página** (`/catalogo/[slug]`) + ficha por ítem (`/p/[item]`).
- La estructura de la página está fija en `CatalogView`: header → toolbar (búsqueda/categorías) → destacados → secciones por categoría → footer. El tema sólo decide *qué partes se muestran*.
- Tema v1: 8 colores, 2 fuentes, 3 layouts de lista, toggles de tarjeta/header/footer. Fondo: un color plano.
- Editor de diseño: formulario del tema con preview en vivo, pero sin noción de páginas ni secciones.

## 3. Cómo funciona hoy el PDF

- `@react-pdf/renderer` en un Route Handler. Un único documento: portada → secciones por categoría (grid o lista) → contacto.
- Usa las fuentes y algunos colores del tema, pero **fuerza fondo blanco** y un diseño fijo. No hay plantillas, ni fondo, ni configuración de encabezado/pie/márgenes, ni preview.
- Opciones: layout grid/lista, A4/Carta, portada sí/no, precios, descripciones, salto por categoría.

## 4. Limitaciones

| Limitación | Consecuencia |
| --- | --- |
| Una sola página con estructura fija | No se puede armar "Inicio / Productos / Nosotros / Contacto". |
| Sin concepto de sección | No hay hero, banners, galerías, testimonios, texto libre. |
| Tema v1 pequeño y plano | Sin fondos (gradiente/imagen/patrón), sombras, botones, espaciado, estilos de navbar o de card. |
| Estilo sólo global | No se puede dar un fondo distinto a una página o sección. |
| Navegación inexistente | El "menú" son chips de categorías. |
| PDF con diseño propio | No refleja la identidad; no hay plantillas ni preview. |
| Negocio sin slogan/info extra | Contenido repetido a mano en distintos lugares. |
| SEO sólo global | Una página = un título. |

## 5. Cambios en la base de datos (migración `20260928000000_site_builder.sql`)

| Cambio | Decisión |
| --- | --- |
| **Tabla `catalog_pages`** (título, slug, home, publicada, posición, `sections jsonb`, `style jsonb`, `seo jsonb`) | La página es entidad relacional: tiene URL única, se lista, se ordena y se enlaza. |
| **Secciones como `jsonb` dentro de la página** | Una sección nueva = un tipo nuevo en el registro de TypeScript, **sin migración**. La página se guarda completa y de forma atómica, y el sitio público sigue siendo una sola lectura. Una tabla `page_sections` no aportaría consultas útiles (nunca se busca "todas las secciones hero"). |
| **`catalogs.navigation jsonb`** | Lista ordenada de ítems de menú (página, enlace, WhatsApp, teléfono, email; estilo link o botón). Única fuente de verdad del menú. |
| **`catalogs.pdf jsonb`** | Configuración del PDF (plantilla, papel, márgenes, portada, header, footer, fondo, contenido y orden). Separado de `settings` porque crecerá mucho. |
| **`businesses.slogan`** | Dato del negocio reutilizado en header, hero, footer, PDF y SEO. |
| **`catalogs.theme` pasa a v2** | Se migra **en código** (`parseTheme` convierte v1 → v2 sin perder nada). |
| **RPC `save_site`** | Guarda tema + navegación + páginas (upsert, borrado lógico y orden) en **una transacción**, con RLS. |
| **`get_public_catalog`** | Ahora incluye páginas publicadas y navegación. Sigue siendo una sola llamada. |
| **Migración de datos** | Cada catálogo existente recibe una página **Inicio** con Hero (si tenía portada o descripción) + "Catálogo completo" (búsqueda y categorías, igual que antes) + Contacto, y su ítem de navegación. No se pierde nada. |
| **Badges por ítem** | En `catalog_items.attributes` (JSONB ya existente): sin migración. |

## 6. Cambios en el frontend

- Nuevo **motor de renderizado web** `src/site-renderer`: `SiteShell` → `SiteHeader` (7 estilos) → `PageView` → secciones (registro) → `SiteFooter`. Reemplaza `catalog-renderer` y reutiliza su lógica de catálogo (búsqueda, filtros, tarjetas).
- **Sistema de diseño v2** (`src/lib/design`): tokens resueltos una vez y consumidos por la web (variables CSS) **y** por el PDF (estilos numéricos).
- **Builder** (`/dashboard/sitio`): panel izquierdo con Páginas / Secciones / Navegación / Diseño, y preview en vivo con escritorio/tablet/móvil y navegación entre páginas. Guardado único y atómico.
- **Estudio de PDF**: configuración por pestañas + preview del PDF real + descarga.
- Negocio: slogan e información adicional. Ítems: badges.

## 7. Cambios en el backend

- Server Actions: `saveSite` (valida todo con Zod y llama a la RPC), `updateBusinessProfile` (slogan), `savePdfSettings`, etc.
- Route Handler de PDF: `GET` (descarga con la configuración guardada) y `POST` (preview con la configuración en borrador, sin guardar).
- Rutas públicas dinámicas: `/catalogo/[slug]` (página de inicio), `/catalogo/[slug]/[pagina]` y `/catalogo/[slug]/p/[item]`. Header y footer en un layout compartido: navegar entre páginas no recarga el sitio.

## 8. Qué se reutiliza

- Todo el modelo de negocio, ítems, categorías, imágenes, auth, RLS y Storage.
- Pipeline de imágenes (redimensionado en cliente + subida directa).
- Lógica de búsqueda, filtros y agrupación del catálogo (`filter.ts`).
- Caché del sitio público por tag, estructura de Server Actions (`useAction`, `ActionResult`), componentes de formulario (`fields`, `ColorField`, `ImageField`, `SortableList`).
- Descarga de fuentes e imágenes del PDF (`fonts.ts`, `images.ts`).

## 9. Qué se refactoriza

| Componente | Por qué |
| --- | --- |
| `lib/theme/schema.ts` → `lib/design/theme.ts` (v2) | El tema v1 no modela fondos, sombras, botones, espaciado ni estilos de header/tarjeta. |
| `catalog-renderer/*` → `site-renderer/*` | Pasa de "una página fija" a "páginas compuestas por secciones". `CatalogView` se convierte en la sección "Catálogo completo". |
| `DesignStudio` → `Builder` | El diseño se edita junto con páginas y secciones y con la misma preview. |
| `CatalogPdfDocument` → plantillas PDF | Cada plantilla es una composición distinta que consume los mismos tokens del tema. |
| Rutas `/dashboard/design/*` | Redirigen al builder. |

## 10. Plan por fases

1. **Sistema de diseño v2**: tema, tokens, fondos, patrones, presets, estilos de navbar, tarjetas y botones, iconos y texto enriquecido.
2. **Base de datos**: migración, RPCs, tipos y pruebas de RLS.
3. **Modelo del sitio**: secciones (registro y schemas), páginas, navegación, view model y sitio inicial.
4. **Render web**: shell, header, footer, secciones, tarjetas, badges y rutas públicas con SEO por página.
5. **Builder**: páginas, secciones, editores, navegación, diseño, preview multi-dispositivo y guardado atómico.
6. **Negocio e ítems**: slogan, información adicional y badges.
7. **PDF**: configuración, 6 plantillas, render de secciones, preview y descarga.
8. **Limpieza y verificación**: build, tipos, lint, pruebas de DB, verificación visual y documentación.

## Decisiones sobre qué es global, por página o por sección

| Configuración | Global | Página | Sección | Motivo |
| --- | :---: | :---: | :---: | --- |
| Colores, tipografía, botones, sombras, radios | ✔ | | | La identidad debe ser consistente; por eso no se sobrescriben por página. |
| Fondo | ✔ | ✔ | ✔ | Es lo que más diferencia visualmente. Cascada: sección > página > global. |
| Color de texto | | | ✔ (auto, claro, oscuro) | Necesario sobre fondos oscuros o imágenes. |
| Espaciado vertical | ✔ | | ✔ | Ajuste fino por sección sin romper el ritmo global. |
| Estilo de tarjeta | ✔ | | ✔ (opcional) | Una sección de productos puede verse distinta a la del catálogo. |
| Columnas | | | ✔ (escritorio, tablet, móvil) | Dependen del contenido de cada sección. |
| Header y footer | ✔ | | | Deben ser los mismos en todo el sitio. |
| SEO | ✔ (sitio) | ✔ (página) | | La página sobrescribe al sitio. |
