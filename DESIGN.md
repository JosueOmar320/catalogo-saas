---
name: Vitrina
description: Panel, landing y login de la plataforma Vitrina — el cristal neutro donde luce el negocio de cada quien.
colors:
  azul-tinta: "#2F54D6"
  azul-tinta-oscuro: "#2443B3"
  azul-tinta-suave: "#E8EDFC"
  tinta: "#18181B"
  texto-secundario: "#61616B"
  gris-mudo: "#71717A"
  papel: "#FFFFFF"
  papel-gris: "#F7F7F8"
  linea: "#E4E4E7"
  verde-ok: "#15803D"
  verde-ok-suave: "#DCFCE7"
  ambar-aviso: "#B45309"
  ambar-aviso-suave: "#FEF3C7"
  rojo-error: "#DC2626"
  azul-tinta-noche: "#7C9BFF"
  azul-tinta-noche-oscuro: "#5B7CF0"
  azul-tinta-noche-suave: "#1C2747"
  tinta-noche: "#ECECEF"
  texto-secundario-noche: "#A1A1AA"
  papel-noche: "#16181D"
  papel-gris-noche: "#0E1014"
  linea-noche: "#2A2D35"
  garfield-crema: "#FFF3E3"
  garfield-naranja: "#B8560B"
typography:
  display:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(32px, 6vw, 56px)"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline-sm:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0em"
  title-sm:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
rounded:
  control: "6px"
  tile: "10px"
  panel: "12px"
  band: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.azul-tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.azul-tinta-oscuro}"
    textColor: "{colors.papel}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  button-ink:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  input-text:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8.5px 14px"
    height: "40px"
  chip:
    backgroundColor: "{colors.papel-gris}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  card:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "20px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
    height: "36px"
  nav-item-selected:
    backgroundColor: "{colors.azul-tinta-suave}"
    textColor: "{colors.azul-tinta-oscuro}"
---

# Design System: Vitrina

## Overview

**Creative North Star: "La vitrina en blanco"**

Vitrina es un escaparate: lo que debe lucir es el negocio y sus productos, nunca la plataforma. Por eso el panel, la landing y el login son el cristal: una interfaz neutra, compacta y casi invisible en la que el único color que habla es el azul de acción y el único protagonista es el contenido del negocio (sus fotos, sus precios, su sitio en la vista previa). Toda la expresión visual de la marca de cada negocio vive en su sitio público, que tiene su propio motor de temas; nada de eso se filtra al panel y el panel no se filtra al sitio.

La personalidad es serena y confiable, rápida y directa. Densidad de herramienta de trabajo: tipo base de 14 px, controles pequeños, bordes de 1 px en vez de sombras, fondos en dos grises apenas distintos. Las decisiones se leen en los detalles (un azul bien medido, una negrita 600, una línea divisoria) y no en la decoración. Lo que el sistema rechaza, confirmado con el usuario: el dashboard genérico (degradados, tarjetas con sombras grandes, iconos de colores por todos lados, gráficas de adorno) y el aire "de agencia" en el panel (animaciones vistosas, héroes gigantes); eso queda para los sitios de los negocios.

**Key Characteristics:**
- Un solo color de acción (azul tinta) y cuatro de estado; todo lo demás es tinta, papel y línea.
- Plano: la jerarquía sale del borde, del gris suave y del tipo; las sombras no existen en reposo.
- Compacto: 14 px de base, controles de 34–40 px, radio de 6 px, tarjetas con 20 px de aire.
- Modo claro y oscuro gemelos, con variables CSS y la clase `light`/`dark` en `<html>`.
- La vista previa del sitio del negocio es la única pieza "a color" del panel y siempre se enmarca como tal.

## Colors

Una paleta de tinta sobre papel con un único acento azul; el color saturado se reserva para actuar y para avisar.

### Primary
- **Azul tinta** (#2F54D6): la única acción. Botones principales, enlaces, selección en el menú lateral, foco visible, el eyebrow de la landing. Se oscurece a **Azul tinta oscuro** (#2443B3) al pasar el mouse y en el texto del elemento seleccionado; **Azul tinta suave** (#E8EDFC) es su fondo tenue (ítem de menú activo, baldosa del icono en estados vacíos). En modo oscuro el azul sube a **Azul tinta noche** (#7C9BFF) para conservar contraste sobre fondos oscuros y su suave es un tinte profundo (#1C2747).

### Secondary
- **Tinta** (#18181B): el texto principal y el segundo botón de peso. En la landing el botón principal es tinta sobre papel (no azul): la landing persuade con contraste, el panel actúa con color. La barra "Tienes cambios sin guardar" también es tinta. En modo oscuro se invierte a **Tinta noche** (#ECECEF).

### Tertiary
- **Garfield crema → naranja** (#FFF3E3 → #B8560B): la única paleta cálida, exclusiva del asistente (cabecera, chips, llamadas y enlaces del panel de Garfield). Marca que lo que se ve viene del asistente y no de la plataforma. En oscuro pasa a tonos tostados (#2A1E12 → #F5A55A).

### Neutral
- **Papel** (#FFFFFF): superficies (tarjetas, barra superior, campos). **Papel gris** (#F7F7F8): el fondo del panel; la diferencia con el papel es deliberadamente mínima.
- **Texto secundario** (#61616B): descripciones, ayudas, metadatos. **Gris mudo** (#71717A): notas y pie en la landing.
- **Línea** (#E4E4E7): todos los bordes, divisores y contornos de botones secundarios. En oscuro: **Línea noche** (#2A2D35) sobre **Papel noche** (#16181D) y **Papel gris noche** (#0E1014).
- Estados: **Verde ok** (#15803D, fondo #DCFCE7), **Ámbar aviso** (#B45309, fondo #FEF3C7), **Rojo error** (#DC2626). Sólo en chips de estado, alertas y validación; nunca como decoración.

### Named Rules
**La regla del cristal.** El panel no tiene color propio: cualquier color saturado en pantalla es una acción (azul), un estado (verde, ámbar, rojo), el asistente (crema) o contenido del negocio. Si no es ninguna de esas cosas, es un error.

**La regla del único azul.** Hay un solo acento y ocupa poco: botones principales, enlaces y selección. Dos azules distintos en una pantalla, o un azul usado como fondo grande, rompen el sistema.

## Typography

**Display Font:** Inter Variable (con system-ui, -apple-system, sans-serif), self-hosted desde Fontsource; expuesta como `--font-app`.
**Body Font:** la misma Inter Variable.
**Label/Mono Font:** la pila mono del sistema (`ui-monospace, SFMono-Regular, Menlo, Consolas`) sólo en los campos de código del editor (HTML, CSS, widgets) a 13 px; los atajos de teclado usan `<kbd>` con Inter a 12 px.

**Character:** una sola familia neutra y variable, trabajada con peso y espaciado en vez de con familias: titulares apretados (−0.01 em a −0.035 em) y semibold 650, cuerpo a 14 px. Nada decorativo; la voz es la del contenido.

### Hierarchy
- **Display** (750, clamp(32px, 6vw, 56px), 1.05, −0.035 em): sólo el titular de la landing.
- **Headline** (650, 1.5 rem, −0.01 em): h1 de cada página del panel (`PageHeader`). **Headline sm** (650, 1.25 rem): el h2 del login y los diálogos. Títulos de sección de la landing: clamp(24px, 3.5vw, 32px), −0.02 em.
- **Title** (650, 1 rem): título de tarjeta (`SectionCard`, semánticamente `h2` bajo el h1 de la página) y de estado vacío. **Title sm** (600, 0.9375 rem): subtítulos dentro de una tarjeta (h4 de MUI).
- **Body** (400, 0.875 rem = 14 px, 1.5): todo el panel. La landing usa 18 px/1.55 para el lead y 14 px/1.55 en tarjetas; máximo 640–660 px de ancho de línea en descripciones.
- **Label** (600, 0.6875 rem, 0.06 em, mayúsculas): el `overline`; los chips y botones van en 600 sin mayúsculas (`textTransform: none`).
- **Nav** (600, 14 px; hijos 13.5 px): entradas del menú lateral.

### Named Rules
**La regla del 14.** El cuerpo del panel es 14 px y no se agranda para "respirar": el aire viene del espaciado, no del tamaño. Un texto de 16 px en el panel es un error salvo en el lead de la landing.

**La regla de la negrita 600.** Lo accionable (botones, pestañas, nav, chips) pesa 600; lo que se lee pesa 400; los títulos 650. No hay 500 ni 700 salvo el logotipo (750) y el "ADMIN" (700).

## Layout

El panel es una app de dos columnas: menú lateral fijo de 248 px (desde `md`, 900 px; antes, cajón temporal) y una columna de contenido con barra superior pegajosa de 56 px (papel al 90 % con `backdrop-filter: blur(8px)`) y un `<main>` de hasta 1240 px centrado, con 16 px de margen en móvil y 24 px desde `sm` (600 px), más 96 px de margen inferior para que la barra de guardar no tape nada. Las pantallas de trabajo (editor del sitio, estudio de PDF) van a todo lo ancho con 16 px.

La escala de espaciado es la de MUI (múltiplos de 8 px, con 4 px para ajustes): 20 px de relleno en tarjetas (`SectionCard`), 24 px entre el encabezado de página y el contenido, 8 px entre botones de acción, 2 px entre ítems del menú. Formularios en una columna con campos a lo ancho (`fullWidth` por defecto).

La landing usa un contenedor de 1120 px con márgenes de 16 px (32 px desde 720 px), secciones separadas 96 px, héroe centrado con 72 px arriba, rejilla de tarjetas 1 → 2 → 3 columnas (640 px, 960 px) unida por líneas de 1 px, y un bloque final gris de 56 px de relleno. Puntos de quiebre del panel: 600 / 900 / 1200 px (MUI); de la landing: 640 / 720 / 760 / 960 px.

## Elevation & Depth

Plano con bordes siempre. Las superficies del panel no tienen sombra: `Paper` nace con `elevation: 0` y variante `outlined`, y en modo oscuro se apaga el degradado de elevación de MUI (`backgroundImage: none`). La profundidad se dice con tres recursos: el borde de 1 px (línea), el salto entre papel gris y papel, y el peso tipográfico. La única excepción son las superficies que flotan sobre todo lo demás (menús, diálogos, tooltips, la paleta de comandos, el cajón móvil), que conservan la sombra por defecto de MUI porque son otra capa, no una tarjeta.

### Shadow Vocabulary
- **Vista previa del navegador** (`box-shadow: 0 24px 60px -32px rgba(16, 24, 40, 0.35)`): sólo en la landing, bajo el marco que muestra el sitio de ejemplo; es la foto del producto, no un componente.

### Named Rules
**La regla del borde.** Si una superficie necesita separarse del fondo, lleva un borde de 1 px de línea; nunca una sombra. Una sombra en una tarjeta, una tabla o un botón del panel es un error.

## Shapes

Esquinas apenas suavizadas: 6 px en todo lo que se toca (botones, campos, ítems del menú, tarjetas, el skip link, `kbd` a 4.5 px). La landing abre un poco más la mano según el tamaño de la pieza: 10 px en las baldosas de cifras, 12 px en el marco del navegador y la rejilla de funciones, 14 px en la banda final. Píldoras (999 px) sólo para etiquetas de tecnologías y chips; círculos sólo para los numerales de "Cómo funciona" y los puntos del marco del navegador. Bordes finos de 1 px siempre; sin bordes dobles, sin biseles, sin recortes.

## Components

### Buttons
Precisos y contenidos: pequeños, sin elevación, con el peso 600 como única voz.
- **Shape:** esquinas de 6 px; altura mínima 34 px y 12 px de relleno lateral en el panel (`size: small`, `disableElevation`).
- **Primary:** azul tinta con texto papel; al pasar el mouse, azul tinta oscuro. Uno por pantalla o por tarjeta.
- **Secondary / Outlined:** borde de línea, texto tinta; al pasar el mouse el borde toma el texto secundario. **Text:** sin borde, para acciones terciarias y "Descartar".
- **Landing:** el botón principal es tinta sobre papel (12 px × 20 px, 15 px, 600) y el secundario es un fantasma con borde de línea; en oscuro se invierten (papel sobre tinta).
- **Focus:** contorno de 2 px azul tinta con 2 px de separación, siempre visible con teclado.
- **Icon buttons:** 30 px en la landing; `size: small` en el panel; siempre con `aria-label`.

### Chips
- **Style:** `size: small`, peso 500, píldora; fondo papel gris o el suave del estado (verde, ámbar, azul) con texto del estado.
- **State:** los chips de estado no son interactivos; los filtros usan `ToggleButton` con el texto secundario cuando no están seleccionados (contraste ≥ 4.5:1).

### Cards / Containers
- **Corner Style:** 6 px.
- **Background:** papel sobre papel gris.
- **Shadow Strategy:** ninguna (regla del borde).
- **Border:** 1 px línea (`Paper variant="outlined"`).
- **Internal Padding:** 20 px; `SectionCard` lleva título (`h3`), descripción secundaria y acción a la derecha, y en modo `flush` las listas llegan al borde con un divisor bajo el encabezado. `LinkCard` es una tarjeta entera clicable: al pasar el mouse el borde toma el texto secundario y el fondo `action.hover`.

### Inputs / Fields
- **Style:** `TextField` outlined `small`, a lo ancho, etiqueta de 0.875 rem, borde de línea sobre papel, 6 px de radio; selects con etiqueta siempre encogida para permitir la opción vacía.
- **Focus:** borde de 2 px azul tinta (MUI); el mensaje de error va bajo el campo en rojo error y se traduce al mostrarse.
- **Error / Disabled:** rojo error en borde y ayuda; deshabilitado atenuado por MUI.
- **Switches:** `size: small`, con etiqueta y descripción opcional (`SwitchControl`).

### Navigation
- Menú lateral: entradas de 14 px/600 con icono de 17 px a la izquierda (lucide), radio 6 px, 2 px de separación; el activo lleva fondo azul tinta suave y texto azul tinta oscuro (`aria-current="page"`); los grupos se pliegan con un chevron de 14 px que gira en 0.15 s. Móvil: cajón temporal de 248 px.
- Barra superior: buscador que parece un campo (280 px, borde de línea, `kbd` con ⌘K / Ctrl K), Garfield, idioma, modo claro/oscuro y el control de publicación; en móvil el buscador es un icono.
- Landing: barra pegajosa de 60 px con papel translúcido y `blur(10px)`; enlaces en texto secundario que pasan a tinta; selector de idioma segmentado de 12 px/650.

### Feedback
- **Toasts:** `Snackbar` abajo al centro, `Alert` relleno (`filled`); los errores son `role="alert"` y duran 6 s, el resto `role="status"` y 3 s; una acción opcional ("Deshacer") alarga a 6 s.
- **Barra de guardar:** fija abajo, centrada, 560 px máximo, tinta con texto papel, aparece deslizándose cuando hay cambios; "Descartar" como texto y "Guardar" relleno.
- **Confirmaciones destructivas:** diálogo con el foco inicial en "Cancelar".
- **Estados vacíos:** baldosa de 12 px de radio en azul tinta suave con icono de 22 px azul, título `h3`, descripción secundaria de 380 px máximo y, si aplica, una acción.
- **Carga:** esqueletos con la forma del contenido (`PageSkeleton`, `role="status" aria-busy`).

### Vista previa del sitio (signature)
La única pieza del panel que puede tener color propio: el sitio del negocio dentro de un marco. En la landing es un "navegador" (barra gris con tres puntos y la URL, 12 px de radio, la única sombra del sistema, `color-scheme: light` para que no herede el modo oscuro); en el editor es la vista previa con `contain: paint` para que el código propio del negocio no pueda salirse. Lo que hay dentro obedece al motor de temas de los sitios (`src/lib/design/*`, `src/site-renderer/theme-vars.ts`), un sistema aparte con sus propias variables, 10 presets y 4 niveles de sombra, que no se documenta aquí y no debe contaminar el panel.

## Do's and Don'ts

### Do:
- **Do** usar `theme.vars.palette.*` y tokens de `sx` (`'divider'`, `'text.secondary'`, `'primary.light'`) en todo el panel: nunca un hex fijo, para que claro y oscuro sigan siendo gemelos.
- **Do** separar superficies con borde de 1 px de línea y, si hace falta otro nivel, con papel gris; la jerarquía la terminan el tipo (650 / 600 / 400) y el espaciado de 8 px.
- **Do** reservar el azul tinta a una acción principal por tarjeta o pantalla, los enlaces, la selección y el foco.
- **Do** mantener los controles compactos: `size: small`, 34 px de altura mínima en botones, 14 px de cuerpo, 6 px de radio.
- **Do** enmarcar cualquier contenido del negocio (sitio, PDF, fotos) como contenido: borde, marco de navegador o lienzo con `contain: paint`.
- **Do** dar a todo control un `aria-label` o un nombre visible, un foco de 2 px azul y un estado vacío o de carga con la forma del contenido.

### Don't:
- **Don't** añadir sombras a tarjetas, tablas, botones o campos del panel; sólo las capas flotantes de MUI las tienen.
- **Don't** introducir degradados, iconos de colores, gráficas decorativas ni "hero" en el panel: eso es el dashboard genérico que el sistema rechaza.
- **Don't** usar un segundo acento o un azul como fondo grande; el color saturado siempre significa acción, estado o asistente.
- **Don't** llevar la paleta cálida de Garfield fuera del asistente ni colores de los temas de sitios al panel.
- **Don't** subir el cuerpo del panel por encima de 14 px ni abrir radios por encima de 6 px en controles (10–14 px sólo en piezas grandes de la landing).
- **Don't** animar nada que no sea un cambio de estado: 0.15 s para bordes, fondos y chevrones; deslizar sólo la barra de guardar.
