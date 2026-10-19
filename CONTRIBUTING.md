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

`check` corre typecheck, lint y todas las pruebas: es lo mismo que exige CI (más el build). Ninguna prueba necesita red, Supabase ni Docker.

## Convenciones

- **Idioma**: la interfaz, los mensajes y los comentarios están en español; los identificadores pueden estar en inglés.
- **Estilo**: comillas simples, punto y coma, 2 espacios (`.editorconfig`). ESLint con las reglas de Next.js y React Compiler; no se silencian advertencias sin explicar por qué.
- **Server Actions**: validan la entrada con Zod (`parseInput`), verifican el rol (`canManageCatalog` / `requirePlatformAdmin`) y devuelven `ActionResult` (`ok` / `fail`). Nunca devuelven mensajes crudos de Postgres: usa `dbErrorMessage`.
- **Base de datos**: cada cambio es una migración nueva en `supabase/migrations/` (nunca se edita una ya aplicada) con su prueba en `supabase/tests/rls.test.mjs`. Las tablas nuevas llevan RLS y las funciones privilegiadas `security definer` con `set search_path = ''`. Actualiza `src/types/database.ts`.
- **Sitio público**: los componentes de `src/site-renderer/` no deben importar módulos con Zod (usa los `*-core.ts`); el catálogo público no debe cargar el esquema en el navegador.
- **Pruebas**: cada bug corregido lleva una prueba de regresión que falle sin el arreglo.

## Commits y ramas

Ramas desde `main` (`feat/…`, `fix/…`). Mensajes descriptivos en presente ("agrega…", "corrige…"). Los PR necesitan los checks de CI en verde.
