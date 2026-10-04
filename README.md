# Vitrina: sitio web + catálogo para pequeños negocios

SaaS multi-tenant para construir un pequeño sitio comercial (páginas, secciones, navegación y diseño propio) que además funciona como catálogo de productos y servicios, y exportarlo a PDF. Todo sin escribir código.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + Auth + Storage) · Zod 4 · React Hook Form · MUI 9 (solo en el panel) · Lucide · @react-pdf/renderer. Sin backend separado; se despliega en Vercel.

- Arquitectura, modelo de datos y decisiones: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Auditoría de la v1 y plan de la v2: [`docs/AUDITORIA-V2.md`](docs/AUDITORIA-V2.md)
- Análisis de catálogos PDF de referencia y arquitectura v3: [`docs/ANALISIS-CATALOGOS-PDF.md`](docs/ANALISIS-CATALOGOS-PDF.md)
- Garfield AI (asistente del editor): [`docs/GARFIELD-AI.md`](docs/GARFIELD-AI.md)
- Auditoría v4 (acceso controlado, administración, herramientas de Garfield, personalización): [`docs/AUDITORIA-V4.md`](docs/AUDITORIA-V4.md)
- Auditoría v5 (biblioteca de medios, Garfield híbrido, composición del sitio, PDF): [`docs/AUDITORIA-V5.md`](docs/AUDITORIA-V5.md)
- Funcionalidades pendientes y recomendaciones: [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## Funcionalidades

| Área | Qué incluye |
| --- | --- |
| Sitio web | Páginas ilimitadas (crear, editar, duplicar, eliminar, reordenar, activar/desactivar, página de inicio, slug y SEO por página). URLs `/catalogo/negocio/<pagina>` generadas desde las páginas del usuario. |
| Secciones | 21 tipos (incluida **Columnas**, composición libre: 1–4 columnas con bloques de título, texto, imagen, botones, lista con íconos, tarjeta, ícono, etiqueta, cifra, video, línea y espacio; composiciones listas como imagen + texto, tres tarjetas o proceso en pasos): Hero (imagen, video, botones, altura, overlay), Texto (con formato e imagen), Productos (destacados, recientes, categoría, elegidos; grilla, carrusel o lista), Servicios, Catálogo completo (buscador y filtros), Categorías (4 estilos), Banner / llamado a la acción, Galería (grilla, mosaico, carrusel), Beneficios con íconos, Testimonios, Contacto (con mapa), Redes sociales, Separador, **Imagen** (proporción, pie de foto, enlace), **Video** (YouTube, Vimeo o .mp4, a lo ancho o junto a un texto), **Preguntas frecuentes** (acordeón, lista o dos columnas, con datos estructurados para Google), **Planes y precios**, **Equipo**, **Cifras** y **Logos**. Agregar, reordenar, duplicar, ocultar y eliminar. Todas tienen versión PDF. |
| Estilo por sección | Organizado en Fondo · Diseño · Espaciado · Apariencia · Avanzado. Fondo (color, degradado, imagen con posición/tamaño/parallax, patrón, video) con overlay y color de texto automático; ancho (angosto, normal, ancho, completo), altura mínima, alineación vertical y del texto; espaciado arriba/abajo, margen y superposición con la sección anterior; sección como caja, borde, radio y sombra; divisores decorativos arriba y abajo (ola, curva, diagonal, zigzag, triángulo) con color, altura e inversión; ocultar en móvil/escritorio, ancla, columnas por dispositivo. |
| Navegación | Menú ordenable con páginas, enlaces externos, WhatsApp, teléfono y email, como enlace o botón. 7 estilos de header (Minimal, Clásico, Centrado, Moderno, Transparente, Oscuro, Elegante), logo y menú posicionables, sticky, altura, botón destacado, fondo con imagen. 4 estilos de footer. |
| Diseño | 10 temas iniciales (Minimal, Elegante, Restaurante, Moda, Corporativo, Moderno, Oscuro, Lujo, Colorido, Industrial). 15 colores (incluye éxito, advertencia y error), 11 fuentes (títulos, texto y precios); **jerarquía tipográfica** por nivel (H1, H2, H3, texto, pequeño, etiqueta, botón) con tamaño en escritorio y móvil, peso, interlineado, espaciado de letras, mayúsculas y fuente; espaciado, ancho máximo, radios, bordes, sombras; botones (estilo, forma, tamaño, hover, sombra). |
| Fondos | Color, degradado lineal o radial, imagen (9 posiciones, tamaño, repetición, opacidad, overlay, parallax), 10 patrones o texturas y video (.mp4/.webm, en secciones). Se definen de forma global, por página y por sección. |
| Tarjetas y badges | 7 estilos de tarjeta, imagen arriba/lateral/con texto encima/circular, proporción, alineación, hover y botón. Badges Nuevo, Destacado, Oferta, Popular, Agotado y uno personalizado, con texto, color, forma, estilo y posición editables. |
| Garfield AI | Asistente conversacional en el **editor del sitio y en el estudio de PDF** (sabe en cuál está; mascota: gato naranja). **Router híbrido:** los pedidos simples (incluso varios en una frase: "agrega X, luego cambia Y y pon Z") se resuelven al instante sin IA; los creativos van al modelo (Gemini, Claude u Ollama local). Usa imágenes de la biblioteca por descripción ("una foto de comida para el hero", "las últimas 6 imágenes", "el logo") también sin IA. Crea sitios completos desde plantillas. Crea páginas completas, agrega, edita, mueve, duplica y elimina secciones, cambia diseño, fondos, presentación de productos y menú a partir de pedidos en lenguaje natural. **Herramientas controladas:** busca productos, categorías e imágenes de la biblioteca; busca fotos libres (CC0) y las importa; usa imágenes adjuntadas en el chat como fondo, imagen o galería; crea, edita, reordena y elimina productos y categorías (con las mismas validaciones y permisos que los formularios). Encadena pasos ("crea la categoría Postres, agrega 3 productos y una sección con ellos"). Entiende "esta sección", "la anterior", "la de productos". Propone acciones validadas que se ejecutan con la misma lógica del editor; los cambios grandes se ven en vista previa y los destructivos piden confirmación; siempre se puede deshacer. Nada se guarda hasta pulsar "Guardar cambios". Usa Gemini gratis (o Claude, u Ollama local); sin clave, o si se agota la cuota del día, sigue funcionando en modo básico. |
| Plantillas de sitio | 10 plantillas (Restaurante, Corporativo, Servicios, Tienda, Catálogo de productos, Portafolio, Agencia, Landing page, Minimal, Elegante) = tema + páginas + secciones con textos de ejemplo. Reemplazan el sitio o agregan las páginas que falten; se aplican al guardar. |
| Builder | Panel Páginas / Navegación / Diseño con preview en vivo en escritorio, tablet y móvil. Navegación entre páginas dentro de la preview y edición de una sección con un clic sobre ella. Guardado atómico. |
| Presentación de productos | 12 layouts compartidos por web y PDF: Cuadrícula (o carrusel), Cuadrícula compacta, Tarjetas grandes, Lista compacta, Minimalista, Editorial, Imagen protagonista, Lista de precios, Zigzag, Ficha de detalle, Revista y Comparación (tabla con precio y atributos). Cada uno muestra sólo sus opciones: columnas por dispositivo y para PDF, separación, tamaño y forma de imagen (recta, redondeada, círculo, arco) con marco, proporción, posición de la imagen, separadores, alineación, estilo de tarjeta, galería y qué campos mostrar (imagen, descripción, precio, precio anterior tachado, porcentaje de descuento, aviso de no disponible, código, categoría, badges, atributos, botón). Cada sección tiene su propio layout, orden y límite. |
| Colecciones | Fuente de ítems de cualquier sección o bloque PDF: todos, destacados, nuevos, en oferta, populares, recientes, una categoría, un atributo (marca = X) o elegidos a mano; con orden y límite. |
| Catálogo web | Buscador (nombre, código, etiquetas y atributos), categorías, tipo, rango de precio, destacados/nuevos/ofertas, disponibilidad y filtros por atributo; orden por defecto y elegible por el visitante (nombre, precio, recientes, destacados); paginación por páginas, "Ver más" o scroll infinito. |
| Atributos personalizados | El negocio define sus propios atributos (texto, número con unidad, opciones, sí/no, lista) y decide si se filtran y si aparecen en tarjetas, ficha y PDF. Se completan en cada ítem. |
| PDF | Garfield integrado ("cuatro productos por página", "logo arriba a la izquierda y número de página abajo", "que parezca un catálogo de lujo"). Vista previa con miniaturas, zoom y clic para abrir el bloque de cada página. Páginas de imagen a sangre, promocional y contraportada. Estilo propio del PDF (fuentes, colores, tamaño, densidad) que por defecto hereda del sitio. Constructor por bloques: portada, índice automático (con números de página y enlaces), catálogo por categorías, colecciones, tabla comparativa, página de información, galería (incluso hexagonal), cualquier página del sitio, contacto con notas y saltos de página. 11 plantillas como presets (Comercial, Catálogo clásico, Editorial, Minimal, Folleto de servicios, Ficha técnica, Menú, Moderno, Lujo, Corporativo, Folleto de producto). Portada con 7 composiciones, textos (antetítulo, fecha, versión, texto adicional), imagen con forma, fondo, overlay y decoración. Categorías como título, banda con imagen, portada de página completa o capítulo numerado. N ítems por página, categoría en página nueva. Encabezado y pie en 3–4 estilos (línea, título, banda con @redes). Esquinas decorativas, destellos y marco. A4/Carta/A5, orientación, márgenes, fondo, ahorro de tinta. Vista previa real con selector de página. |
| Formato de precio | Texto previo ("VALOR:"), símbolo o código de moneda, antes o después ("365 C$"), decimales. |
| Negocio | Nombre, logo, slogan, descripción, contacto, horarios, información adicional y redes: se reutilizan en navbar, footer, secciones, PDF y SEO. |
| Acceso controlado | Sin registro público: las cuentas las crea un administrador. Inicio de sesión con **usuario y contraseña** (el email es opcional y no se pide). Roles ADMIN / USER guardados en la base de datos y validados en RLS, funciones SQL y Server Actions; nadie puede darse ADMIN desde el navegador. Cuentas y negocios se pueden suspender. |
| Administración (`/admin`) | Panel con métricas, usuarios (crear, editar, cambiar rol, suspender, restablecer contraseña, asignar negocios con rol), negocios (crear con dueño, plan, estado, catálogos), catálogos (activar/desactivar, principal), biblioteca de medios de todos los negocios, configuración y **registro de auditoría** (quién hizo qué y cuándo, con filtros). Preparado para planes, límites y funciones por negocio. |
| Medios (`/dashboard/media`) | Biblioteca tipo "Drive": carpetas (Imágenes, Logos, Productos, Fondos, Banners, Otros), subir varias o arrastrar, **agregar desde URL** (importar una copia o usar el enlace), buscar, filtrar, ordenar, renombrar, mover, reemplazar en todo el sitio, copiar URL, multiselección, ver dónde se usa y borrar sólo lo que no se usa. Miniaturas automáticas. Una imagen se sube una vez y se reutiliza en el sitio, productos, logo y PDF sin duplicarse. |
| Todo lo de la v1 | Productos y servicios, categorías, imágenes, publicación, SEO, seguridad (RLS) y límites de plan. |

## Variables de entorno

Copia `.env.example` a `.env.local`.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Publishable key (`sb_publishable_…`). También acepta la anon key legacy como `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `NEXT_PUBLIC_SITE_URL` | En producción | URL pública sin `/` final. Se usa en emails, canonical, Open Graph y enlaces del PDF. En Vercel, si falta, se usa el dominio de producción. |
| `NEXT_PUBLIC_APP_NAME` | No | Nombre comercial (por defecto "Vitrina"). |
| `NEXT_PUBLIC_IMAGE_OPTIMIZATION` | No | `false` desactiva el optimizador de imágenes de Vercel (las imágenes ya se suben optimizadas). |
| `GEMINI_API_KEY` | No | **Recomendada (gratis).** Activa la conversación completa de Garfield AI con Google Gemini. Se crea en [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Sólo servidor. |
| `ANTHROPIC_API_KEY` | No | Alternativa de pago: Garfield con Claude. |
| `ASSISTANT_MODEL` | No | Modelos separados por coma, en orden de preferencia (por defecto Gemini: `gemini-3.8-flash,gemini-3.5-flash-lite`; Claude: `claude-sonnet-5-5`). |
| `ASSISTANT_PROVIDER`, `ASSISTANT_BASE_URL`, `ASSISTANT_API_KEY` | No | Para usar cualquier API compatible con OpenAI (Ollama local, Mistral, Groq…). Ver `.env.example`. |
| `ASSISTANT_ROUTING` | No | `local-first` (por defecto: lo simple se resuelve sin IA), `llm-first` (todo al modelo) o `local-only` (nunca usa IA). |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí (para iniciar sesión con usuario y para `/admin`) | Service role / secret key (Project Settings → API). **Sólo servidor.** Se usa únicamente para: convertir el nombre de usuario en la cuenta de Auth al iniciar sesión, y crear/editar cuentas desde el panel de administración (API de Auth Admin). Todo lo demás corre con la sesión del usuario y RLS. También acepta `SUPABASE_SECRET_KEY`. |
| `AUTH_USERNAME_DOMAIN` | No | Dominio de los emails internos que Supabase Auth necesita (`usuario@usuarios.invalid` por defecto). Nunca se envían correos a esas direcciones. Si lo cambias, hazlo antes de crear usuarios. |
| `SUPABASE_PROJECT_ID` | No | Solo para `npm run db:types`. |

> La service role key **nunca** llega al navegador (módulo `server-only`) y no se usa para leer ni escribir datos de negocio: esas operaciones siguen pasando por RLS con la sesión del usuario.

---

## Configurar Supabase

1. **Crear el proyecto** en [supabase.com](https://supabase.com) (el plan gratuito alcanza para empezar).
2. **Aplicar el esquema.** Elige una opción:
   - Desde el panel: *SQL Editor* → ejecuta **en orden** cada archivo de `supabase/migrations/`:
     1. `20260927000000_init.sql` (tablas, RLS, Storage, planes)
     2. `20260928000000_site_builder.sql` (páginas, navegación, PDF, slogan y migración de datos)
     3. `20260929000000_catalog_engine.sql` (atributos personalizados)
     4. `20260930000000_admin_access.sql` (usuarios con nombre de usuario, roles, estados, administración, auditoría y biblioteca de medios)
     5. `20261001000000_media_library.sql` (carpetas, nombres, URLs externas, dónde se usa cada imagen y reemplazo en todo el contenido)
     6. `20261005000000_performance.sql` (conteos del panel de administración en SQL; sin ella el panel sigue funcionando con el método anterior, más lento)
   - Con la CLI: `npx supabase link --project-ref <ref>` y luego `npx supabase db push` (aplica sólo las que falten).

   **Si ya tenías una versión anterior funcionando**, ejecuta sólo los archivos que falten. El segundo convierte cada catálogo v1 en un sitio con página "Inicio"; el tercero sólo agrega la columna de atributos; el cuarto **no borra nada**: agrega columnas y tablas, asigna a cada cuenta existente un nombre de usuario (la parte del email antes de la @; si se repite, con un sufijo), deja las cuentas y negocios activos y registra las imágenes que ya estaban en Storage en la biblioteca. El quinto tampoco mueve archivos (ya están en Storage): agrega columnas a la biblioteca, asigna carpeta y nombre a lo existente y registra cualquier imagen referenciada que faltara. Las secciones de productos y la configuración del PDF de versiones anteriores se convierten al nuevo formato al leerlas. No se pierde nada.
3. **Desactivar el registro público:** *Authentication → Sign In / Providers → "Allow new users to sign up"* → apagado. (Aunque se dejara encendido, las cuentas creadas fuera del panel nacen **deshabilitadas** y no pueden entrar: lo decide la base de datos, no la interfaz.) También puedes apagar *Confirm email*: las cuentas creadas por el administrador ya vienen confirmadas.
4. **Copiar las claves** (Project Settings → API) a `.env.local`, incluida la **service role key** (`SUPABASE_SERVICE_ROLE_KEY`).
5. **Crear el primer administrador** (ver abajo). No hay administradores escritos en el código.

### Primer administrador

```bash
npm run admin:create -- --username admin --password "una-clave-larga" --name "Tu nombre"
```

Crea la cuenta (o, si el usuario ya existe, lo promueve) con la service role. Después, desde `/admin` se crean los demás usuarios y negocios. Un administrador no puede quitarse el rol a sí mismo ni dejar la plataforma sin administradores. Si ya tenías cuentas antes de la migración 4, sus nombres de usuario aparecen en *Table Editor → profiles* (o promueve una con el comando anterior usando su usuario).

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

Abre http://localhost:3000. La landing, `/demo` y `/demo/pdf` funcionan incluso sin Supabase configurado. Para entrar al panel (`/login`) necesitas Supabase, la service role key y un usuario creado con `npm run admin:create`.

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
| `npm run test:unit` | Pruebas unitarias (Garfield: acciones, modo básico, proveedores, herramientas seguras; secciones y layouts). |
| `npm run test:db` | Pruebas de RLS, roles, auditoría y aislamiento multi-tenant sobre PGlite (sin Docker). |
| `npm run check` | Todas las verificaciones anteriores. |
| `npm run admin:create` | Crea o promueve el administrador de la plataforma (usa `.env.local`). |
| `npm run db:types` | Regenera tipos desde Supabase en `src/types/database.generated.ts`. |

---

## Desplegar en Vercel

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel: *Add New → Project* → importa el repo (framework: Next.js, sin cambios de build).
3. En *Environment Variables* agrega `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sin prefijo `NEXT_PUBLIC_`), `NEXT_PUBLIC_SITE_URL` (tu dominio final) y, si usas Garfield completo, `GEMINI_API_KEY`.
4. Deploy. Después pon el dominio como *Site URL* en Supabase (*Auth → URL Configuration*).
5. Opcional: dominio propio en *Settings → Domains*.

Notas de costo en el plan gratuito:
- La generación de PDF corre como función de Node (`maxDuration = 60`). En Hobby, el máximo configurable depende del plan; catálogos de cientos de ítems tardan unos segundos.
- El optimizador de imágenes de Vercel tiene una cuota mensual. Si se agota, usa `NEXT_PUBLIC_IMAGE_OPTIMIZATION=false`.
- El catálogo público se sirve desde caché (ISR + tag por negocio). Cada visita no cacheada hace **una sola** llamada a Supabase.

---

## Estructura

```
supabase/
  migrations/                  v1 (esquema, RLS, Storage) + v2 (páginas, navegación, PDF) + v3 (atributos) + v4 (acceso, roles, auditoría, medios)
  tests/rls.test.mjs           126 pruebas de aislamiento, roles, auditoría, biblioteca de medios y migración (PGlite)
scripts/create-admin.mjs       Crea o promueve el administrador (npm run admin:create)
tests/assistant/               95 pruebas unitarias (router local, ejecutores sitio/PDF, media por descripción, plantillas, descarga segura, equivalencia de optimizaciones): npm run test:unit
src/
  proxy.ts                     Sesión de Supabase + protección de rutas
  app/
    (auth)/login/              Inicio de sesión con usuario y contraseña (no hay registro público)
    admin/                     Panel de administración: usuarios, negocios, catálogos, medios, auditoría, configuración
    (account)/cuenta/          Mi cuenta (datos y contraseña) · sin-acceso/
    catalogo/[slug]/           Sitio público: layout (header/footer) + [pageSlug] + p/[itemSlug]
    dashboard/sitio/           Builder (páginas, secciones, navegación, diseño)
    dashboard/export/pdf/      Estudio de PDF (bloques + preview por página + descarga)
    dashboard/catalog/attributes/ Atributos personalizados
    api/catalogs/[id]/pdf/     GET descarga · POST vista previa
    api/assistant/             Garfield AI: interpreta el pedido y devuelve acciones (no escribe en la base)
    preview/[[...slug]]/       Vista previa privada navegable
    demo/[[...slug]]/          Sitio de ejemplo (+ /demo/pdf)
  site-renderer/               Motor web: shell, header, footer, páginas, 21 secciones (incl. Columnas), tarjetas, ProductCollection (12 layouts)
  features/
    builder/                   Estado (reducer), acciones y editores del builder
    assistant/                 Garfield AI: ejecutor de acciones, panel, mascota, acciones de catálogo, proveedores y herramientas controladas (server/)
    admin/                     Server Actions, consultas y componentes del panel de administración
    pdf/                       Motor PDF: tokens, primitivas, portada, encabezado/pie/decoración, layouts de producto, bloques, skins, documento
    media/                     Biblioteca: MediaService (service.ts), procesamiento con sharp, Server Actions, UI tipo "Drive"
    items · categories · catalog · business · settings · auth
  lib/
    design/                    Sistema de diseño: tema v2, tokens, fondos, patrones, presets, fuentes, íconos, texto enriquecido
    site/                      Secciones, páginas, blueprints, plantillas de sitio, composiciones de Columnas, navegación, enlaces, view model
    assistant/                 Acciones de sitio y de PDF (Zod), modos, contexto, guía de capacidades generada, identidad
    pdf/                       Configuración del PDF v2 (bloques, plantillas como presets, migración desde v1)
    catalog/                   presentation (layouts), collections (fuentes y orden), attributes, settings (formato de precio)
    auth/                      Sesión, perfil, contexto del negocio, requirePlatformAdmin, nombre de usuario
    supabase/                  Clientes: navegador, servidor (sesión) y admin (service role, sólo servidor)
    storage/                   StorageProvider (Supabase hoy; R2/S3 implementando la interfaz)
    net/                       Descarga segura de URLs (anti-SSRF, IP verificada al conectar)
    business · contact · plans · utils
```
