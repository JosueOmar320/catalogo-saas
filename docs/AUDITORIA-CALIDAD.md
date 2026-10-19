# Auditoría de calidad, seguridad y CI (octubre 2026)

Revisión completa del repositorio (arquitectura, seguridad, correctitud, pruebas, dependencias y experiencia de desarrollo) con correcciones aplicadas. Cada corrección de comportamiento tiene una prueba que falla sin ella.

**Línea base** (antes): typecheck, lint, 95 pruebas unitarias, 126 de base de datos y build en verde; `npm audit`: 8 vulnerabilidades altas; sin CI.
**Después**: 182 pruebas unitarias, 140 de base de datos, build en verde; `npm audit --omit=dev`: 0 vulnerabilidades; CI con 6 jobs + CodeQL + Dependabot.

## Hallazgos y estado

### Alto

| Hallazgo | Consecuencia | Estado |
| --- | --- | --- |
| **SSRF**: `isPrivateAddress` no reconocía IPv4 escondidas en IPv6 (`https://[::ffff:127.0.0.1]/` se normaliza a `::ffff:7f00:1`; también `::7f00:1`, 6to4). | "Agregar desde URL", Garfield o el PDF podían conectar a loopback o a metadatos de la nube (169.254.169.254). | Corregido con `net.BlockList` por familia y extracción de la IPv4 embebida. Pruebas en `tests/lib/security.test.ts`. |
| **Membresías y catálogos por la API REST**: políticas de la v1 seguían permitiendo al dueño insertar/editar/borrar en `business_members` e insertar en `catalogs`. | Saltarse cuotas y planes, agregarse a un administrador (y ver su perfil), cambiar roles sin auditoría. | Políticas eliminadas (migración `20261020000000`); todo pasa por las RPC de administración. Pruebas en `rls.test.mjs`. |
| **Borrado de archivos en uso**: `releaseStorageObjects` trataba un error de consulta como "nadie lo usa". | Un error transitorio al reemplazar un logo o una foto podía borrar archivos que el sitio o el PDF seguían usando. | Corregido (fail-closed). |
| **Historial de Garfield**: el guardado inicial escribía `[]` antes de leer. | El historial nunca persistía; al cambiar de negocio se copiaba el chat anterior. | Corregido (se guarda sólo tras cargar la clave actual). |

### Medio

| Hallazgo | Estado |
| --- | --- |
| Open redirect tras el login (`/login?next=/\evil.com`). | Corregido (`lib/auth/redirect.ts`, resolución contra un origen fijo). Pruebas. |
| Sin límite de intentos en el login ni en el cambio de contraseña; el límite de Garfield era sólo en memoria (inútil en serverless). | Corregido: límite compartido en Postgres (`rate_limit_consume`), 10/cuenta y 30/IP cada 15 min; cupo diario de Garfield (300). Pruebas de BD. |
| Editor: lo editado *mientras* se guardaba quedaba marcado como guardado (y se perdía al salir). | Corregido: `saved` lleva el estado enviado; sólo se limpia lo que no cambió. Pruebas del reducer. |
| Administración: errores de Supabase ignorados (bloqueo de inicio de sesión, sitio inicial); `createUser` dejaba cuentas de Auth huérfanas si fallaba un paso. | Corregido (errores reportados, rollback de la cuenta, validación de ids). |
| Garfield: coincidencia parcial de nombres podía borrar/editar el ítem equivocado; un doble clic aplicaba un plan dos veces. | Corregido (coincidencia parcial sólo si es única; guardia de aplicación en curso). |
| Duplicar ítem: errores ignorados, copia de archivos (contra el diseño de la biblioteca) y miniaturas rotas. | Corregido: las fotos se comparten por referencia; si falla, se deshace la copia. |
| `/demo/pdf` público y caro: parámetros extra saltaban la caché del CDN. | Corregido: redirección 308 a la URL canónica. |
| Sin cabeceras de seguridad (clickjacking en `/admin`). | Corregido en `next.config.ts`. |
| URLs de contacto y redes aceptaban `javascript:`/`data:`. | Corregido (sólo http/https); un campo inválido guardado ya no borra todo el contacto al leerlo. |
| Dependencias: Next.js 16.3.6 (6 avisos, incl. SSRF en el optimizador de imágenes y envenenamiento de caché), pdf.js 5.7 (ejecución de JS con PDFs maliciosos), source-map-js. | Actualizado a Next 16.3.8 (parche) y pdf.js 6.4 (con el ajuste de API). Queda `braces` (sólo ESLint, sin versión corregida). |
| `error.tsx` usaba `reset()` (no vuelve a pedir al servidor en Next 16); sin `global-error`, sin límites por segmento ni `loading`. | Corregido: `retry()`, `digest` visible, límites en panel y administración, `loading.tsx`. |

### Bajo

| Hallazgo | Estado |
| --- | --- |
| Fugas: URL de objeto en `ImageField`, documento de pdf.js sin liberar (y `destroy` dentro de un updater de estado), vista previa del PDF sin cancelar al salir. | Corregido. |
| Promesas sin manejar (verificación de slug, portapapeles, biblioteca). | Corregido. |
| Biblioteca "sólo Storage" filtraba en el cliente después de paginar (totales incorrectos). | Corregido (filtro en el servidor). |
| Menú móvil sin Escape ni `aria-controls`; botones sin nombre accesible en la tabla de catálogos. | Corregido. |
| `withRandomSuffix` podía generar `--` o sufijos de 1 carácter. | Corregido. Prueba. |
| Fuentes del PDF desde `@latest` (cadena de suministro). | Versión fija + sin redirecciones + tope de tamaño. |
| Código muerto (10 exportaciones, 3 Server Actions sin uso) y `norm()` duplicado 6 veces; SVG de plantilla en `public/`. | Eliminado / unificado en `lib/utils/text.ts`. |
| `.env.example` sin 3 variables que el código lee; `engines` en Node 20 (fin de soporte). | Corregido (Node ≥ 22, `.nvmrc`). |

## No cambiado (con motivo)

- **CSP estricta** (`script-src` con nonces): obligaría a renderizar dinámicamente el catálogo público (hoy ISR). Se aplicó una CSP mínima sin nonces.
- **Columnas de ruta que aceptan NULL en sus CHECK** (`storage_path_business_id`): endurecerlas rompería las URLs externas registradas en la biblioteca, que hoy son válidas. El impacto se limita al propio sitio del negocio.
- **Editores con permisos de borrado en Storage**: las Server Actions de los editores (al quitar una foto) necesitan liberar archivos; restringirlo dejaría archivos huérfanos. El borrado físico de filas de la biblioteca sí quedó sólo para dueño/admin.
- **Sobrescritura concurrente de `catalogs.settings`** desde dos pestañas: requiere concurrencia optimista o un merge en SQL; el riesgo práctico es bajo.
- **`limitInputPixels` de sharp (80 MP)**: bajarlo rechazaría fotos legítimas de teléfonos de 50 MP+; el límite diario y de tamaño acota el abuso.
- **Reemplazo de medios en dos pasos** (referencias y fila de la biblioteca): unirlos en una sola transacción requiere cambiar la RPC; queda como recomendación.
- **Pruebas end-to-end** de la interfaz: necesitan una instancia de Supabase de prueba en CI.
- **Formateador (Prettier)**: el estilo ya es consistente; reformatear todo el código generaría un diff enorme sin cambiar nada.

## Recomendaciones siguientes

1. Playwright contra `supabase start` en CI (login, crear producto, publicar, PDF).
2. Unir el reemplazo de medios en una RPC transaccional y concurrencia optimista en `catalogs.settings`.
3. Generar `src/types/database.ts` con `supabase gen types` en CI y comparar.
4. Observabilidad: enviar los `digest` y los `console.error` del servidor a un servicio (Sentry, Vercel Log Drains).
5. Dividir `planAssistantActions` (≈570 líneas) en un mapa de manejadores por acción.
