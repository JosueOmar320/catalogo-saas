# Cómo contribuir

## Preparar el entorno

```bash
nvm use
```

```bash
npm ci
```

```bash
npm run dev
```

`/demo` y `/demo/pdf` funcionan sin Supabase. Para el panel, sigue *Configurar Supabase* en el [README](README.md).

## Antes de abrir un pull request

```bash
npm run check
```

```bash
npm run build
```

`check` corre typecheck, lint y las pruebas unitarias y de base de datos: es lo mismo que exige CI (más el build y las E2E). Ninguna prueba necesita red, Supabase ni Docker.

Si tocaste la landing, el sitio público o el pedido por WhatsApp, corre también las pruebas end-to-end (la primera vez, instala Chromium con `npx playwright install chromium`):

```bash
npm run test:e2e
```

Compilan la app y la prueban en un navegador real, en escritorio y en móvil. Para probar un servidor ya levantado: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`. Si una falla, `npx playwright show-trace test-results/…/trace.zip` muestra paso a paso qué vio el navegador.

Si tocaste el login, el admin, el panel o la publicación, corre también las E2E con sesión. Necesitan Docker; la primera vez descargan las imágenes de Supabase:

```bash
npm run test:e2e:app
```

Levantan un Supabase **local** (nunca los proyectos de la nube), reinician su base, crean un administrador con una contraseña aleatoria de esa ejecución y prueban el recorrido completo. Para apagarlo: `npx supabase@2.121.0 stop`.

Si cambiaste dependencias, verifica también el lockfile con la versión de npm del CI (npm 11 puede quitar dependencias opcionales de otras plataformas que npm 12 exige, y `npm ci` falla en CI):

```bash
npx -y npm@latest ci --ignore-scripts --dry-run
```

## Convenciones

- **Idioma**: la interfaz, los mensajes y los comentarios están en español; los identificadores pueden estar en inglés.
- **Estilo**: comillas simples, punto y coma, 2 espacios (`.editorconfig`). ESLint con las reglas de Next.js y React Compiler; no se silencian advertencias sin explicar por qué.
- **Server Actions**: validan la entrada con Zod (`parseInput`), verifican el rol (`canManageCatalog` / `requirePlatformAdmin`) y devuelven `ActionResult` (`ok` / `fail`). Nunca devuelven mensajes crudos de Postgres: usa `dbErrorMessage`.
- **Base de datos**: cada cambio es una migración nueva en `supabase/migrations/` (nunca se edita una ya aplicada) con su prueba en `supabase/tests/rls.test.mjs`. Las tablas nuevas llevan RLS y las funciones privilegiadas `security definer` con `set search_path = ''`. Actualiza `src/types/database.ts`.
- **Sitio público**: los componentes de `src/site-renderer/` no deben importar módulos con Zod (usa los `*-core.ts`); el catálogo público no debe cargar el esquema en el navegador.
- **Pruebas**: cada bug corregido lleva una prueba de regresión que falle sin el arreglo.

## Commits y ramas

Ramas desde `main` (`feat/…`, `fix/…`). Mensajes descriptivos en presente ("agrega…", "corrige…"). Los PR necesitan los checks de CI en verde.
