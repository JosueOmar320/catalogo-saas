# Vitrina: arquitectura (v2, Website & Catalog Builder)

> La auditoría de la v1 y el plan de esta versión están en [AUDITORIA-V2.md](AUDITORIA-V2.md).

## Concepto

```
Business ──► Catálogo / Sitio
               ├── Tema (sistema de diseño: colores, tipografía, espaciado, bordes,
               │         sombras, botones, fondo, header, footer, tarjetas, badges)
               ├── Navegación (ítems ordenados: páginas, enlaces, WhatsApp…)
               ├── Páginas ──► Secciones (13 tipos, JSONB) ──► Productos / Servicios / Contenido
               ├── Configuración de PDF (plantilla, papel, portada, header/footer, contenido)
               └── Categorías, ítems, imágenes (sin cambios de la v1)
                          │
                    SiteViewModel  (lib/site/view-model.ts: un único modelo)
                          │
            ┌─────────────┴─────────────┐
       Web renderer                 PDF renderer
   (src/site-renderer)          (src/features/pdf)
   público · preview · demo     6 plantillas · preview
```

**Un solo modelo, dos destinos.** La lógica de negocio (qué ítems muestra una sección, badges, texto del hero, color de texto sobre un fondo, enlaces) vive en `lib/site/resolve.ts` y `lib/site/links.ts`, y la comparten ambos renderers. Los estilos salen de `lib/design/tokens.ts`: la web los convierte en variables CSS y el PDF en estilos en puntos.

## Modelo de datos

| Tabla / columna | Qué guarda | Por qué así |
| --- | --- | --- |
| `catalog_pages` | título, slug, inicio, publicada, posición, `sections jsonb`, `style jsonb`, `seo jsonb` | La página es entidad (URL única, orden, SEO propio). Las secciones son configuración: JSONB validado con Zod. Un tipo de sección nuevo no requiere migración. |
| `catalogs.theme` (v2) | sistema de diseño completo | Se migra desde v1 en código (`parseTheme`), sin perder datos. |
| `catalogs.navigation` | `{ items: [...] }` | Única fuente de verdad del menú. |
| `catalogs.pdf` | configuración del PDF | Crece independiente de `settings`. Migra desde `settings.pdf` (v1). |
| `businesses.slogan` | slogan | Reutilizado en hero, footer, PDF y SEO. |
| `catalog_items.attributes` | `badges`, `customBadge` | JSONB extensible que ya existía: sin migración. |

- **RPC `save_site`**: guarda tema, navegación y páginas (upsert, borrado lógico, orden, inicio único) en una transacción con RLS. Detecta ids ajenos (`page_conflict`).
- **RPC `get_public_catalog`**: agrega páginas publicadas, navegación y slogan. Sigue siendo 1 llamada por sitio (cacheada por tag).
- **Migración de datos**: cada catálogo existente recibe "Inicio" = Hero (portada/descripción) + Catálogo completo (con las opciones de su tema v1) + Contacto. Además, si un sitio no tuviera páginas, el sitio público y el builder generan la misma página en memoria.

## Qué es global, por página o por sección

| Configuración | Global | Página | Sección |
| --- | :---: | :---: | :---: |
| Colores, tipografía, botones, sombras, radios, espaciado | ✔ | | |
| Fondo (color, degradado, imagen, patrón/textura, overlay) | ✔ | ✔ | ✔ |
| Color de texto (auto/claro/oscuro) | | | ✔ |
| Padding vertical, ancho, ocultar en móvil/escritorio, ancla | | | ✔ |
| Estilo de tarjeta | ✔ | | ✔ (opcional) |
| Columnas escritorio / tablet / móvil | | | ✔ |
| Header, footer | ✔ | | |
| SEO | ✔ | ✔ | |

La identidad (colores, tipografía, botones) es global a propósito: si cada página pudiera cambiarla, el sitio perdería coherencia. Los fondos sí van en cascada (sección > página > global), porque son lo que más diferencia una página de otra.

## Registros extensibles (agregar sin tocar el resto)

| Qué | Dónde se registra | TypeScript obliga a completar |
| --- | --- | --- |
| Tipo de sección | `lib/site/section-schemas.ts` + `section-registry.ts` | renderer web (`site-renderer/sections/index.ts`), editor (`builder/components/editors`), adaptador PDF (`SitePdfDocument.tsx`) |
| Preset de tema | `lib/design/presets.ts` | nada más |
| Estilo de header / tarjeta / footer | `lib/design/styles-registry.ts` | CSS por `data-style` |
| Fuente | `lib/design/fonts.ts` | `site-renderer/fonts.ts` |
| Patrón / textura | `lib/design/patterns.ts` (geometría) | web y PDF lo dibujan solos |
| Ícono | `lib/design/icons.ts` | web y PDF lo dibujan solos |
| Plantilla PDF | `lib/pdf/settings.ts` | `features/pdf/templates.tsx` |
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

## PDF

- `lib/pdf/settings.ts`: plantilla, papel (A4/Carta/A5), orientación, márgenes, contenido ordenable (portada, catálogo, páginas del sitio, contacto), portada, header, footer, fondo, ahorro de tinta y opciones de productos.
- `features/pdf/`: `tokens.ts` (tema → puntos), `primitives.tsx` (fondo con degradado, imagen y patrón; íconos, texto enriquecido, precio, badges), `templates.tsx` (6 composiciones), `SitePdfDocument.tsx` (ensamblado y adaptadores de secciones), `render.tsx`.
- `POST /api/catalogs/[id]/pdf` genera la preview con la configuración en borrador (sin guardarla); `GET` descarga con la configuración guardada. El servidor sólo descarga imágenes del propio negocio (sin SSRF).

## Seguridad

Igual que la v1 (RLS, FKs compuestas, privilegios por columna, Storage por carpeta, Zod en servidor), más:

- `catalog_pages`: RLS por negocio; escritura sólo owner/admin.
- `save_site` es `SECURITY INVOKER` (aplica RLS) y rechaza ids de páginas de otro catálogo.
- Cualquier ruta de imagen dentro del tema, las secciones o el PDF se valida en el servidor (`collectMediaPaths` + `isPathOwnedBy`).
- Colores validados como hex y texto enriquecido parseado a nodos React (sin `dangerouslySetInnerHTML`).
- 59 pruebas de base de datos (`npm run test:db`), incluida la migración de un catálogo v1.
