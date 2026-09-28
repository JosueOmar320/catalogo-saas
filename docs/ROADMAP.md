# Roadmap

## Pendiente (fuera del MVP, el modelo ya lo soporta)

| Funcionalidad | Cómo encaja en la arquitectura actual |
| --- | --- |
| **Arrastrar y soltar en la preview** | Hoy se reordena en el panel (arrastrar o flechas) y se selecciona una sección haciendo clic en la preview. Arrastrar dentro de la preview es el siguiente paso natural. |
| **Deshacer / rehacer en el builder** | El estado del builder es un reducer: basta con guardar el historial de estados. |
| **Estilos por breakpoint más finos** | Hoy: columnas por dispositivo y ocultar por dispositivo. Siguiente: tamaños de texto y padding por dispositivo en `SectionStyle`. |
| **Video subido** | El hero acepta una URL .mp4. Subir video a Storage requiere otro perfil de media (tamaño, formatos). |
| **Plantillas de sitio completas** | Además de los presets de diseño: conjuntos de páginas por rubro (restaurante, tienda, servicios). `buildStarterSite` ya existe. |
| **Draft → Preview → Publish con snapshot** | Tabla `catalog_publications (catalog_id, snapshot jsonb, published_at)`. Publicar guarda el resultado de `get_public_catalog`; la página pública lee el snapshot. Hoy los cambios guardados son visibles de inmediato (los ítems y categorías tienen su propio interruptor de visibilidad). |
| **Billing (Stripe)** | Tabla `subscriptions` + webhook en un Route Handler que actualiza `businesses.plan_id` (con service role, ya que el usuario no puede cambiarlo). `lib/plans` ya centraliza límites y features. |
| **Dominios personalizados** | Tabla `business_domains (domain, business_id, verified_at)` + en `proxy.ts`, reescribir `host → /catalogo/[slug]`. Vercel Domains API para el alta. |
| **Equipos (plan Business)** | `business_members` y `has_business_role` ya existen. Falta la UI de invitaciones y una tabla `invitations`. |
| **Varios catálogos por negocio** | `catalogs.is_default` + `slug` por negocio. Ruta `/catalogo/[negocio]/[catalogo]` y selector en el panel. |
| **Analytics** | Tabla `catalog_events` (vistas, clics en WhatsApp por ítem) escrita desde un Route Handler con rate limit. Sólo para planes con `features.analytics`. |
| **Más acciones de contacto** | Agregar la clave en `contactActionsSchema` y su definición en `lib/contact/actions.ts` (link externo, formulario, reservación, compra). |
| **Más secciones, estilos, fuentes, plantillas PDF** | Ver "Registros extensibles" en ARQUITECTURA.md: cada uno se agrega en un registro y TypeScript obliga a completar web, editor y PDF. |
| **Papelera** | Ítems y categorías usan `deleted_at`: sólo falta la vista para restaurar y un job que purgue imágenes. |
| **Limpieza de Storage** | Job programado (Supabase Cron o Vercel Cron) que borre archivos sin referencia (subidas abandonadas, ítems purgados). |
| **Variantes / campos personalizados** | `catalog_items.attributes jsonb` (p. ej. duración de un servicio, tallas). |
| **Sitemap de catálogos** | `sitemap.ts` puede listar los catálogos publicados con una RPC pública. |
| **i18n** | Los textos están en español en los componentes. Extraerlos a diccionarios cuando se venda fuera de LATAM. |
| **PDF en background** | Para catálogos de miles de ítems: generar en una cola, guardar en Storage y notificar. |

## Mejoras de producto propuestas (no implementadas; conviene validarlas antes)

1. **Importar desde Excel/CSV o fotos**: el mayor freno para un negocio pequeño es cargar 100 productos uno por uno.
2. **Código QR del catálogo** (para mostrador, mesas o volantes) en la página de Publicación. Es barato de hacer y de alto valor para restaurantes.
3. **Carrito de consulta por WhatsApp**: el cliente arma una lista y envía un solo mensaje con todos los productos. Encaja como nueva acción de contacto.
4. **Horarios estructurados** ("abierto ahora") en lugar de texto libre.
5. **Plantillas por rubro** en el onboarding (restaurante, tienda, servicios profesionales) que creen categorías y ejemplos iniciales.
6. **Recorte de imagen** al subir (encuadre cuadrado para tarjetas).

## Recomendaciones para la siguiente fase

1. **Pruebas end-to-end** (Playwright) contra `supabase start`: registro → onboarding → crear ítem con imagen → publicar → ver público → PDF.
2. **Monitoreo**: Sentry (o Vercel Observability) para errores de Server Actions y del endpoint de PDF.
3. **Rate limiting** en `signUp` y en el endpoint de PDF (Upstash Redis o la protección de bots de Vercel).
4. **SMTP propio y dominio de envío** antes de abrir registros públicos.
5. **Regenerar tipos** con `npm run db:types` en CI para detectar desalineaciones con la migración.
6. **Backups**: el plan gratuito de Supabase pausa proyectos inactivos y no tiene PITR. Pasar a Pro al tener clientes de pago.
7. **Migrar a Cache Components** (`'use cache'`) cuando se estabilice el patrón con sesiones; hoy se usa `unstable_cache` a propósito.
