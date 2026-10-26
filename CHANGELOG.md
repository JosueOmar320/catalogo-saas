# Cambios

Historial por etapas. Cada línea enlaza al pull request donde está el detalle, las pruebas y las migraciones.

## Octubre 2026 · Plataforma

- Cuenta demo pública: «Probar el panel» abre, sin registro, un negocio de prueba propio con datos de ejemplo que no se publica y se borra a las 24 horas.
- README en inglés y español con capturas, licencia y repositorio ordenado ([#62](https://github.com/JosueOmar320/catalogo-saas/pull/62)).

- Dominio propio por negocio: DNS guiado, alta por la API de Vercel y el sitio servido en `mitienda.com` ([#61](https://github.com/JosueOmar320/catalogo-saas/pull/61)).
- Estudio de PDF más claro: un bloque a la vez, agregar por grupos, estado de guardado y vista para el celular ([#60](https://github.com/JosueOmar320/catalogo-saas/pull/60)).
- Funciones por negocio (el administrador apaga Garfield, PDF, pedidos, estadísticas o importar) y administración más clara ([#59](https://github.com/JosueOmar320/catalogo-saas/pull/59)).
- Menú lateral y más estilos de navegación; catálogo con columna de filtros, panel, pestañas y menú de saltos ([#58](https://github.com/JosueOmar320/catalogo-saas/pull/58)).
- Widget en línea entre el menú y el pie, sección Producto y nuevas presentaciones de productos ([#57](https://github.com/JosueOmar320/catalogo-saas/pull/57)).
- Páginas HTML completas como widget y sección Tabla ([#56](https://github.com/JosueOmar320/catalogo-saas/pull/56)).
- Estadísticas de ventas: recorrido de las visitas, de dónde llegan y periodo anterior ([#55](https://github.com/JosueOmar320/catalogo-saas/pull/55)).
- Garfield arma páginas más ricas y usa el código propio ([#54](https://github.com/JosueOmar320/catalogo-saas/pull/54)).
- Avisos de pedidos al instante: notificaciones push y panel instalable ([#53](https://github.com/JosueOmar320/catalogo-saas/pull/53)).
- Garfield no se cuelga cuando el modelo principal tarda ([#52](https://github.com/JosueOmar320/catalogo-saas/pull/52)).
- Clientes: WhatsApp opcional en el pedido, lista de clientes y avisos ([#50](https://github.com/JosueOmar320/catalogo-saas/pull/50)).
- Historial de versiones del sitio ([#49](https://github.com/JosueOmar320/catalogo-saas/pull/49)).
- Respuestas a reseñas ([#48](https://github.com/JosueOmar320/catalogo-saas/pull/48)).
- Auditoría integral: seguridad, datos, lógica, rendimiento y CI ([#47](https://github.com/JosueOmar320/catalogo-saas/pull/47), [informe](docs/auditorias/AUDITORIA-OCT-2026.md)).

## Octubre 2026 · Editor, código propio y Garfield en el panel

- HTML propio con su CSS, variables y efectos de animación ([#46](https://github.com/JosueOmar320/catalogo-saas/pull/46)).
- Tipo de sitio: negocio con catálogo o sitio web sin productos ([#45](https://github.com/JosueOmar320/catalogo-saas/pull/45)).
- Bandeja de pedidos con folio y estado ([#44](https://github.com/JosueOmar320/catalogo-saas/pull/44)).
- Garfield en todo el panel: escribe textos en los formularios y ayuda con enlaces ([#43](https://github.com/JosueOmar320/catalogo-saas/pull/43)).
- Código propio: HTML limpio, widgets aislados y CSS, habilitado por el administrador ([#42](https://github.com/JosueOmar320/catalogo-saas/pull/42)).
- Más personalización del editor: animaciones, tablet, submenús, pie propio y plantillas de sección ([#41](https://github.com/JosueOmar320/catalogo-saas/pull/41)).
- Accesibilidad revisada con axe en el sitio y el panel ([#40](https://github.com/JosueOmar320/catalogo-saas/pull/40)).

## Octubre 2026 · Pedidos y herramientas del negocio

- Pedido rápido, promociones automáticas y «Nuevo» automático ([#39](https://github.com/JosueOmar320/catalogo-saas/pull/39)).
- Precio programado, propina opcional y reportes descargables ([#38](https://github.com/JosueOmar320/catalogo-saas/pull/38)).
- Costo y margen privados, «Compartir mi lista» y fotos a pantalla completa ([#37](https://github.com/JosueOmar320/catalogo-saas/pull/37)).
- Búsquedas sin resultados, lista de precios en texto y etiquetas con QR ([#36](https://github.com/JosueOmar320/catalogo-saas/pull/36)).
- Sucursales y ventana de bienvenida ([#35](https://github.com/JosueOmar320/catalogo-saas/pull/35)).
- Fuentes self-hosted: el build ya no descarga de Google ([#34](https://github.com/JosueOmar320/catalogo-saas/pull/34)).
- Productos de temporada y «Combínalo con» ([#33](https://github.com/JosueOmar320/catalogo-saas/pull/33)).
- Precios por mayoreo y pedidos en mesa ([#32](https://github.com/JosueOmar320/catalogo-saas/pull/32)).
- Días especiales en el horario, zonas de entrega y favoritos ([#31](https://github.com/JosueOmar320/catalogo-saas/pull/31)).
- Reseñas de clientes con moderación ([#30](https://github.com/JosueOmar320/catalogo-saas/pull/30)).
- Fecha del pedido, existencias y etiquetas de dieta ([#29](https://github.com/JosueOmar320/catalogo-saas/pull/29)).
- Crear productos desde fotos, precio editable en la lista y deshacer al eliminar ([#28](https://github.com/JosueOmar320/catalogo-saas/pull/28)).
- Imágenes para compartir, sitemap de catálogos y datos estructurados ([#27](https://github.com/JosueOmar320/catalogo-saas/pull/27)).
- Rendimiento por producto y kit para compartir ([#26](https://github.com/JosueOmar320/catalogo-saas/pull/26)).
- Extras de producto, nota por producto y horario de pedido ([#25](https://github.com/JosueOmar320/catalogo-saas/pull/25)).
- Recompra, precios al día y pausa de pedidos ([#24](https://github.com/JosueOmar320/catalogo-saas/pull/24)).
- Cupones, barra de anuncios y visitas del sitio ([#23](https://github.com/JosueOmar320/catalogo-saas/pull/23)).
- Entrega, pago y pedido mínimo; horario con «Abierto ahora»; ofertas con fecha de fin ([#22](https://github.com/JosueOmar320/catalogo-saas/pull/22)).
- Deshacer y rehacer en el editor, opciones del producto e importación CSV con fotos ([#21](https://github.com/JosueOmar320/catalogo-saas/pull/21)).
- Acciones masivas, precios, CSV, QR y búsqueda rápida (⌘K) ([#20](https://github.com/JosueOmar320/catalogo-saas/pull/20)).
- Aviso semanal por correo ([#19](https://github.com/JosueOmar320/catalogo-saas/pull/19)) y estadísticas de pedidos ([#18](https://github.com/JosueOmar320/catalogo-saas/pull/18)).

## Octubre 2026 · Calidad y despliegue

- Pruebas end-to-end con sesión sobre Supabase local ([#17](https://github.com/JosueOmar320/catalogo-saas/pull/17)) y con Playwright ([#16](https://github.com/JosueOmar320/catalogo-saas/pull/16)).
- Inicio del panel con revisión del catálogo ([#15](https://github.com/JosueOmar320/catalogo-saas/pull/15)).
- Interfaz en español e inglés ([#13](https://github.com/JosueOmar320/catalogo-saas/pull/13)) y modo oscuro ([#11](https://github.com/JosueOmar320/catalogo-saas/pull/11)).
- Preparación para el despliegue en Vercel ([#3](https://github.com/JosueOmar320/catalogo-saas/pull/3)).

## Septiembre–octubre 2026 · Base (v1 a v5)

- v1: productos, servicios, categorías, publicación, SEO, RLS y límites de plan.
- v2: constructor de sitios con páginas, secciones, temas y PDF por bloques ([auditoría](docs/auditorias/AUDITORIA-V2.md)).
- v3: motor de catálogo con atributos propios y 12 presentaciones ([análisis](docs/auditorias/ANALISIS-CATALOGOS-PDF.md)).
- v4: acceso controlado, panel de administración, auditoría y Garfield AI ([auditoría](docs/auditorias/AUDITORIA-V4.md)).
- v5: biblioteca de medios, Garfield híbrido y composición libre por columnas ([auditoría](docs/auditorias/AUDITORIA-V5.md)).
