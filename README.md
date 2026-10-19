# Vitrina: sitio web + catálogo para pequeños negocios

[![CI](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/codeql.yml/badge.svg)](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/codeql.yml)

SaaS multi-tenant para que un pequeño negocio (cafetería, ferretería, estudio de servicios…) arme **sin código** un sitio comercial con páginas, secciones y diseño propio, que además funciona como **catálogo de productos y servicios** y se exporta a **PDF** listo para compartir. Incluye un asistente (Garfield) que edita el sitio a partir de pedidos en lenguaje natural.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript estricto · Supabase (Postgres + Auth + Storage, RLS) · Zod 4 · MUI 9 (sólo panel) · @react-pdf/renderer · sharp. Sin backend separado; se despliega en Vercel.

> Demo sin cuenta: `npm run dev` y abre `/demo` (sitio de ejemplo) y `/demo/pdf` (catálogo PDF). No necesita Supabase.

## Decisiones técnicas destacadas

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Aislamiento multi-tenant | **RLS en todas las tablas (12) + Storage**, claves foráneas compuestas `(business_id, id)` y funciones `SECURITY DEFINER` con `search_path` vacío para lo privilegiado. Las Server Actions validan además permisos y entrada (Zod). | La base de datos es la última línea de defensa: un bug en la app o una llamada directa a la API REST no puede cruzar negocios. 153 pruebas lo verifican sobre Postgres real (PGlite). |
| Catálogo público | Una sola RPC (`get_public_catalog`) cacheada con ISR + tag por negocio; el rol `anon` no lee tablas. El bundle del sitio público no incluye Zod (43 KB gzip). | Rápido y barato: una visita no cacheada hace una llamada; publicar invalida sólo ese negocio. |
| Un renderer, dos destinos | El mismo modelo de secciones/temas se dibuja en la web (React) y en PDF (react-pdf), con tokens de diseño compartidos. | El PDF siempre coincide con el sitio sin mantener dos diseños. |
| Guardado del editor | Todo se edita en memoria y se guarda con una transacción (`save_site`) con detección de conflictos. | Sin estados a medias; deshacer y vista previa son gratuitos. |
| Asistente con IA acotada | El modelo sólo **propone** acciones tipadas (Zod) que el editor valida y aplica con el mismo reducer que la interfaz; lo simple se resuelve sin IA (router local). | Un prompt malicioso no puede hacer nada que el usuario no pueda hacer; funciona sin clave de API. |
| Medios | Biblioteca única con referencias (una imagen se sube una vez y se reutiliza), descargas de URLs con protección SSRF (IP verificada al conectar) y borrado sólo de lo que nadie usa. | Sin duplicados ni imágenes rotas; seguro frente a URLs internas. |

Más detalle: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Arquitectura (resumen)

```
Navegador ──▶ Next.js (Vercel)
               ├─ proxy.ts ............ refresca la sesión y protege /dashboard, /admin
               ├─ Server Components .... leen con el cliente de sesión (RLS)
               ├─ Server Actions ...... validan (Zod) + permisos → Supabase (RLS)
               ├─ /api/assistant ...... Garfield: router local → modelo (opcional) → acciones tipadas
               ├─ /api/catalogs/:id/pdf  genera el PDF (react-pdf) con el mismo modelo del sitio
               └─ /catalogo/[slug] .... sitio público (ISR, una RPC por visita no cacheada)
Supabase ──▶ Postgres (RLS, funciones, auditoría) · Auth (usuario + contraseña) · Storage (bucket público, escritura con RLS)
```

## Inicio rápido

Requisitos: **Node.js 22 o superior** (`.nvmrc` fija 24) y npm.

```bash
npm ci
```

```bash
npm run dev
```

Con eso ya funcionan la landing, `/demo` y `/demo/pdf`. Para el panel (`/login`) configura Supabase: [Configurar Supabase](#configurar-supabase).

```bash
npm run check
```

Corre typecheck, lint, pruebas unitarias y pruebas de base de datos (no necesita Supabase ni Docker).

Documentación adicional:
- Garfield AI (asistente del editor): [`docs/GARFIELD-AI.md`](docs/GARFIELD-AI.md)
- Auditorías por versión y decisiones: [`docs/AUDITORIA-V2.md`](docs/AUDITORIA-V2.md) · [`V4`](docs/AUDITORIA-V4.md) · [`V5`](docs/AUDITORIA-V5.md) · [`Calidad y seguridad (oct-2026)`](docs/AUDITORIA-CALIDAD.md)
- Análisis de catálogos PDF de referencia: [`docs/ANALISIS-CATALOGOS-PDF.md`](docs/ANALISIS-CATALOGOS-PDF.md)
- Pendientes y recomendaciones: [`docs/ROADMAP.md`](docs/ROADMAP.md) · Cómo contribuir: [`CONTRIBUTING.md`](CONTRIBUTING.md)

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
     7. `20261020000000_security_hardening.sql` (sólo permisos: las membresías y los catálogos se crean únicamente desde el panel de administración; límite de intentos de login y cupo diario de Garfield)
     8. `20261021000000_function_privileges.sql` (sólo permisos: quita EXECUTE de funciones internas que no deben llamarse por la API; resuelve las advertencias evitables del *Security Advisor*)
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

Requisitos: Node.js 22 o superior (`.nvmrc` fija la versión usada en CI).

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
| `npm run typecheck` | Genera los tipos de rutas de Next y corre TypeScript estricto. |
| `npm run lint` | ESLint (reglas de Next.js, TypeScript y React Compiler). |
| `npm test` | Pruebas unitarias + pruebas de base de datos. |
| `npm run test:unit` | Pruebas unitarias (`tests/**`): seguridad (SSRF, redirecciones), dominio, editor, Garfield, PDF. |
| `npm run test:coverage` | Igual, con cobertura (`coverage/lcov.info`). |
| `npm run test:db` | Migraciones + RLS, roles, auditoría, límites y aislamiento multi-tenant sobre PGlite (sin Docker). |
| `npm run test:e2e` | Pruebas end-to-end con Playwright sobre el build de producción (compila y levanta `next start` en el puerto 3100). |
| `npm run test:e2e:app` | E2E con sesión: levanta Supabase local en Docker, reinicia su base, crea un admin de prueba y prueba login, admin, panel y sitio publicado (puerto 3200). |
| `npm run check` | typecheck + lint + pruebas unitarias y de base de datos (lo mismo que CI, sin el build ni las E2E). |
| `npm run admin:create` | Crea o promueve el administrador de la plataforma (usa `.env.local`). |
| `npm run db:types` | Regenera tipos desde Supabase en `src/types/database.generated.ts`. |

---

## Pruebas

| Capa | Herramienta | Qué cubre |
| --- | --- | --- |
| Base de datos (153) | PGlite (Postgres en WASM) con stubs de `auth`/`storage` | Todas las migraciones en orden (incluida la migración de datos v1), RLS por tabla y por rol, Storage, límites de plan, RPCs de administración, auditoría, referencias de medios y límite de intentos. |
| Unitarias (196) | `node:test` + `tsx` | Anti-SSRF (incluidas IPv4 escondidas en IPv6), redirecciones seguras, slugs, precios, usuarios, planes, acciones de contacto, paginación, reducer del editor (guardado concurrente), Garfield (router local, ejecutores, proveedores con `fetch` simulado), PDF, pedido por WhatsApp (total y mensaje), catálogo de traducciones y equivalencia de optimizaciones. |
| End-to-end (15) | Playwright (Chromium, escritorio y móvil) sobre `next build` + `next start` | Landing en español/inglés (Accept-Language y selector que se recuerda), modo claro/oscuro, pedido por WhatsApp completo en la demo (cantidades, total, mensaje de wa.me, persistencia, vaciar, Escape), ficha de producto, servicios y agotados sin pedido, móvil sin desbordes, redirección al login y respuestas 404. Sin Supabase: corren igual en CI. |
| End-to-end con sesión (8) | Playwright + Supabase local (Docker, `supabase/config.toml`) con la base reiniciada en cada ejecución | Login (correcto, contraseña incorrecta, regreso a la página pedida), el admin crea un negocio y se asigna, inicio del panel, producto sin foto/precio en "Revisa tu catálogo" y su filtro, publicar y que un visitante anónimo lo pida por WhatsApp en el sitio real, e idioma guardado en el perfil que se aplica al entrar desde otro navegador. |

Las pruebas no usan red, reloj ni datos aleatorios sin control, así que son deterministas en CI. La cobertura (`npm run test:coverage`) mide los módulos que cargan las pruebas: en la última ejecución, 88 % de líneas y 82 % de ramas sobre 77 módulos (lógica de dominio, seguridad y Garfield). Las E2E cubren los flujos públicos y los principales con sesión; las pantallas de edición (editor del sitio, estudio de PDF, medios) se prueban a mano: ver [Limitaciones](#limitaciones-conocidas).

## Integración continua

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada pull request y en `main`:

| Job | Qué hace |
| --- | --- |
| Typecheck & lint | `npm ci` reproducible (lockfile) + `typecheck` + `lint`. |
| Tests | Pruebas unitarias con cobertura y pruebas de base de datos; publica `coverage/` como artefacto y un resumen en el job. |
| Production build | `next build` sin secretos (la app compila sin Supabase). |
| E2E (Playwright) | Instala Chromium y corre `npm run test:e2e` contra el build de producción, sin secretos; si falla, publica el reporte y las trazas. |
| E2E con sesión (Supabase local) | Levanta Supabase en Docker dentro del runner y corre `npm run test:e2e:app`. Tampoco usa secretos. |
| Dependency audit | `npm audit --omit=dev --audit-level=high`. |
| Dependency review | En PRs, bloquea dependencias nuevas con vulnerabilidades altas. |
| Secret scan | gitleaks sobre todo el historial. |

Además: [`codeql.yml`](.github/workflows/codeql.yml) (análisis estático de seguridad, semanal y en PRs), [`dependabot.yml`](.github/dependabot.yml) (actualizaciones semanales agrupadas) y [`keepalive.yml`](.github/workflows/keepalive.yml) (consulta `/api/health` de producción cada 3 días). Las acciones están fijadas por SHA y cada job tiene permisos mínimos; ningún job necesita secretos.

**Configuración manual en GitHub** (no se puede hacer desde el repositorio):
1. *Settings → Branches → Branch protection* para `main`: exigir los checks `Typecheck & lint`, `Tests`, `Production build`, `E2E (Playwright)`, `Dependency audit` y `Secret scan` (y `Analyze (javascript-typescript)` si usas CodeQL).
2. *Settings → Code security*: activar *Dependabot alerts* y *Secret scanning*. CodeQL es gratis en repos públicos; en privados requiere GitHub Advanced Security.

## Seguridad

- **Autorización en la base de datos** (RLS) además de en las Server Actions; la service role sólo se usa en el servidor para la API de administración de Auth, el login por usuario y el límite de intentos.
- **Sin registro público**: las cuentas las crea un administrador; los roles viven en la base y no se pueden cambiar desde el navegador.
- **Login**: límite de 10 intentos por cuenta y 30 por IP cada 15 minutos, compartido entre instancias; redirección posterior sólo a rutas internas.
- **Descargas de URLs** (biblioteca, Garfield, PDF): sólo https, IP pública verificada al conectar (incluye formas IPv6 de IPv4 privadas), redirecciones re-verificadas, tope de tamaño y verificación de tipo real de imagen.
- **Cabeceras**: `frame-ancestors`/`X-Frame-Options` (anti-clickjacking), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS en producción.
- **Errores**: los mensajes de Postgres o del proveedor de IA nunca llegan al usuario; los errores inesperados muestran un código (`digest`) para buscarlo en los logs.

Para reportar un problema de seguridad, ver [`SECURITY.md`](SECURITY.md).

## Limitaciones conocidas

- Las pruebas end-to-end cubren el sitio público, la landing y los flujos principales con sesión; el editor del sitio, el estudio de PDF, la subida de imágenes y Garfield todavía se revisan a mano. Las reglas críticas (permisos, validación, cálculo) están cubiertas por las pruebas de base de datos y unitarias.
- La CSP es mínima (sin `script-src`): una CSP estricta exige nonces por página y haría dinámico el catálogo público.
- `src/types/database.ts` se mantiene a mano junto con las migraciones; `npm run db:types` genera la versión oficial para compararla.
- El límite por cuenta del login también puede usarse para bloquear temporalmente (15 min) a un usuario cuyo nombre se conoce; es el compromiso habitual frente a la fuerza bruta.

## Desplegar en Vercel

Las funciones corren en `iad1` (Washington D.C., `vercel.json`), junto a una base de Supabase en *East US*: si tu proyecto de Supabase está en otra región, cambia `regions` por la más cercana.

**Antes del primer despliegue (Supabase)**
1. Aplica todas las migraciones de `supabase/migrations/` (ver [Configurar Supabase](#configurar-supabase)).
2. *Authentication → Sign In / Providers*: apaga **Allow new users to sign up**. La clave pública viaja en el JavaScript del sitio; con el registro abierto cualquiera podría crear cuentas por la API (nacen deshabilitadas, pero ocupan espacio y pueden llamar funciones autenticadas).
3. Crea el primer administrador (`npm run admin:create`) si la base es nueva.

**Proyecto en Vercel**
1. *Add New → Project* → importa el repositorio (framework Next.js, sin cambiar comandos).
2. *Environment Variables* (Production y Preview):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role / secret key (sin `NEXT_PUBLIC_`) |
   | `GEMINI_API_KEY` | Opcional: Garfield con IA |
   | `NEXT_PUBLIC_SITE_URL` | Opcional: dominio propio. Sin ella se usa el dominio de producción de Vercel. |

   Las variables `NEXT_PUBLIC_*` se fijan al compilar: si las cambias, vuelve a desplegar.
3. *Deploy*. Cada PR recibe una vista previa y cada merge a `main` despliega producción.

**Después del despliegue**
1. Verifica `https://<tu-dominio>/api/health` → `{"status":"ok","database":"ok"}`.
2. Supabase → *Authentication → URL Configuration*: pon el dominio como *Site URL*.
3. GitHub → *Settings → Secrets and variables → Actions → Variables*: crea `PRODUCTION_URL` con el dominio. El workflow [`keepalive.yml`](.github/workflows/keepalive.yml) consulta `/api/health` cada 3 días para que el plan gratuito de Supabase no pause el proyecto (se pausa tras 7 días sin actividad).
4. Opcional: dominio propio en *Settings → Domains* (y actualiza `NEXT_PUBLIC_SITE_URL`).

> Las vistas previas de PRs usan la misma base que producción. Vercel las protege con login por defecto (*Deployment Protection*); para separar datos, crea un segundo proyecto de Supabase y usa sus claves sólo en *Preview*.

Notas de costo en el plan gratuito:
- La generación de PDF corre como función de Node (`maxDuration = 60`); catálogos de cientos de ítems tardan unos segundos.
- El optimizador de imágenes de Vercel tiene una cuota mensual. Si se agota, usa `NEXT_PUBLIC_IMAGE_OPTIMIZATION=false`.
- El catálogo público se sirve desde caché (ISR + tag por negocio). Cada visita no cacheada hace **una sola** llamada a Supabase.

---

## Estructura

```
supabase/
  migrations/                  v1 (esquema, RLS, Storage) · v2 (páginas, navegación, PDF) · v3 (atributos) · v4 (acceso, roles, auditoría) · v5 (biblioteca) · rendimiento · seguridad
  tests/rls.test.mjs           153 pruebas de migraciones, aislamiento, roles, auditoría, medios y límites (PGlite)
scripts/create-admin.mjs       Crea o promueve el administrador (npm run admin:create)
tests/                         196 pruebas unitarias (npm run test:unit)
  lib/                         seguridad (SSRF, redirecciones, rutas de Storage) y dominio (slugs, precios, planes, contacto…)
  builder/                     reducer del editor (guardado con cambios concurrentes)
  assistant/                   Garfield: router local, ejecutores sitio/PDF, proveedores, herramientas, plantillas
.github/                       CI (ci.yml), CodeQL y Dependabot
e2e/public/                    15 pruebas end-to-end sin sesión (npm run test:e2e)
e2e/app/                       8 pruebas end-to-end con sesión sobre Supabase local (npm run test:e2e:app)
playwright.config.ts           Proyectos escritorio, móvil y app; levanta el build de producción
scripts/e2e-app.mjs            Levanta Supabase local, reinicia la base, crea el admin de prueba y corre las E2E con sesión
supabase/config.toml           Supabase local para las E2E (sólo base, auth, API y storage)
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
    api/assistant/             Garfield AI: interpreta el pedido y devuelve acciones (sólo importa fotos libres a la biblioteca)
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
    security/                  Límite de intentos compartido (Postgres)
    business · contact · plans · utils
```
