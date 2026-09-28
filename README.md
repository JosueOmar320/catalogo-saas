# Vitrina: sitio web + catálogo para pequeños negocios

SaaS multi-tenant para construir un pequeño sitio comercial (páginas, secciones, navegación y diseño propio) que además funciona como catálogo de productos y servicios, y exportarlo a PDF. Todo sin escribir código.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + Auth + Storage) · Zod 4 · React Hook Form · MUI 9 (solo en el panel) · Lucide · @react-pdf/renderer. Sin backend separado; se despliega en Vercel.

- Arquitectura, modelo de datos y decisiones: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Auditoría de la v1 y plan de la v2: [`docs/AUDITORIA-V2.md`](docs/AUDITORIA-V2.md)
- Funcionalidades pendientes y recomendaciones: [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## Funcionalidades

| Área | Qué incluye |
| --- | --- |
| Sitio web | Páginas ilimitadas (crear, editar, duplicar, eliminar, reordenar, activar/desactivar, página de inicio, slug y SEO por página). URLs `/catalogo/negocio/<pagina>` generadas desde las páginas del usuario. |
| Secciones | 13 tipos: Hero (imagen, video, botones, altura, overlay), Texto (con formato e imagen), Productos (destacados, recientes, categoría, elegidos; grilla, carrusel o lista), Servicios, Catálogo completo (buscador y filtros), Categorías (4 estilos), Banner, Galería (grilla, mosaico, carrusel), Beneficios con íconos, Testimonios, Contacto (con mapa), Redes sociales y Separador. Agregar, reordenar, duplicar, ocultar y eliminar. |
| Estilo por sección | Fondo (color, degradado, imagen, patrón), color de texto automático, espaciado, ancho, ocultar en móvil/escritorio, ancla, columnas por dispositivo, estilo de tarjeta. |
| Navegación | Menú ordenable con páginas, enlaces externos, WhatsApp, teléfono y email, como enlace o botón. 7 estilos de header (Minimal, Clásico, Centrado, Moderno, Transparente, Oscuro, Elegante), logo y menú posicionables, sticky, altura, botón destacado, fondo con imagen. 4 estilos de footer. |
| Diseño | 10 temas iniciales (Minimal, Elegante, Restaurante, Moda, Corporativo, Moderno, Oscuro, Lujo, Colorido, Industrial). 12 colores, 11 fuentes (títulos, texto y precios), tamaño, peso, interlineado, espaciado de letras, mayúsculas; espaciado, ancho máximo, radios, bordes, sombras; botones (estilo, forma, tamaño, hover, sombra). |
| Fondos | Color, degradado lineal o radial, imagen (posición, tamaño, repetición, opacidad, overlay) y 10 patrones o texturas. Se definen de forma global, por página y por sección. |
| Tarjetas y badges | 7 estilos de tarjeta, imagen arriba/lateral/con texto encima/circular, proporción, alineación, hover y botón. Badges Nuevo, Destacado, Oferta, Popular, Agotado y uno personalizado, con texto, color, forma, estilo y posición editables. |
| Builder | Panel Páginas / Navegación / Diseño con preview en vivo en escritorio, tablet y móvil. Navegación entre páginas dentro de la preview y edición de una sección con un clic sobre ella. Guardado atómico. |
| PDF | 6 plantillas con composiciones distintas (Clásico, Moderno, Editorial, Minimal, Lujo, Menú). Usa colores, fuentes, logo y fondo del sitio. A4, Carta o A5; vertical u horizontal; márgenes; portada editable; encabezado y pie configurables; qué incluir y en qué orden (portada, catálogo, cualquier página, contacto); columnas e imágenes; ahorro de tinta. Preview real antes de descargar. |
| Negocio | Nombre, logo, slogan, descripción, contacto, horarios, información adicional y redes: se reutilizan en navbar, footer, secciones, PDF y SEO. |
| Todo lo de la v1 | Cuenta, onboarding, productos y servicios, categorías, imágenes, publicación, SEO, seguridad (RLS) y límites de plan. |

## Variables de entorno

Copia `.env.example` a `.env.local`.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Publishable key (`sb_publishable_…`). También acepta la anon key legacy como `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `NEXT_PUBLIC_SITE_URL` | En producción | URL pública sin `/` final. Se usa en emails, canonical, Open Graph y enlaces del PDF. En Vercel, si falta, se usa el dominio de producción. |
| `NEXT_PUBLIC_APP_NAME` | No | Nombre comercial (por defecto "Vitrina"). |
| `NEXT_PUBLIC_IMAGE_OPTIMIZATION` | No | `false` desactiva el optimizador de imágenes de Vercel (las imágenes ya se suben optimizadas). |
| `SUPABASE_PROJECT_ID` | No | Solo para `npm run db:types`. |

> La app **no usa la service role key**: todas las operaciones corren con la sesión del usuario y RLS.

---

## Configurar Supabase

1. **Crear el proyecto** en [supabase.com](https://supabase.com) (el plan gratuito alcanza para empezar).
2. **Aplicar el esquema.** Elige una opción:
   - Desde el panel: *SQL Editor* → ejecuta **en orden** cada archivo de `supabase/migrations/`:
     1. `20260927000000_init.sql` (tablas, RLS, Storage, planes)
     2. `20260928000000_site_builder.sql` (páginas, navegación, PDF, slogan y migración de datos)
   - Con la CLI: `npx supabase link --project-ref <ref>` y luego `npx supabase db push` (aplica sólo las que falten).

   **Si ya tenías la v1 funcionando**, ejecuta sólo el segundo archivo: convierte cada catálogo existente en un sitio con página "Inicio" (hero, catálogo completo y contacto). No se pierde nada.
3. **Auth → URL Configuration**
   - *Site URL*: tu `NEXT_PUBLIC_SITE_URL`.
   - *Redirect URLs*: `http://localhost:3000/auth/confirm`, `https://tu-dominio.com/auth/confirm` y, para previews de Vercel, `https://*-tu-equipo.vercel.app/**`.
4. **Plantillas de email (recomendado).** Con estas, los enlaces funcionan aunque se abran en otro dispositivo. En *Auth → Email Templates*:
   - *Confirm signup*: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding">Confirmar cuenta</a>`
   - *Reset password*: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Crear nueva contraseña</a>`

   Con las plantillas por defecto también funciona (flujo PKCE), pero el enlace debe abrirse en el mismo navegador.
5. **Emails en producción.** El servidor de email incluido en Supabase tiene un límite muy bajo por hora. Configura SMTP propio (Resend, Postmark, SES) en *Auth → SMTP Settings*. Para desarrollo puedes desactivar *Confirm email*.
6. **Copiar las claves** (Project Settings → API) a `.env.local`.

---

## Ejecutar localmente

Requisitos: Node.js 20.9 o superior.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Abre http://localhost:3000. La landing, `/demo` y `/demo/pdf` funcionan incluso sin Supabase configurado.

**Opción 100% local con Supabase CLI** (requiere Docker):

```bash
npx supabase init
```

```bash
npx supabase start
```

Aplica la migración automáticamente. Usa la *API URL* y la *Publishable key* que imprime en `.env.local`. Studio queda en http://127.0.0.1:54323 y los emails de prueba en http://127.0.0.1:54324.

**Scripts**

| Script | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, build y servidor de producción. |
| `npm run typecheck` | TypeScript estricto. |
| `npm run lint` | ESLint (reglas de Next.js y React Compiler). |
| `npm run test:db` | Pruebas de RLS y aislamiento multi-tenant sobre PGlite (sin Docker). |
| `npm run check` | Las tres verificaciones anteriores. |
| `npm run db:types` | Regenera tipos desde Supabase en `src/types/database.generated.ts`. |

---

## Desplegar en Vercel

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel: *Add New → Project* → importa el repo (framework: Next.js, sin cambios de build).
3. En *Environment Variables* agrega `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL` (tu dominio final).
4. Deploy. Después agrega el dominio en Supabase (*Site URL* y *Redirect URLs*).
5. Opcional: dominio propio en *Settings → Domains*.

Notas de costo en el plan gratuito:
- La generación de PDF corre como función de Node (`maxDuration = 60`). En Hobby, el máximo configurable depende del plan; catálogos de cientos de ítems tardan unos segundos.
- El optimizador de imágenes de Vercel tiene una cuota mensual. Si se agota, usa `NEXT_PUBLIC_IMAGE_OPTIMIZATION=false`.
- El catálogo público se sirve desde caché (ISR + tag por negocio). Cada visita no cacheada hace **una sola** llamada a Supabase.

---

## Estructura

```
supabase/
  migrations/                  v1 (esquema, RLS, Storage) + v2 (páginas, navegación, PDF)
  tests/rls.test.mjs           59 pruebas de aislamiento y migración (PGlite)
src/
  proxy.ts                     Sesión de Supabase + protección de rutas
  app/
    catalogo/[slug]/           Sitio público: layout (header/footer) + [pageSlug] + p/[itemSlug]
    dashboard/sitio/           Builder (páginas, secciones, navegación, diseño)
    dashboard/export/pdf/      Estudio de PDF (configuración + preview + descarga)
    api/catalogs/[id]/pdf/     GET descarga · POST vista previa
    preview/[[...slug]]/       Vista previa privada navegable
    demo/[[...slug]]/          Sitio de ejemplo (+ /demo/pdf)
  site-renderer/               Motor web: shell, header, footer, páginas, 13 secciones, tarjetas
  features/
    builder/                   Estado, acciones y editores del builder
    pdf/                       Motor PDF: tokens, primitivas, 6 plantillas, documento
    items · categories · catalog · business · settings · media · auth
  lib/
    design/                    Sistema de diseño: tema v2, tokens, fondos, patrones, presets, fuentes, íconos, texto enriquecido
    site/                      Secciones, páginas, navegación, enlaces, view model, sitio inicial y de ejemplo
    pdf/                       Configuración del PDF
    catalog · business · contact · plans · auth · supabase · utils
```
