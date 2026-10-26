# Guía técnica: instalación, configuración y despliegue

Resumen del proyecto en el [README](../README.es.md) · Arquitectura en [ARQUITECTURA.md](ARQUITECTURA.md).

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
| `RESEND_API_KEY` | No | Clave de [Resend](https://resend.com) para el aviso semanal por correo. **Sólo servidor.** |
| `EMAIL_FROM` | No | Remitente del aviso, de un dominio verificado en Resend: `Vitrina <avisos@tudominio.com>`. |
| `CRON_SECRET` | No | Secreto aleatorio (16+ caracteres, `openssl rand -base64 32`). Vercel lo envía al llamar al cron y firma los enlaces de baja. Sin estas tres variables, el aviso corre en modo de prueba (calcula, no envía). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | No | Llaves de los avisos push de pedidos. Se generan una vez con `npx web-push generate-vapid-keys` (la privada es **sólo servidor**). Si cambian, cada usuario vuelve a activar los avisos. |
| `VAPID_SUBJECT` | No | Contacto para los servicios de push: `mailto:tu@correo.com` o una URL `https://`. |
| `VERCEL_API_TOKEN` | No | Token de Vercel (*Account Settings → Tokens*) con acceso al proyecto: la plataforma agrega y verifica los dominios propios de los negocios. **Sólo servidor y sólo Production.** |
| `VERCEL_PROJECT_ID` | No | ID del proyecto en Vercel (*Settings → General*, `prj_…`). |
| `VERCEL_TEAM_ID` | No | ID del equipo dueño del proyecto (`team_…`), si aplica. Sin `VERCEL_API_TOKEN` y `VERCEL_PROJECT_ID`, el dominio propio aparece como «todavía no disponible». |
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
     9. `20261022000000_profile_locale.sql` (idioma del perfil)
     10. `20261023000000_order_stats.sql` (contadores de pedidos por día)
     11. `20261024000000_review_email.sql` (preferencia y registro del aviso semanal)
     12. `20261025000000_site_views.sql` (visitas por día)
     13. `20261026000000_reviews.sql` (reseñas de clientes)
     14. `20261027000000_search_misses.sql` (búsquedas sin resultados)
     15. `20261028000000_item_costs.sql` (costo privado por ítem)
     16. `20261029000000_section_templates.sql` (secciones guardadas como plantilla)
     17. `20261030000000_custom_code.sql` (código propio por negocio o plan)
     18. `20261031000000_orders_inbox.sql` (bandeja de pedidos)
     19. `20261101000000_site_kind.sql` (tipo de sitio: con catálogo o sitio web)
     20. `20261102000000_hardening.sql` (auditoría oct-2026: existencias exactas al cancelar, versión del sitio contra guardados cruzados, menos ruido en la auditoría, retención de datos (`purge_old_data`, pg_cron si existe), sin lectura de perfiles ajenos, topes de tamaño en JSONB, claves de pertenencia inmutables por la API, candados en los límites de plan, `max_catalogs`, reseñas sólo del catálogo publicado y `site_kind` en el catálogo público). Si alguna fila existente excede un tope de tamaño, la restricción queda `NOT VALID` y avisa; revísala y valídala a mano.
     21. `20261103000000_review_replies.sql` (respuestas a reseñas)
     22. `20261104000000_site_versions.sql` (historial de versiones del sitio)
     23. `20261105000000_customers.sql` (WhatsApp del cliente en el pedido y lista de clientes)
     24. `20261106000000_push_notifications.sql` (suscripciones a avisos push de pedidos)
     25. `20261107000000_funnel_stats.sql` (recorrido de las visitas y de dónde llegan)
     26. `20261108000000_business_features.sql` (funciones encendidas o apagadas por negocio)
     27. `20261109000000_custom_domains.sql` (dominio propio por negocio)
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

Requisitos: Node.js 24 (`.nvmrc` fija la versión usada en CI; el mínimo es 22).

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
| Base de datos (417) | PGlite (Postgres en WASM) con stubs de `auth`/`storage` | Todas las migraciones en orden (incluida la migración de datos v1), RLS por tabla y por rol, Storage, límites de plan, RPCs de administración, auditoría, referencias de medios, límite de intentos, contadores de pedidos y de visitas (sólo la service role escribe; cuentan únicamente productos e ítems visibles del catálogo publicado) preferencias y registro del aviso por correo, búsquedas sin resultados (sólo la service role escribe, normalizadas, tope por día), costos privados (sólo miembros; nunca en el catálogo público), y reseñas (sólo la service role las crea, pendientes; el público lee sólo las aprobadas de productos visibles; el negocio modera sin poder cambiar lo que escribió el cliente). |
| Unitarias (463) | `node:test` + `tsx` | Anti-SSRF (incluidas IPv4 escondidas en IPv6), redirecciones seguras, slugs, precios, usuarios, planes, acciones de contacto, paginación, reducer del editor (guardado concurrente), Garfield (router local, ejecutores, proveedores con `fetch` simulado), PDF, pedido por WhatsApp (total, mensaje y resumen de 30 días), aviso por correo (contenido, escapado, idioma y enlaces de baja firmados), CSV (lectura, precios en ambos formatos, validación por línea, enlaces de fotos, ida y vuelta), horarios para pedir (preparación, días cerrados, zona horaria), días especiales (abierto/cerrado, horarios para pedir, texto y schema.org), zonas de entrega (envío, mínimo y mensaje), mayoreo (escalones, formulario y mensaje), pedido en mesa y folio, temporada (fechas, sitio público, sitemap) y «Combínalo con», sucursales y ventana de bienvenida, reseñas por aprobar en el aviso semanal, búsquedas sin resultados (datos personales fuera, ranking), lista de precios en texto, etiquetas con QR, lista compartida por enlace (ida y vuelta, datos alterados) y margen, propina, precio programado y reportes CSV, promociones automáticas (la mayor, cuánto falta, contra cupones) y «Nuevo» automático, existencias y dieta, opciones y extras del producto (precio "desde", formulario, vista, línea del pedido con extras y precios al día), notas por producto, horario de pedido, deshacer/rehacer del editor (agrupación, límite, cambios pendientes), entrega, envío, pedido mínimo, pago, cupones, precios al día, sugerencias y pausa del pedido, visitas (30 días y lo más visto), horario (abierto/cerrado en la zona del negocio, turnos nocturnos, agrupado, schema.org), ofertas con fecha de fin, ajuste de precios, kit para compartir (mensajes, texto en líneas, contraste), revisiones nuevas, sitemap de catálogos, datos estructurados, búsqueda por opciones y extras, reseñas (promedio y calificación en los datos estructurados), código QR y relacionados, catálogo de traducciones y equivalencia de optimizaciones. |
| End-to-end (58) | Playwright (Chromium, escritorio y móvil) sobre `next build` + `next start` | **Accesibilidad automática (axe, WCAG 2.1 A y AA)** de la landing, el login y todas las páginas del sitio de ejemplo, también con los filtros, el pedido, el formulario de opinión y la foto en grande abiertos, en escritorio y móvil. Landing en español/inglés (Accept-Language y selector que se recuerda), modo claro/oscuro, pedido por WhatsApp completo en la demo (cantidades, entrega a domicilio con dirección, envío y pago, total, mensaje de wa.me, persistencia, vaciar, Escape), ficha de producto, servicios y agotados sin pedido, la demo no cuenta pedidos, validaciones de `/api/orders` (cuerpo, tamaño, origen), cron y baja del aviso sin secreto o con enlace inválido, compartir y relacionados en la ficha, horario con reloj fijo (abierto, cerrado y aviso en el pedido), cupón inválido y válido, «¿Agregas algo más?», extras con máximo y nota por producto, «¿Para cuándo?», existencias y filtro por dieta, producto con horario (reloj fijo), repetir el último pedido y pedido guardado con precio viejo o producto eliminado, barra de anuncios (enlace, cerrar y recordar), validaciones de `/api/views` y que la demo no cuente visitas, reseñas en la demo (promedio en la tarjeta y la ficha, formulario), validaciones de `/api/search-misses` y que la demo no cuente búsquedas, pedido rápido (agregar desde la lista, opciones a la ficha), lista compartida por enlace que otra persona agrega a su pedido, foto a pantalla completa, favoritos (corazón, filtro y que se recuerden), mayoreo (cantidad escrita, precio y folio en el mensaje), pedido en mesa con `?mesa=3`, «Combínalo con» en la ficha y validaciones de `/api/reviews` (cuerpo, tamaño, origen, campo trampa), sitemap e imágenes para compartir inexistentes, producto con opciones (tarjeta → ficha → elegir → dos opciones en el mensaje), móvil sin desbordes, redirección al login y respuestas 404. Sin Supabase: corren igual en CI. |
| End-to-end con sesión (48) | Playwright + Supabase local (Docker, `supabase/config.toml`) con la base reiniciada en cada ejecución | Login (correcto, contraseña incorrecta, regreso a la página pedida), el admin crea un negocio y se asigna, inicio del panel, producto sin foto/precio en "Revisa tu catálogo" y su filtro, publicar y que un visitante anónimo lo pida por WhatsApp en el sitio real (el pedido se cuenta y aparece en el inicio del panel), importar un CSV y volver a importarlo sin duplicar, exportar, importar con enlaces de fotos (aviso de los que fallan), crear un producto con opciones y elegirlas en el sitio publicado, producto con extras y horario creado en el panel, existencias y dieta creadas en el panel, configurar entrega, pedido mínimo, pago, cupón y horario y verlos en el pedido del visitante, visitas y lo más visto en el inicio del panel, pausar pedidos y reanudarlos, oferta vencida y vigente, acciones masivas y ajuste de precios, búsqueda rápida y código QR, kit para compartir (imagen y mensajes), crear productos desde fotos (subida real a Storage), precio en la lista y deshacer al eliminar, imagen generada para compartir, datos estructurados y sitemap del catálogo publicado, orden por más vistos y revisión de productos sin descripción, deshacer y rehacer en el editor (botones y teclado), promoción automática que se aplica sola, propina en el pedido, precio programado (aviso y paso a precio guardado) y reporte por día en CSV, costo privado con margen en el formulario y la lista y aviso al bajar precios, búsqueda sin resultados que llega al inicio del panel, lista de precios del kit y etiquetas con QR, ventana de bienvenida (una sola vez) y sucursales (el pedido llega al WhatsApp de la elegida) configuradas en el panel, producto de temporada (404 fuera de fechas, aviso en la lista), extras copiados de otro producto y «Combínalo con» elegidos en el panel, mayoreo y pedidos en mesa creados en el panel (ficha, cantidad escrita y «Mesa: 7» en el mensaje), días especiales y zonas de entrega configurados en el panel (el sitio anuncia el día cerrado y el pedido pide la zona, aplica su mínimo y su envío), reseñas (el visitante opina, el panel avisa, el negocio la aprueba y se publica con su calificación), a quién le llega el aviso semanal y la baja con el enlace del correo y su reactivación en Mi cuenta, e idioma guardado en el perfil que se aplica al entrar desde otro navegador, y accesibilidad automática (axe) del panel, el editor del sitio, el PDF, medios, reseñas, Mi cuenta y la administración. |

Las pruebas no usan red, reloj ni datos aleatorios sin control, así que son deterministas en CI. La cobertura (`npm run test:coverage`) mide los módulos que cargan las pruebas: en la última ejecución, 94 % de líneas y 87 % de ramas (lógica de dominio, seguridad y Garfield). Las E2E cubren los flujos públicos y los principales con sesión; las pantallas de edición (editor del sitio, salvo deshacer y rehacer; estudio de PDF; medios) se prueban a mano: ver [Limitaciones](#limitaciones-conocidas).

## Integración continua

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre en cada pull request y en `main`:

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

Además: [`codeql.yml`](../.github/workflows/codeql.yml) (análisis estático de seguridad, semanal y en PRs), [`dependabot.yml`](../.github/dependabot.yml) (actualizaciones semanales agrupadas) y [`keepalive.yml`](../.github/workflows/keepalive.yml) (consulta `/api/health` de producción cada 3 días). Las acciones están fijadas por SHA y cada job tiene permisos mínimos; ningún job necesita secretos.

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
- **Retención**: `purge_old_data()` (sólo service role) borra datos personales de pedidos a los 180 días, intentos de login a los 2 días, auditoría de contenido a los 180 días y el resto a los 2 años, estadísticas diarias a los 400 días y el registro de avisos a los 90. Corre con pg_cron si la extensión está activa en Supabase y, además, la llama el cron semanal de `/api/cron/catalog-review`.
- **Guardados cruzados**: el editor envía la versión del sitio que cargó (`site_version`) y la base rechaza con `site_changed` un guardado sobre una versión más nueva (nadie pisa el trabajo de otra persona sin saberlo).
- **Código propio**: el HTML y el CSS del negocio no pueden usar `position: fixed` ni selectores que salgan del sitio (`~ *`, `+ div`); la marca "Sitio creado con…" se dibuja fuera de `[data-site]`, donde el CSS del negocio no llega.
- **Exportaciones CSV**: las celdas que empiezan con `=`, `+`, `-`, `@` (texto que escriben los visitantes al pedir) se neutralizan con una comilla para que Excel no las ejecute como fórmula.

Para reportar un problema de seguridad, ver [`SECURITY.md`](../SECURITY.md).

## Limitaciones conocidas

- Las pruebas end-to-end cubren el sitio público, la landing y los flujos principales con sesión; el editor del sitio (salvo deshacer y rehacer), el estudio de PDF, la subida de imágenes y Garfield todavía se revisan a mano. Las reglas críticas (permisos, validación, cálculo) están cubiertas por las pruebas de base de datos y unitarias.
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
   | `ASSISTANT_PROVIDER`, `ASSISTANT_MODEL`, `ASSISTANT_BASE_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_PROVIDER_NAME`, `ASSISTANT_REASONING_EFFORT`, `ASSISTANT_ROUTING` | Opcional: otro proveedor de IA, modelo y modo de enrutamiento de Garfield (ver `.env.example`). Al arrancar, `src/instrumentation.ts` avisa en los logs si alguna está mal escrita. |
   | `NEXT_PUBLIC_SITE_URL` | Opcional: dominio propio. Sin ella se usa el dominio de producción de Vercel. |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` | Opcional: aviso semanal por correo (ver abajo). |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Opcional: avisos push de pedidos. |
   | `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Opcional: dominio propio por negocio. Sólo en *Production* (una vista previa no debe conectar dominios al proyecto real). |

   Las variables `NEXT_PUBLIC_*` se fijan al compilar: si las cambias, vuelve a desplegar.
3. *Deploy*. Cada PR recibe una vista previa y cada merge a `main` despliega producción.

**Después del despliegue**
1. Verifica `https://<tu-dominio>/api/health` → `{"status":"ok","database":"ok"}`.
2. Supabase → *Authentication → URL Configuration*: pon el dominio como *Site URL*.
3. GitHub → *Settings → Secrets and variables → Actions → Variables*: crea `PRODUCTION_URL` con el dominio. El workflow [`keepalive.yml`](../.github/workflows/keepalive.yml) consulta `/api/health` cada 3 días para que el plan gratuito de Supabase no pause el proyecto (se pausa tras 7 días sin actividad).
4. Opcional: dominio propio en *Settings → Domains* (y actualiza `NEXT_PUBLIC_SITE_URL`).
5. Opcional, aviso semanal por correo: en [Resend](https://resend.com) verifica tu dominio (registros DNS) y crea una API key; en Vercel define `RESEND_API_KEY` y `CRON_SECRET` como *Secret* y `EMAIL_FROM` (de ese dominio), sólo en *Production*. El cron de `vercel.json` corre los lunes a las 15:00 UTC. En *Admin → Configuración* revisa el estado y envíate una prueba.

> Por defecto, las vistas previas de PRs usan la misma base que producción. Vercel las protege con login por defecto (*Deployment Protection*); para separar datos, crea un segundo proyecto de Supabase y usa sus claves sólo en *Preview*.

Notas de costo en el plan gratuito:
- La generación de PDF corre como función de Node (`maxDuration = 60`); catálogos de cientos de ítems tardan unos segundos.
- El optimizador de imágenes de Vercel tiene una cuota mensual. Si se agota, usa `NEXT_PUBLIC_IMAGE_OPTIMIZATION=false`.
- El catálogo público se sirve desde caché (ISR + tag por negocio). Cada visita no cacheada hace **una sola** llamada a Supabase.

---

## Estructura

```
supabase/
  migrations/                  v1 (esquema, RLS, Storage) · v2 (páginas, navegación, PDF) · v3 (atributos) · v4 (acceso, roles, auditoría) · v5 (biblioteca) · rendimiento · seguridad
  tests/rls.test.mjs           417 pruebas de migraciones, aislamiento, roles, auditoría, medios, límites y retención (PGlite)
scripts/create-admin.mjs       Crea o promueve el administrador (npm run admin:create)
scripts/screenshots.mjs        Capturas del README (docs/images)
tests/                         463 pruebas unitarias (npm run test:unit)
  lib/                         seguridad (SSRF, redirecciones, rutas de Storage) y dominio (slugs, precios, planes, contacto…)
  builder/                     reducer del editor (guardado con cambios concurrentes)
  assistant/                   Garfield: router local, ejecutores sitio/PDF, proveedores, herramientas, plantillas
.github/                       CI (ci.yml), CodeQL y Dependabot
e2e/public/                    58 pruebas end-to-end sin sesión (npm run test:e2e)
e2e/app/                       48 pruebas end-to-end con sesión sobre Supabase local (npm run test:e2e:app)
playwright.config.ts           Proyectos escritorio, móvil y app; levanta el build de producción
scripts/e2e-app.mjs            Levanta Supabase local, reinicia la base, crea el admin de prueba y corre las E2E con sesión
supabase/config.toml           Supabase local para las E2E (sólo base, auth, API y storage)
src/
  proxy.ts                     Sesión de Supabase, protección de rutas y dominios propios (reescribe a /dominio/<negocio>)
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
    dominio/[slug]/            El mismo sitio público servido en el dominio propio del negocio
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
