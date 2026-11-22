import type { Catalog } from '../translate';

/** Traducciones al inglés: landing (src/app/page.tsx y LandingControls). */
const catalog: Catalog = {
  // Metadatos
  '{app} · Sitio web, catálogo y PDF para pequeños negocios': '{app} · Website, catalog and PDF for small businesses',
  'Crea el sitio web, el catálogo de productos y el PDF de tu negocio sin código. Con asistente de IA, modo oscuro y en español o inglés.':
    'Build your business website, product catalog and PDF without code. With an AI assistant, dark mode, in English or Spanish.',
  'El panel de {app} con Garfield, el sitio en el celular y el catálogo PDF': 'The {app} dashboard with Garfield, the site on a phone and the PDF catalog',
  // Navegación y controles
  Principal: 'Main',
  Funciones: 'Features',
  Tecnología: 'Technology',
  Demo: 'Demo',
  'Iniciar sesión': 'Sign in',
  'Apariencia: {mode}. Cambiar': 'Appearance: {mode}. Change',
  // Héroe y pruebas de valor
  'Para cafeterías, panaderías, ferreterías y estudios de servicios: un sitio con tu marca, tus productos con búsqueda y filtros, pedidos por WhatsApp y el catálogo en PDF. Con Garfield, un asistente que edita por ti.':
    'For cafés, bakeries, hardware stores and service studios: a branded site, your products with search and filters, WhatsApp orders and the PDF catalog. With Garfield, an assistant that edits for you.',
  'Lo que hace distinto a {app}': 'What makes {app} different',
  'El pedido te llega por WhatsApp ya escrito, sin pasarela de pago.': 'Orders reach you on WhatsApp already written, no payment gateway.',
  'El mismo sitio sale como catálogo PDF con el mismo diseño.': 'The same site comes out as a PDF catalog with the same design.',
  'Garfield, el asistente, hace los cambios que le pidas.': 'Garfield, the assistant, makes the changes you ask for.',
  'Recorrer el sitio de ejemplo': 'Browse the sample site',
  'Ver un PDF de ejemplo': 'See a sample PDF',
  'Un administrador crea tu cuenta y tu negocio, y te entrega el enlace para entrar.': 'An administrator creates your account and business, and hands you the link to sign in.',
  'Pide tu acceso': 'Request access',
  'Para quien quiera verlo por dentro: el código, la arquitectura y las pruebas están en GitHub.': 'For anyone who wants to look inside: the code, architecture and tests are on GitHub.',
  'CI con typecheck, lint, más de 800 pruebas (unitarias, sobre Postgres real y end-to-end), CodeQL, auditoría de dependencias y búsqueda de secretos.':
    'CI with type checking, linting, 800+ tests (unit, on real Postgres and end-to-end), CodeQL, dependency auditing and secret scanning.',
  '¿Quieres {app} para tu negocio?': 'Want {app} for your business?',
  'Pruébalo sin cuenta o pide tu acceso: un administrador crea tu negocio y te entrega el enlace.': 'Try it without an account or request access: an administrator creates your business and hands you the link.',
  'Pide tu acceso: un administrador crea tu negocio y te entrega el enlace.': 'Request access: an administrator creates your business and hands you the link.',
  // Hero
  'Sitio web, catálogo y PDF para tu negocio, sin código': 'Website, catalog and PDF for your business, no code',
  'Ver la demo en vivo': 'See the live demo',
  'PDF de ejemplo': 'Sample PDF',
  'Ejemplo de sitio': 'Sample site',
  // Funciones
  'Todo lo que un negocio necesita para vender en línea': 'Everything a business needs to sell online',
  'Constructor visual': 'Visual builder',
  'Páginas, secciones, navegación y diseño con vista previa en vivo en escritorio, tablet y móvil.': 'Pages, sections, navigation and design with a live preview on desktop, tablet and mobile.',
  'Catálogo con búsqueda': 'Searchable catalog',
  'Categorías, filtros por precio y atributos, orden y ficha de cada producto con su propia URL.': 'Categories, price and attribute filters, sorting, and a page with its own URL for every product.',
  'Pedidos por WhatsApp': 'WhatsApp orders',
  'El visitante arma su lista y la envía por WhatsApp con un mensaje ya escrito.': 'Visitors build their list and send it over WhatsApp with a pre-written message.',
  'Catálogo en PDF': 'PDF catalog',
  'El mismo diseño del sitio, listo para imprimir o enviar: portada, índice, catálogo y contacto.': 'The same design as the site, ready to print or share: cover, table of contents, catalog and contact.',
  'Asistente Garfield': 'Garfield assistant',
  'Pide cambios en lenguaje natural ("agrega una sección de testimonios") y revísalos antes de aplicarlos.': 'Ask for changes in plain language ("add a testimonials section") and review them before applying.',
  'Tu marca': 'Your brand',
  '10 temas, fondos con imagen o patrón, tipografía por nivel y una biblioteca de imágenes sin duplicados.': '10 themes, image or pattern backgrounds, per-level typography and a duplicate-free image library.',
  // Cómo funciona
  'Cómo funciona': 'How it works',
  'Recibe tu acceso': 'Get your access',
  'Arma tu sitio y catálogo': 'Build your site and catalog',
  'Elige una plantilla, carga productos y personaliza el diseño, a mano o con Garfield.': 'Pick a template, add products and customize the design, by hand or with Garfield.',
  'Publica y comparte': 'Publish and share',
  'Un enlace para WhatsApp, redes y tu bio, y el PDF para imprimir.': 'One link for WhatsApp, social media and your bio, plus the PDF to print.',
  // Bajo el capó
  'Decisiones técnicas': 'Engineering decisions',
  'Aislamiento multi-tenant': 'Multi-tenant isolation',
  'Row Level Security en todas las tablas y en Storage: un negocio nunca ve datos de otro, aunque se llame a la API directamente.':
    'Row Level Security on every table and in Storage: a business never sees another one’s data, even when calling the API directly.',
  'Un renderer, dos destinos': 'One renderer, two outputs',
  'El mismo modelo de secciones y tokens de diseño se dibuja en React para la web y en react-pdf para el PDF.': 'The same section model and design tokens render with React for the web and react-pdf for the PDF.',
  'IA con límites claros': 'AI with clear limits',
  'El modelo sólo propone acciones tipadas y validadas que el editor aplica con su misma lógica; lo simple se resuelve sin IA.':
    'The model only proposes typed, validated actions that the editor applies with its own logic; simple requests are handled without AI.',
  'Rápido por diseño': 'Fast by design',
  'El catálogo público es estático (ISR) y hace una sola consulta por visita no cacheada.': 'The public catalog is static (ISR) and makes a single query per uncached visit.',
  'Calidad automatizada': 'Automated quality',
  'Accesible e internacional': 'Accessible and international',
  'Modo claro y oscuro, interfaz en español e inglés y sitios públicos en el idioma de cada negocio.': 'Light and dark mode, an English and Spanish interface, and public sites in each business’s language.',
  Tecnologías: 'Technologies',
  // Llamado final y pie
  'Ver el código': 'View the code',
  'Ya tengo acceso': 'I already have access',
  Enlaces: 'Links',

  // Cuenta demo
  'Sin registro: entras a un negocio de prueba propio, con productos, pedidos y estadísticas, que se borra solo en 24 horas.': 'No sign-up: you get your own test business, with products, orders and analytics, deleted automatically after 24 hours.',
  'Probar el panel': 'Try the dashboard',
  'Preparando tu negocio de prueba…': 'Preparing your test business…',
};

export default catalog;
