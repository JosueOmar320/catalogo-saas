# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Dueño o dueña de un negocio pequeño** (cafetería, panadería, ferretería, estudio de servicios, cursos): sin equipo técnico ni diseñador, arma y mantiene su sitio y su catálogo por su cuenta, con frecuencia desde el celular y entre atender clientes. Su trabajo con Vitrina es tener presencia en línea presentable, publicar lo que vende (fotos, precios, variantes, existencias) y recibir pedidos por el canal que ya usa: WhatsApp. (Confirmado.)

Otras personas que tocan el producto, derivadas del código:
- **Administrador de la plataforma** (`/admin`): crea cuentas y negocios, asigna planes y permisos, modera; no hay registro público.
- **Miembros del negocio** con rol `owner`, `admin` o `editor`: el editor sólo mantiene catálogo, pedidos y reseñas; sitio, configuración, medios y PDF son de owner/admin.
- **Visitante del sitio público**: cliente final que busca, filtra, arma su pedido, deja una reseña, lee el PDF o escanea un QR en el local o la mesa.

## Product Purpose

Vitrina permite que un negocio pequeño tenga, sin código y en un solo lugar, su sitio web con marca propia, su catálogo de productos y servicios con búsqueda y filtros, y un catálogo en PDF listo para imprimir o enviar; y que reciba pedidos por WhatsApp con un mensaje ya escrito. El éxito es que el negocio publique y mantenga su catálogo solo, y que sus clientes pidan sin fricción. Un asistente (Garfield) convierte pedidos en lenguaje natural en cambios revisables del sitio, el catálogo y el PDF; lo simple se resuelve sin IA.

## Positioning

**Un solo modelo, dos destinos: el mismo sitio sale como catálogo PDF con el mismo diseño** (tema, tokens, secciones, presentaciones de producto) sin rehacerlo. Es la promesa confirmada que un constructor de sitios, una tienda en línea o un catálogo de enlaces no puede copiar honestamente. Lo sostiene la arquitectura: un `SiteViewModel` único renderizado en React para la web y en react-pdf para el PDF (`docs/ARQUITECTURA.md`).

Rasgos que acompañan esa promesa (reales, no la promesa principal): pedido completo por WhatsApp sin pasarela (variantes, extras, mayoreo, zonas de entrega, cupones, propina, folio, bandeja de pedidos); Garfield; acceso creado por un administrador.

## Operating Context

- El negocio opera en WhatsApp: el pedido es un mensaje `wa.me` prearmado; el negocio responde y cobra como ya lo hace (local, transferencia, efectivo). El cierre nunca ocurre dentro de Vitrina.
- Un solo enlace público `/catalogo/<slug>` sirve para WhatsApp, redes, bio y el QR del mostrador; `?mesa=N` identifica una mesa; el PDF se descarga del panel y se imprime o envía.
- El panel (`/dashboard`) se usa para cargar y revisar productos (fotos, precios, "Revisa tu catálogo"), importar y exportar CSV, moderar reseñas, atender la bandeja de pedidos, ver visitas y pedidos de 30 días, y editar sitio y PDF en vistas previas en vivo (escritorio, tablet, móvil).
- Aviso semanal por correo con pendientes del catálogo (lunes); baja con un clic.
- Interfaz del panel en español o inglés; cada sitio público en el idioma del negocio. Idioma por defecto: español. Moneda y formato de precio configurables por negocio (la configuración nace en USD y `es-419`; la demo usa pesos mexicanos).
- Despliegue en Vercel con Supabase (Postgres, Auth, Storage); producción en `https://catalogo-saas-nu.vercel.app`.

## Capabilities and Constraints

Confirmado en código (ver `README.md` y `docs/ARQUITECTURA.md`):
- Constructor visual: páginas, 24 tipos de sección (incl. columnas, HTML propio y widgets en iframe aislado cuando el administrador lo habilita), navegación, 10 temas, fondos, tipografía por nivel, deshacer/rehacer, plantillas de sección guardadas, animaciones al hacer scroll que respetan `prefers-reduced-motion`.
- Catálogo: categorías, atributos personalizados filtrables, variantes y extras con precio propio, mayoreo por escalones, existencias, dieta/alérgenos, temporadas, ofertas con fecha de fin, precio programado, costo privado con margen, «Combínalo con», favoritos, lista compartida por enlace, búsquedas sin resultados registradas, reseñas moderadas, datos estructurados y sitemap.
- Pedido por WhatsApp: recoger, entrega por zona o mesa, horarios para pedir, sucursales, cupones y promociones automáticas, propina, nota por producto, folio; bandeja de pedidos con estados y existencias que se descuentan al confirmar.
- PDF: 11 plantillas por bloques (portada, índice, catálogo, colección, comparación, galería, página del sitio, contacto) con vista previa por página.
- Planes `Gratis` / `Pro` / `Business` con límites de ítems, imágenes, catálogos y miembros, y funciones (PDF, quitar marca, código propio, analytics, dominio propio) que el administrador asigna; límites aplicados también en la base de datos.
- Tipo de sitio por negocio: con catálogo o sitio web sin productos.
- Demo pública sin cuenta (`/demo`, `/demo/pdf`) y negocio de prueba temporal de 24 horas.

Restricciones durables:
- **Sin pagos en línea** (confirmado): nunca una pasarela; el cierre es por WhatsApp o en el local.
- No hay registro público: las cuentas y los negocios los crea un administrador de la plataforma.
- Multi-tenant con aislamiento en la base (RLS, claves compuestas, funciones `SECURITY DEFINER`); panel y todos los sitios públicos comparten un mismo origen, por eso el código propio del negocio nunca se ejecuta como script en la página (sanitizado o en iframe `sandbox`).
- El sitio público es estático (ISR, una consulta por visita no cacheada) y su bundle no carga Zod (`tests/lib/bundle-boundaries.test.ts`).
- Terminología fija del producto: negocio, catálogo, ítem (producto o servicio), sección, página, tema, pedido, bandeja, folio, mesa, zona, sucursal, cupón, promoción, mayoreo, temporada, Garfield, "Revisa tu catálogo", "kit para compartir".

Abierto (no inventar):
- Mercado y país objetivo: no confirmados. El producto habla español primero y la demo usa pesos mexicanos y teléfonos `+52`, pero el usuario no fijó México/LATAM como mercado.
- Precio de los planes y modelo de cobro: no existen; los planes hoy son límites que asigna el administrador.
- Dominio propio y analytics figuran como funciones de plan, pero no están implementados.

## Brand Commitments

- **Nombre: Vitrina** (configurable por `NEXT_PUBLIC_APP_NAME`, pero el nombre es definitivo). **Logo: el ícono actual** `src/app/icon.svg` (confirmados ambos).
- Mascota y nombre del asistente: **Garfield** (avatar en `src/features/assistant/components/GarfieldAvatar.tsx`).
- Voz existente del producto: español directo, de tú, frases cortas y concretas ("Revisa tu catálogo", "¿Para cuándo?", "Combínalo con"), sin jerga técnica hacia el negocio; la landing además habla a quien evalúa la ingeniería ("Bajo el capó").
- Marca de la plataforma en los sitios públicos ("Sitio creado con Vitrina") salvo en planes con `remove_branding`.

## Evidence on Hand

- Demo completa con datos realistas: sitio de ejemplo (café de especialidad con panadería y cursos) en `src/lib/site/sample-site.ts`, `/demo` y `/demo/pdf`.
- Imágenes de la landing en `public/social/` (panel con Garfield, sitio en celular, PDF); 10 plantillas de sitio y 11 de PDF con miniaturas.
- Cifras verificables para hablar de calidad: 395 pruebas unitarias, 309 de base de datos sobre Postgres real, 97 end-to-end; CI con CodeQL, auditoría de dependencias y búsqueda de secretos. Código público en GitHub.
- Documentación técnica extensa: `README.md`, `docs/ARQUITECTURA.md`, `docs/AUDITORIA-*.md`, `docs/GARFIELD-AI.md`.
- **No existen** clientes, testimonios, logos, casos de éxito ni cifras de uso reales (confirmado). Ningún trabajo futuro debe fabricarlos ni insinuarlos.

## Product Principles

1. **Una sola verdad, todos los destinos.** Lo que el negocio configura una vez debe verse igual en la web, el PDF, el mensaje de WhatsApp y el kit para compartir; una regla que vive en dos lugares es un bug.
2. **Funciona desde el celular y entre clientes.** Cada flujo del panel y del sitio público debe completarse en una pantalla pequeña, con pocos toques y sin instrucciones.
3. **Vender como ya vende el negocio.** WhatsApp, efectivo y el local son el centro; Vitrina prepara el pedido y la conversación, no la reemplaza.
4. **Honestidad antes que impresión.** Sin registro público, sin pagos, sin clientes inventados: lo que se muestra existe y se puede probar (demo, código, pruebas).
5. **La base de datos es la última línea.** Permisos, límites e aislamiento se aplican en Postgres además de en la interfaz; ocultar un botón nunca es autorización.

## Accessibility & Inclusion

- Objetivo vigente: WCAG 2.1 AA automatizado (axe) en landing, login, sitio de ejemplo (escritorio y móvil) y panel; `prefers-reduced-motion` respetado en animaciones y videos; modo claro y oscuro; `<html lang>` del idioma del negocio en los sitios públicos.
- Sitios públicos bilingües (es/en) por negocio; panel en español e inglés.
- Sin requisito legal específico establecido por el usuario.
