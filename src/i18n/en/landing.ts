import type { Catalog } from '../translate';

/** Traducciones al inglés: landing (src/app/page.tsx y LandingControls). */
const catalog: Catalog = {
  // Metadatos
  '{app} · Sitio web, catálogo y PDF para pequeños negocios': '{app} · Website, catalog and PDF for small businesses',
  'Crea el sitio web, el catálogo de productos y el PDF de tu negocio sin código. Con asistente de IA, modo oscuro y en español o inglés.':
    'Build your business website, product catalog and PDF without code. With an AI assistant, dark mode, in English or Spanish.',
  // Navegación y controles
  Principal: 'Main',
  Funciones: 'Features',
  Tecnología: 'Technology',
  Demo: 'Demo',
  'Iniciar sesión': 'Sign in',
  'Apariencia: {mode}. Cambiar': 'Appearance: {mode}. Change',
  // Hero
  'SaaS multi-tenant para pequeños negocios': 'Multi-tenant SaaS for small businesses',
  'Sitio web, catálogo y PDF para tu negocio, sin código': 'Website, catalog and PDF for your business, no code',
  'Crea un sitio con tu marca, publica tus productos con búsqueda y filtros, recibe pedidos por WhatsApp y descarga un catálogo en PDF. Con un asistente de IA que edita por ti.':
    'Build a branded site, publish your products with search and filters, take orders over WhatsApp and download a PDF catalog. With an AI assistant that edits for you.',
  'Ver la demo en vivo': 'See the live demo',
  'PDF de ejemplo': 'Sample PDF',
  'tipos de sección': 'section types',
  'diseños de producto': 'product layouts',
  'plantillas de PDF': 'PDF templates',
  idiomas: 'languages',
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
  'Un administrador crea tu cuenta y tu negocio. No hay registro público.': 'An administrator creates your account and business. There is no public sign-up.',
  'Arma tu sitio y catálogo': 'Build your site and catalog',
  'Elige una plantilla, carga productos y personaliza el diseño, a mano o con Garfield.': 'Pick a template, add products and customize the design, by hand or with Garfield.',
  'Publica y comparte': 'Publish and share',
  'Un enlace para WhatsApp, redes y tu bio, y el PDF para imprimir.': 'One link for WhatsApp, social media and your bio, plus the PDF to print.',
  // Bajo el capó
  'Bajo el capó': 'Under the hood',
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
  'CI con typecheck, lint, más de 300 pruebas (unitarias y sobre Postgres), CodeQL, auditoría de dependencias y búsqueda de secretos.':
    'CI with type checking, linting, 300+ tests (unit and on Postgres), CodeQL, dependency auditing and secret scanning.',
  'Accesible e internacional': 'Accessible and international',
  'Modo claro y oscuro, interfaz en español e inglés y sitios públicos en el idioma de cada negocio.': 'Light and dark mode, an English and Spanish interface, and public sites in each business’s language.',
  Tecnologías: 'Technologies',
  // Llamado final y pie
  '¿Quieres verlo por dentro?': 'Want to look inside?',
  'El código, la arquitectura y las pruebas están en GitHub. El acceso al panel es por invitación.': 'The code, architecture and tests are on GitHub. Access to the dashboard is by invitation.',
  'Ver el código': 'View the code',
  'Ya tengo acceso': 'I already have access',
  Enlaces: 'Links',

  // Cuenta demo
  'Sin registro: entras a un negocio de prueba propio, con productos, pedidos y estadísticas, que se borra solo en 24 horas.': 'No sign-up: you get your own test business, with products, orders and analytics, deleted automatically after 24 hours.',
  'Probar el panel': 'Try the dashboard',
  'Preparando tu negocio de prueba…': 'Preparing your test business…',
};

export default catalog;
