# Seguridad

## Reportar una vulnerabilidad

No abras un issue público. Usa **GitHub → Security → Report a vulnerability** (aviso privado) en este repositorio, con:

- qué encontraste y dónde (ruta, Server Action, tabla o función SQL),
- pasos para reproducirlo,
- el impacto que esperas (por ejemplo, leer datos de otro negocio).

Respondemos en cuanto sea posible. Por favor no pruebes contra instancias de producción de terceros.

## Alcance y modelo

- Cada negocio es un tenant aislado por **RLS** en Postgres; las Server Actions validan además permisos y entrada.
- Las cuentas las crea un administrador de la plataforma; no hay registro público.
- La service role de Supabase sólo se usa en el servidor (módulos `server-only`).

Detalle técnico: sección *Seguridad* de [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
