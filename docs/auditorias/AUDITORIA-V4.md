# Auditoría y propuesta v4: acceso administrado, Garfield con herramientas y más personalización

## Parte 1 · Cómo funciona hoy

### 1. Autenticación
- **Supabase Auth** con email + contraseña (`features/auth/actions.ts` → `signInWithPassword`, `signUp`, recuperación por email).
- La sesión vive en cookies (`@supabase/ssr`); `proxy.ts` la refresca y protege `/dashboard`, `/onboarding`, `/preview`, `/api/*`.
- No se usa la *service role key*: todo corre con la sesión del usuario y RLS.

### 2. Creación de usuarios
- **Registro público** en `/signup` (cualquiera puede crear una cuenta). Un trigger `handle_new_user` crea `profiles (id, full_name, avatar_url)`.
- No existen roles de plataforma: no hay administrador.

### 3. Creación de negocios
- Tras registrarse, `/onboarding` llama a la RPC `create_business` (SECURITY DEFINER): crea negocio + membresía `owner` + catálogo por defecto, con un tope anti-abuso de 5 negocios por usuario. Luego `save_site` crea el sitio inicial.

### 4. Control de acceso
- **Por negocio**: `business_members (business_id, user_id, role owner|admin|editor)`.
- Funciones `is_business_member()` y `has_business_role()` usadas por **todas** las políticas RLS (negocios, catálogos, páginas, categorías, ítems, imágenes y Storage por carpeta `{business_id}/…`).
- Privilegios por columna en `businesses` (el usuario no puede cambiar `plan_id`, `created_by`, `deleted_at`).
- `getBusinessContext()` resuelve en el servidor qué negocio opera el usuario (la cookie es sólo preferencia).
- Planes (`plans.limits/features`) con límites aplicados por triggers (ítems, imágenes).

### 5. Garfield AI
- Panel en el builder → `POST /api/assistant` (sesión + rol + límite) → proveedor (Gemini/Claude/OpenAI‑compatible/modo básico) → **una respuesta** `{ message, actions, suggestions }`.
- El cliente valida y ejecuta las acciones con el **reducer del builder** sobre el borrador (vista previa, confirmación, deshacer). Nada se escribe en la base hasta "Guardar".

### 6. Acciones actuales de Garfield
`create_page, update_page, duplicate_page, delete_page, set_home_page, create_section, update_section, move_section, duplicate_section, delete_section, update_product_display, update_theme, update_background, add_nav_item, update_nav_item, remove_nav_item, reorder_navigation, focus`.

**Limitaciones detectadas:**
- **Una sola vuelta**: el modelo no puede *consultar* nada (productos, imágenes) antes de decidir.
- **Sin media**: sólo puede reutilizar rutas de imagen que ya usa el sitio; por eso responde "súbela desde el editor".
- **Sin productos ni categorías**: no puede crearlos ni editarlos.
- El contexto no incluye productos ni imágenes disponibles.

### 7. Media / Storage
- Bucket público `catalog-media`, rutas `{business_id}/{kind}/{uuid}.jpg|png`, políticas por carpeta.
- El navegador redimensiona y sube directo a Storage (`features/media/client.ts`); las rutas se guardan dentro del JSON de secciones/tema o en `catalog_item_images`.
- **No hay biblioteca de medios**: no existe una tabla que liste las imágenes del negocio (no se pueden buscar ni reutilizar).

### 8. Page Builder
- `useReducer` sobre un borrador (tema, navegación, páginas con secciones JSONB validadas por Zod) + preview en vivo con el mismo renderer del sitio público. Guardado atómico con `saveSite` → RPC `save_site`.
- 13 tipos de sección; estilo por sección: fondo, color de texto, padding, ancho, visibilidad, ancla.

### 9. Tablas
`plans, profiles, businesses, business_members, catalogs, categories, catalog_items, catalog_item_images, catalog_pages` + `storage.objects`. Columnas JSONB: `catalogs.theme/settings/seo/navigation/pdf/attribute_defs`, `catalog_pages.sections/style/seo`, `catalog_items.attributes`.

### 10. Qué hay que cambiar
| Área | Cambio |
| --- | --- |
| Acceso | Rol de plataforma (admin/user) y estado de usuario protegidos en la base; usuarios aprovisionados sólo por el admin; login con **usuario**; sin registro público; negocios creados/asignados sólo por el admin; negocios y catálogos activables. |
| Admin | Panel `/admin`: dashboard, usuarios, negocios, catálogos, auditoría. |
| Auditoría | Tabla `audit_log` + triggers en entidades clave + registro explícito de acciones de administración. |
| Media | Tabla `media_assets` (biblioteca por negocio), registro al subir, importación controlada desde URL y bancos de imágenes libres. |
| Garfield | **Herramientas de servidor** con bucle (buscar productos, buscar/importar imágenes) + **acciones de catálogo** (productos y categorías, con confirmación) + acciones de media sobre secciones + adjuntar imágenes en el chat. |
| Builder | Más colores, jerarquía tipográfica por rol y responsive, estilo de sección ampliado (altura, alineación, bordes, sombra, superposición, divisores), fondos con video y fijos, nuevos tipos de sección, más layouts y campos de producto; editor de estilo por categorías. |

## Parte 2 · Propuesta

### Usuarios con nombre de usuario (sin email obligatorio)

Supabase Auth identifica cuentas por email o teléfono, así que:

- El **usuario** (`profiles.username`, único, sin distinguir mayúsculas) es la identidad de acceso.
- El admin crea cada cuenta con la *Admin API* de Supabase (servidor, *service role*). Si no hay email, se usa un identificador interno **no entregable** `usuario@<AUTH_USERNAME_DOMAIN>` (por defecto `usuarios.invalid`, dominio reservado por RFC 2606) que el usuario nunca ve. Es el patrón estándar para usuarios sin email en Supabase.
- El **email real** es opcional y vive en `profiles.email` (contacto, futuras notificaciones).
- El login recibe *usuario + contraseña*: el servidor resuelve el usuario con la *service role* (nunca se expone una API pública que revele emails) y luego inicia sesión con la sesión normal (cookies, RLS). Los usuarios existentes conservan su email de acceso y reciben un nombre de usuario derivado de su email.
- Recuperar contraseña: la restablece el admin; cada usuario puede cambiarla desde "Mi cuenta".

### Roles y seguridad (en la base, no sólo en el frontend)
- `profiles.platform_role` (`admin` | `user`) y `profiles.status` (`active` | `disabled`). **El usuario no puede modificarlos**: se revoca `UPDATE` sobre esas columnas y sólo cambian mediante RPCs de administración que verifican `is_platform_admin()`.
- `is_business_member()` / `has_business_role()` pasan a exigir **usuario activo y negocio activo**, y devuelven verdadero para administradores. Como **todas** las políticas RLS y de Storage usan esas funciones, el cambio aplica en todo el sistema de una vez.
- Cuentas que se registren por fuera del panel (p. ej. si alguien olvida desactivar el registro en Supabase) nacen **desactivadas**: sólo las cuentas aprovisionadas por el admin (marca en `app_metadata`, que sólo la *service role* puede escribir) quedan activas.
- Primer administrador: `npm run admin:create` (script con la *service role*) o `select public.bootstrap_platform_admin('usuario')` desde el SQL Editor (función no ejecutable por usuarios).

### Negocios y catálogos
- `create_business` deja de estar disponible para usuarios. `admin_create_business` crea negocio + catálogo (+ membresía del propietario asignado) + sitio inicial.
- `businesses.status` (`active` | `suspended`) y `catalogs.is_active`: un negocio suspendido desaparece para sus usuarios y del sitio público; un catálogo inactivo no se publica. Ambas columnas sólo las cambia el admin.
- Asignación usuario ↔ negocio con rol (`owner`, `admin`, `editor`) desde el panel.
- Preparado para planes/límites: `plans` ya existe; se agrega `profiles.max_businesses` (nulo = sin límite) y `businesses.plan_id` es editable por el admin.

### Auditoría
`audit_log (actor_id, action, entity_type, entity_id, business_id, metadata, created_at)`, sólo legible por admins. Triggers en negocios, membresías, catálogos, páginas, categorías, ítems y perfiles + eventos explícitos del panel (crear usuario, cambiar contraseña, desactivar…).

### Garfield con herramientas reales
```
Usuario → Garfield (bucle de hasta 5 pasos en el servidor)
   ├─ Herramientas de CONSULTA (se ejecutan en el servidor, con RLS):
   │    search_products · list_categories · search_media · search_stock_images
   ├─ Herramienta de MEDIA (efecto aditivo y seguro):
   │    import_image  → descarga controlada (https, IP pública, tipo y tamaño) → Storage del negocio → media_assets
   └─ Respuesta final: acciones propuestas
         ├─ Acciones del EDITOR (borrador, vista previa, deshacer): páginas, secciones, tema, fondos, imágenes, galerías, menú
         └─ Acciones de CATÁLOGO (productos y categorías): se ejecutan en el servidor al aplicar, con validación Zod + RLS;
            borrar pide confirmación; los ids nuevos se pasan a las acciones del editor ($alias)
```
- Las imágenes siempre salen de la biblioteca del negocio (existentes, subidas en el chat o importadas): nunca URLs inventadas. El servidor verifica que cada ruta usada exista en `media_assets` del negocio.
- El usuario puede **adjuntar imágenes** en el chat ("pon esta imagen como fondo").
- Banco de imágenes libre: **Openverse** (licencias CC0/dominio público, sin clave y sin atribución obligatoria).

### Builder
- Colores: + `success`, `warning`, `error` (usados por badges, disponibilidad y avisos).
- Tipografía: jerarquía **H1, H2, H3, cuerpo, pequeño (caption), etiqueta, botón** con tamaño escritorio/móvil, peso, interlineado, espaciado y mayúsculas por rol (con valores automáticos derivados de la escala actual).
- Estilo de sección en categorías **Fondo · Diseño · Espaciado · Apariencia · Avanzado**: altura mínima, alineación vertical y horizontal, ancho (angosto…completo), superposición con la sección anterior, borde, radio, sombra, divisores decorativos arriba/abajo.
- Fondos: + **video**, posición y tamaño de imagen, imagen **fija** (parallax), opacidad de overlay.
- Nuevas secciones: **Imagen, Video, Preguntas frecuentes, Precios, Equipo, Estadísticas, Logos**.
- Productos: + layouts **Grid compacto, Minimal, Comparación**; campos **disponibilidad, precio anterior, % de descuento**.

### Migración sin pérdida
Una sola migración (`20260930000000_admin_access.sql`) **agrega** columnas y tablas; no borra nada:
- Perfiles existentes → `username` derivado del email, `email` copiado, rol `user`, estado `active`.
- Membresías, negocios y catálogos se conservan; todos quedan `active`.
- Imágenes existentes en Storage → registradas en `media_assets`.
- Temas, secciones y configuración de PDF anteriores se leen con los valores por defecto nuevos (esquemas con defaults).
