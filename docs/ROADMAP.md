# Roadmap

## Pendiente (fuera del MVP, el modelo ya lo soporta)

| Funcionalidad | Cómo encaja en la arquitectura actual |
| --- | --- |
| **Arrastrar y soltar en la preview** | Hoy se reordena en el panel (arrastrar o flechas) y se selecciona una sección haciendo clic en la preview. Arrastrar dentro de la preview es el siguiente paso natural. |
| **Deshacer / rehacer en el builder** | El estado del builder es un reducer: basta con guardar el historial de estados. |
| **Estilos por breakpoint más finos** | Hoy: columnas y visibilidad por dispositivo, tamaños de texto de escritorio y móvil (v4), padding y alineación sólo en celular y columnas apiladas/invertidas (v5). Siguiente: ajustes de tablet. |
| **Video subido** | El hero acepta una URL .mp4. Subir video a Storage requiere otro perfil de media (tamaño, formatos). |
| **Más plantillas de sitio** | v5 trae 10. Agregar una = otra entrada en `lib/site/templates.ts` (tema + páginas + secciones existentes). |
| **Draft → Preview → Publish con snapshot** | Tabla `catalog_publications (catalog_id, snapshot jsonb, published_at)`. Publicar guarda el resultado de `get_public_catalog`; la página pública lee el snapshot. Hoy los cambios guardados son visibles de inmediato (los ítems y categorías tienen su propio interruptor de visibilidad). |
| **Billing (Stripe)** | Tabla `subscriptions` + webhook en un Route Handler que actualiza `businesses.plan_id` (con service role, ya que el usuario no puede cambiarlo; hoy lo cambia el administrador en `/admin/negocios`). `lib/plans` ya centraliza límites y features. |
| **Dominios personalizados** | Tabla `business_domains (domain, business_id, verified_at)` + en `proxy.ts`, reescribir `host → /catalogo/[slug]`. Vercel Domains API para el alta. |
| **Equipos (plan Business)** | `business_members` y `has_business_role` ya existen, y el administrador asigna usuarios a negocios con rol (v4). Falta que el dueño invite a su propio equipo (tabla `invitations` + límite por plan). |
| **Varios catálogos por negocio** | El administrador ya crea, activa y elige el catálogo principal (v4). Falta que el editor trabaje sobre un catálogo elegido (hoy siempre el principal) y la ruta `/catalogo/[negocio]/[catalogo]`. |
| **Analytics** | Tabla `catalog_events` (vistas, clics en WhatsApp por ítem) escrita desde un Route Handler con rate limit. Sólo para planes con `features.analytics`. |
| **Más acciones de contacto** | Agregar la clave en `contactActionsSchema` y su definición en `lib/contact/actions.ts` (link externo, formulario, reservación, compra). |
| **Más secciones, estilos, fuentes, plantillas PDF** | Ver "Registros extensibles" en ARQUITECTURA.md: cada uno se agrega en un registro y TypeScript obliga a completar web, editor y PDF. |
| **Papelera** | Ítems y categorías usan `deleted_at`: sólo falta la vista para restaurar y un job que purgue imágenes. |
| **Limpieza de Storage** | La biblioteca ya sabe qué se usa (`media_references`). Falta un job programado que borre archivos sin registro ni uso (subidas abandonadas). |
| **Variantes con precio propio** | Los atributos personalizados ya existen (v3). Variantes (talla M = $X, stock por variante) necesitan una tabla `catalog_item_variants` y selección en la ficha. |
| **Sitemap de catálogos** | `sitemap.ts` puede listar los catálogos publicados con una RPC pública. |
| **i18n** | Los textos están en español en los componentes. Extraerlos a diccionarios cuando se venda fuera de LATAM. |
| **PDF en background** | Para catálogos de miles de ítems: generar en una cola, guardar en Storage y notificar. |

## Siguientes pasos del constructor de catálogos (v3)

| Funcionalidad | Cómo encaja |
| --- | --- |
| **QR por producto o del catálogo en el PDF** | Nuevo campo en `presentation.fields` + generación de QR en el servidor (SVG → `Svg` de react-pdf). |
| **Marca de agua y vigencia de precios** | Campos en `settings.cover` / `decorations`; se dibujan en `PdfDecorations` (fijo en cada página). |
| **Filtros en la URL** | Guardar búsqueda, filtros, orden y página en `?q=&cat=&orden=` para compartir resultados. Hoy viven en el estado del componente. |
| **Rango de precio con deslizador** | Hoy son dos campos numéricos; un slider con mínimo y máximo reales del catálogo. |
| **Paginación del catálogo en el servidor** | Para miles de ítems: RPC con `limit/offset` y filtros en SQL. Hoy se filtra en el cliente sobre el catálogo cacheado. |
| **Más layouts de producto** | Ya hay 12 (v4 agregó Cuadrícula compacta, Minimalista y Comparación). Para otro: id en `PRODUCT_LAYOUTS` + `LAYOUT_OPTIONS`; TypeScript exige su render web, su render PDF y su miniatura. |
| **Exportar lista de precios (CSV/Excel)** | Reutiliza `resolveCollection` + `formatPrice`. |

## Siguientes pasos de acceso, administración y Garfield (v4)

| Funcionalidad | Cómo encaja |
| --- | --- |
| **Límite de intentos de inicio de sesión** | `signIn` no tiene rate limit propio (Supabase Auth sí limita por IP). Agregar un contador por usuario/IP (Upstash o tabla con TTL) y bloqueo temporal. |
| **Recuperar contraseña sin administrador** | Hoy la restablece un administrador. Si el usuario tiene email de contacto verificado, un flujo de enlace por email (requiere SMTP propio). |
| **Funciones por plan (feature flags)** | `plans.features` ya existe. Falta la UI en `/admin/configuracion` para editar planes y que el editor oculte lo no incluido. |
| **Retención y exportación de auditoría** | Job que archive `audit_log` viejo y exportación CSV desde `/admin/auditoria`. |
| **Garfield: cambios de negocio y PDF** | Hoy edita sitio, tema, navegación, contenido, medios, productos y categorías. Siguiente: datos del negocio (contacto, horarios) y bloques del PDF, con las mismas Server Actions. |

## Siguientes pasos de medios, Garfield y PDF (v5)

| Funcionalidad | Cómo encaja |
| --- | --- |
| **Etiquetas y carpetas propias en la biblioteca** | `media_assets.tags` ya existe; falta la interfaz. Carpetas propias = tabla `media_folders`. |
| **Transformaciones en el CDN** | Con Supabase Pro (o R2 + Images) se pueden pedir tamaños por URL; `mediaUrl(ref, variante)` es el único punto a cambiar. |
| **Garfield: reescritura de textos con contexto del negocio** | Las plantillas ya se aplican sin IA; con IA el modelo además personaliza los textos. Siguiente: herramienta para leer las páginas completas (no sólo el resumen) antes de reescribir. |
| **Bloques anidados de un nivel más** | Columnas → bloques cubre la mayoría de composiciones. Si hiciera falta, "tarjetas dentro de una columna" sería otro tipo de bloque, no un árbol libre. |
| **Editar sobre la vista previa del PDF** | Hoy cada miniatura abre su bloque. Siguiente: arrastrar miniaturas para reordenar bloques. |

## Mejoras de producto propuestas (no implementadas; conviene validarlas antes)

1. **Importar desde Excel/CSV o fotos**: el mayor freno para un negocio pequeño es cargar 100 productos uno por uno.
2. **Código QR del catálogo** (para mostrador, mesas o volantes) en la página de Publicación. Es barato de hacer y de alto valor para restaurantes.
3. **Carrito de consulta por WhatsApp**: el cliente arma una lista y envía un solo mensaje con todos los productos. Encaja como nueva acción de contacto.
4. **Horarios estructurados** ("abierto ahora") en lugar de texto libre.
5. **Plantillas por rubro** al crear el negocio desde `/admin` (restaurante, tienda, servicios profesionales) que creen categorías y ejemplos iniciales.
6. **Recorte de imagen** al subir (encuadre cuadrado para tarjetas).

## Recomendaciones para la siguiente fase

1. **Pruebas end-to-end** (Playwright) contra `supabase start`: el administrador crea usuario y negocio → el usuario inicia sesión → crea ítem con imagen → publica → ve el sitio público → PDF.
2. **Monitoreo**: Sentry (o Vercel Observability) para errores de Server Actions y del endpoint de PDF.
3. **Rate limiting** en el inicio de sesión y en el endpoint de PDF (Upstash Redis o la protección de bots de Vercel).
4. **SMTP propio y dominio de envío** si se habilita recuperación de contraseña por email.
5. **Regenerar tipos** con `npm run db:types` en CI para detectar desalineaciones con la migración.
6. **Backups**: el plan gratuito de Supabase pausa proyectos inactivos y no tiene PITR. Pasar a Pro al tener clientes de pago.
7. **Migrar a Cache Components** (`'use cache'`) cuando se estabilice el patrón con sesiones; hoy se usa `unstable_cache` a propósito.
