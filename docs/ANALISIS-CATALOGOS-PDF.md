# Análisis de catálogos de referencia y propuesta v3: constructor de catálogos comerciales

Referencias analizadas: un catálogo de **servicios** de 9 páginas y un catálogo de **productos** de 8 páginas, ambos A4 vertical y del mismo negocio de belleza. No se copian: se extraen los problemas de diseño que resuelven y se convierten en herramientas genéricas.

## 1. Análisis comparativo

| Aspecto | Catálogo de servicios (9 pp.) | Catálogo de productos (8 pp.) | Patrón genérico |
| --- | --- | --- | --- |
| **Portada** | Fondo liso claro, logo grande centrado, nombre, lema y título. Líneas onduladas en las esquinas y destellos. | Fondo de color intenso con un panel interior más claro (marco), ilustración decorativa en las esquinas, título en dos estilos ("Catálogo de" fino + "Productos" grueso y de color). | **Layouts de portada** (centrada, marco, imagen a sangre, dividida, banda), título de dos tonos, decoraciones de esquina. |
| **Página de presentación** | Foto de retrato + texto de bienvenida en primera persona. | Párrafo promocional dentro de la banda del encabezado. | **Página de información** reutilizando secciones del sitio (texto + imagen). |
| **Encabezado** | Título grande y decorativo repetido en cada página, atravesado por una línea ondulada. | Banda negra a todo el ancho con título en dos tonos y ornamento. | **Estilos de encabezado**: ninguno, línea, título grande, banda de color. |
| **Pie** | Usuario de redes a la izquierda, logo pequeño a la derecha. | Barra oscura con bloque de color y usuario de redes; ornamento en la esquina. | **Estilos de pie**: línea o banda, con redes, contacto y numeración. |
| **Presentación de ítems** | 2 a 3 servicios por página, **alternados** (imagen a un lado y texto al otro). Imágenes con **formas y borde de color** (círculo, arco, ondulada, hexágono). | 4 a 6 productos por página en disposición **escalonada** de 2 columnas, fotos recortadas sobre fondo blanco y texto junto a cada imagen. | **Layouts de producto**: zigzag, escalonado, cuadrícula, etc. **Forma y marco de imagen** configurables. **Ítems por página**. |
| **Nombre** | Tipografía de acento, mediana. | Negrita en color de acento; incluye la **marca** ("Labial Matte Maybelline"). | El nombre debe ir separado de la **marca**: atributo "Marca". |
| **Precio** | Prefijo "VALOR:" en mayúsculas, cursiva y negrita. | Número grande con la moneda **después** ("365 C$"). | **Formato de precio**: prefijo, símbolo o código, posición antes o después, decimales. |
| **Códigos, categorías** | No hay. | No hay (aunque existen familias implícitas: labios, ojos, rostro). | Opcionales: SKU, categorías con **portadas de categoría** e **índice** para catálogos grandes. |
| **Galería** | Mosaico hexagonal de 5 fotos para un solo servicio. | No. | **Galería** del ítem y bloque de galería. |
| **Contacto** | Foto a sangre + título "CONTÁCTANOS" decorativo + redes con íconos + **política** (anticipo no reembolsable). | Igual que la portada (marco + flores) + contacto en 2 columnas con íconos. | **Página de contacto** con título decorativo, íconos y **notas o políticas**. |
| **Color** | 2 tonos (rosa pálido y rosa intenso). | 3 (rosa, negro, blanco). | Se toman del **tema del sitio**; las plantillas deciden dónde se aplican. |
| **Fondos** | Liso en todas las páginas. | Liso de color en portada y contacto; blanco en las páginas de productos. | **Fondo distinto para portada y páginas interiores**. |
| **Decoración** | Líneas onduladas y destellos. | Flores en las esquinas, labial y bloques de color. | **Decoraciones genéricas**: esquinas (ondas, burbujas, líneas, puntos), destellos, marco interior. Sin ilustraciones propias del cliente. |
| **Uso del espacio** | Mucho aire; pocos ítems por página, grandes. | Denso pero ordenado. | **Densidad** e ítems por página configurables. |
| **Problemas detectados** | Precio y nombre a veces montados sobre la foto. Sin índice. | **Última página en blanco** (desperdicio). Sin índice ni categorías. Posición de productos hecha a mano. | Nunca generar páginas vacías. Índice automático. Posicionamiento automático. |

### Qué funcionalidades se desprenden

1. Ítems por página y paginación explícita (2 a 3 servicios o 4 a 6 productos por página).
2. Layouts alternados (zigzag) y escalonados.
3. Forma y marco de imágenes.
4. Formato de precio configurable (prefijo "VALOR:", código "C$" después del número).
5. Encabezado y pie repetidos con estilos de banda o título.
6. Decoraciones de esquina y destellos.
7. Portada con varios layouts y título de dos tonos.
8. Fondos distintos para portada y páginas interiores.
9. Página de información/presentación y página de contacto con notas.
10. Marca como atributo del producto.

## 2. Limitaciones de la versión actual (v2)

| Limitación | Impacto |
| --- | --- |
| En el PDF, la presentación de productos está fijada por la plantilla (una sola por plantilla). | No se pueden combinar layouts dentro del mismo catálogo. |
| La web tiene 2 o 3 formatos por sección y no comparte el concepto con el PDF. | La misma decisión ("¿cómo muestro mis productos?") se toma dos veces, de distinta forma. |
| No hay atributos ni especificaciones. | Imposible hacer catálogos técnicos, fichas de detalle o comparaciones. |
| La web sólo ofrece búsqueda y categorías. | No hay filtros por precio, etiquetas ni atributos, ni ordenamiento ni paginación. |
| El PDF no tiene índice, portadas de categoría, fichas de detalle, comparación ni saltos manuales. | No escala a catálogos grandes. |
| El PDF no controla ítems por página. | No se pueden reproducir los ritmos de página de las referencias. |
| La portada tiene un solo layout por plantilla. | Poca identidad propia. |

## 3. Arquitectura propuesta

```
                Datos del catálogo (ítems, categorías, atributos, páginas)
                                   │
            ┌──────────────────────┴──────────────────────┐
            │  Configuración compartida                    │
            │  · Presentación de productos (layout + opciones)│
            │  · Colecciones (fuentes dinámicas de ítems)  │
            │  · Orden · Formato de precio · Tema          │
            └──────────────┬──────────────────┬────────────┘
                           │                  │
                 Web renderer            PDF renderer
       (filtros, búsqueda, orden,   (páginas, saltos, índice,
        paginación, responsive)      encabezado/pie, portada)
```

Web y PDF **no comparten componentes visuales** (sus necesidades son distintas), pero sí comparten el **modelo de datos**, la **configuración de presentación**, las **colecciones**, el **orden**, el **formato de precio** y los **tokens de diseño**.

### 3.1 Presentación de productos (`lib/catalog/presentation.ts`)

Un único objeto `presentation` lo usan las secciones web (Productos, Servicios, Catálogo) y los bloques PDF (Catálogo, Productos):

| Layout | Para qué sirve | Opciones relevantes |
| --- | --- | --- |
| **Cuadrícula** | Uso general | columnas (web: escritorio, tablet y móvil; PDF: 1 a 5), separación, tamaño y proporción de imagen, forma, alineación |
| **Tarjetas grandes** | Pocos ítems, mucho detalle | proporción, forma |
| **Lista compacta** | Catálogos extensos | imagen izquierda/derecha, tamaño de imagen, separadores |
| **Editorial** | Destacar un ítem grande junto a otros | forma, tamaño |
| **Imagen protagonista** | Moda, portafolios | proporción; texto sobre la imagen |
| **Lista de precios** | Menús, servicios, repuestos | separadores, puntos guía, mostrar imagen |
| **Zigzag** | Servicios (referencia 1) | tamaño y forma de imagen, alternar |
| **Ficha de detalle** | Un ítem por bloque o página | imagen izquierda/derecha, galería, especificaciones |
| **Revista** | Catálogo comercial: destacado + cuadrícula | columnas |

Campos visibles por layout: descripción, precio, código, categoría, badges, atributos (ninguno, los marcados para tarjeta o todos) y botón. La interfaz **sólo muestra las opciones que aplican al layout elegido** (tabla `LAYOUT_OPTIONS`).

La comparación se hace como **bloque PDF** (tabla con las columnas precio, código y los atributos elegidos). La versión web queda preparada en la arquitectura.

### 3.2 Atributos personalizados

- **Campos estructurados** (columnas; se usan para lógica, orden y filtros universales): nombre, tipo, descripciones, precio, precio anterior, moneda, nota de precio (unidad), SKU/código, disponibilidad, destacado, visible, categoría, etiquetas, imágenes.
- **Atributos definidos por el negocio** (`catalogs.attribute_defs`, JSONB): marca, modelo, material, dimensiones, peso, garantía, tamaño, ingredientes, calorías, duración, modalidad, "incluye"… Cada definición tiene nombre, tipo (texto, número, opciones, sí/no, lista), unidad, opciones y dónde se muestra (tarjeta, detalle, PDF) y si es **filtrable**.
- **Valores** en `catalog_items.attributes.values` (JSONB que ya existía): sin columnas nuevas por industria.
- **Badges** ampliados: Nuevo, Destacado, Popular, Oferta (automático), Agotado (automático) y uno personalizado.
- **Variantes** (talla o color con precio propio) quedan fuera de esta iteración: requieren inventario y precio por variante (ver ROADMAP). Mientras tanto, un atributo de tipo "opciones" cubre "colores disponibles".

### 3.3 Colecciones (fuentes dinámicas)

`Destacados · Nuevos · Ofertas · Populares · Recientes · Categoría · Atributo = valor (p. ej. Marca = X) · Elegidos a mano · Todos`, con un orden propio. Las usan las secciones web y los bloques PDF.

### 3.4 Orden

`Personalizado (el del administrador) · Nombre · Precio ↑ · Precio ↓ · Más recientes · Destacados primero`. Cada sección o bloque define su orden predeterminado. En la web el visitante puede cambiarlo si el administrador lo permite.

### 3.5 Filtros (web)

Configurables por sección de catálogo: búsqueda (nombre, código, descripción, etiquetas y valores de atributos), categorías, rango de precio, badges (Nuevo, Oferta, Popular) y **cualquier atributo marcado como filtrable**. Nada es específico de una industria.

### 3.6 Paginación

- **Web**: todo · páginas numeradas · "cargar más" · scroll infinito, con ítems por página.
- **PDF**: ítems por página (0 = automático), cada categoría en página nueva, bloque "salto de página" manual, encabezado y pie por página y numeración.

### 3.7 Constructor de PDF por bloques

El PDF es una **lista ordenada de bloques**, cada uno con opción "empezar en página nueva":

| Bloque | Cubre |
| --- | --- |
| Portada | 6 layouts (centrada, marco, imagen a sangre, dividida, banda, minimal); logo, título de dos tonos, subtítulo, fecha, versión, texto extra, overlay, decoraciones |
| Índice | Automático, con números de página y enlaces internos (dos pasadas de render) |
| Catálogo por categorías | Portada de categoría (simple, imagen, hero o editorial) + presentación + ítems por página |
| Productos | Una colección con su propia presentación (cuadrícula, lista, ficha de detalle…) |
| Comparación | Tabla de ítems × atributos |
| Página del sitio | Información, nosotros, garantía, envíos, pagos o promociones, **con el mismo sistema de secciones de la web** (una página oculta sirve como página sólo para el PDF) |
| Contacto | Título, íconos, redes y **notas o políticas** |
| Salto de página | Manual |

**Plantillas** = puntos de partida que configuran portada, encabezado y pie, decoraciones, estilo de categorías y presentación por defecto: *Comercial, Catálogo de productos, Editorial, Minimal, Brochure, Técnico, Menú, Lujo y Moderno*. Todo se puede cambiar después.

**Decoraciones genéricas**: esquinas (ondas, burbujas, líneas, puntos), destellos, marco interior, en el color principal o de acento del tema.

**Formato de precio** (web y PDF): prefijo ("VALOR:", "desde"), moneda como símbolo, código o nada, antes o después del número, y decimales.

### 3.8 Vista previa del PDF

PDF real en la vista previa, con **selector de página** (salto a la página N) y número total de páginas.

### 3.9 Administración (separación de conceptos)

- **Contenido**: productos, servicios, categorías, **atributos**, orden.
- **Sitio web**: páginas y secciones, navegación, diseño.
- **Catálogo PDF**: plantilla, bloques, portada, página, encabezado y pie, decoraciones.
- **Configuración**: negocio, contacto, redes, SEO, publicación, **formato de precio**.

## 4. Cambios de base de datos (migración `20260929000000_catalog_engine.sql`)

| Cambio | Motivo |
| --- | --- |
| `catalogs.attribute_defs jsonb` (arreglo) | Definiciones de atributos por catálogo; se editan como un todo y se leen siempre juntas. |
| (Sin cambios) `catalog_items.attributes.values` | Valores de atributos: la columna JSONB ya existe. |
| (Sin cambios) `catalogs.pdf` | Pasa a v2 (bloques); se migra en código desde v1. |
| (Sin cambios) `catalogs.settings.priceFormat` | Formato de precio, con valores por defecto. |
| `get_public_catalog` | Sin cambios: `to_jsonb(catalog)` ya incluye `attribute_defs`. |

## 5. Qué se reutiliza y qué se refactoriza

| Se reutiliza | Se refactoriza |
| --- | --- |
| Tema, tokens, fondos, patrones, íconos, texto enriquecido | `features/pdf/templates.tsx` → **motor de bloques** + **layouts de producto PDF** + **plantillas como presets** |
| Primitivas PDF (fondo, íconos, precio, badges), fuentes, imágenes | `lib/pdf/settings.ts` → v2 con bloques (y migración desde v1) |
| Secciones del sitio (páginas PDF de información) | Secciones web de productos, servicios y catálogo → usan `presentation`; el catálogo gana filtros, orden y paginación |
| Builder, controles, editores | `ItemCard` → layouts de producto web |
| Server Actions, RLS, caché | Formulario de ítem → atributos; nueva página **Atributos** |

## 6. Propuestas adicionales (surgidas del análisis)

1. **Formato de precio** con prefijo y moneda antes o después (ya incluido).
2. **Nunca páginas en blanco**: el motor sólo crea páginas con contenido (en la referencia sobra la última).
3. **Portada y contacto con fondo propio**, distinto del de las páginas interiores (ya incluido).
4. **Notas o políticas en contacto** (anticipos, garantía, envíos) (ya incluido).
5. **Página "sólo PDF"**: una página oculta del sitio usada como bloque del PDF (ya incluido).
6. Próximas iteraciones:
   - Código QR hacia la ficha web de cada producto.
   - Marca de agua ("borrador", "precios sujetos a cambio").
   - Vigencia de precios en la portada.
   - Exportar lista de precios en CSV.
   - Versión imprimible en blanco y negro (el ahorro de tinta ya existe).
