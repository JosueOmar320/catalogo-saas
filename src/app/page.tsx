import { ArrowRight, Bot, Code2, FileDown, Gauge, Languages, LayoutTemplate, MessageCircle, Palette, Search, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteView } from '@/site-renderer';
import { appFont } from '@/components/providers/app-font';
import { AppI18n } from '@/i18n/AppI18n';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { buildSampleSite } from '@/lib/site/sample-site';
import { env } from '@/lib/env';
import { isDemoEnabled } from '@/features/demo/config';
import { TryDashboardButton } from '@/features/demo/components/TryDashboardButton';
import { LandingControls } from './LandingControls';
import styles from './landing.module.css';

const REPO_URL = 'https://github.com/JosueOmar320/catalogo-saas';
const OG_IMAGE = '/social/vitrina-og.jpg';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t('{app} · Sitio web, catálogo y PDF para pequeños negocios', { app: env.appName });
  const description = t('Crea el sitio web, el catálogo de productos y el PDF de tu negocio sin código. Con asistente de IA, modo oscuro y en español o inglés.');
  // Vista previa al compartir el enlace (LinkedIn, WhatsApp, X). Sólo la landing: los catálogos usan la suya.
  const image = { url: OG_IMAGE, width: 1200, height: 630, alt: t('El panel de {app} con Garfield, el sitio en el celular y el catálogo PDF', { app: env.appName }) };
  return {
    title: { absolute: title },
    description,
    openGraph: { type: 'website', url: '/', siteName: env.appName, title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

const STATS = [
  { value: '21', label: msg('tipos de sección') },
  { value: '12', label: msg('diseños de producto') },
  { value: '11', label: msg('plantillas de PDF') },
  { value: 'ES · EN', label: msg('idiomas') },
];

const FEATURES = [
  { icon: LayoutTemplate, title: msg('Constructor visual'), text: msg('Páginas, secciones, navegación y diseño con vista previa en vivo en escritorio, tablet y móvil.') },
  { icon: Search, title: msg('Catálogo con búsqueda'), text: msg('Categorías, filtros por precio y atributos, orden y ficha de cada producto con su propia URL.') },
  { icon: MessageCircle, title: msg('Pedidos por WhatsApp'), text: msg('El visitante arma su lista y la envía por WhatsApp con un mensaje ya escrito.') },
  { icon: FileDown, title: msg('Catálogo en PDF'), text: msg('El mismo diseño del sitio, listo para imprimir o enviar: portada, índice, catálogo y contacto.') },
  { icon: Bot, title: msg('Asistente Garfield'), text: msg('Pide cambios en lenguaje natural ("agrega una sección de testimonios") y revísalos antes de aplicarlos.') },
  { icon: Palette, title: msg('Tu marca'), text: msg('10 temas, fondos con imagen o patrón, tipografía por nivel y una biblioteca de imágenes sin duplicados.') },
];

const STEPS = [
  { title: msg('Recibe tu acceso'), text: msg('Un administrador crea tu cuenta y tu negocio. No hay registro público.') },
  { title: msg('Arma tu sitio y catálogo'), text: msg('Elige una plantilla, carga productos y personaliza el diseño, a mano o con Garfield.') },
  { title: msg('Publica y comparte'), text: msg('Un enlace para WhatsApp, redes y tu bio, y el PDF para imprimir.') },
];

const ENGINEERING = [
  { icon: ShieldCheck, title: msg('Aislamiento multi-tenant'), text: msg('Row Level Security en todas las tablas y en Storage: un negocio nunca ve datos de otro, aunque se llame a la API directamente.') },
  { icon: Workflow, title: msg('Un renderer, dos destinos'), text: msg('El mismo modelo de secciones y tokens de diseño se dibuja en React para la web y en react-pdf para el PDF.') },
  { icon: Sparkles, title: msg('IA con límites claros'), text: msg('El modelo sólo propone acciones tipadas y validadas que el editor aplica con su misma lógica; lo simple se resuelve sin IA.') },
  { icon: Gauge, title: msg('Rápido por diseño'), text: msg('El catálogo público es estático (ISR) y hace una sola consulta por visita no cacheada.') },
  { icon: Code2, title: msg('Calidad automatizada'), text: msg('CI con typecheck, lint, más de 300 pruebas (unitarias y sobre Postgres), CodeQL, auditoría de dependencias y búsqueda de secretos.') },
  { icon: Languages, title: msg('Accesible e internacional'), text: msg('Modo claro y oscuro, interfaz en español e inglés y sitios públicos en el idioma de cada negocio.') },
];

const STACK = ['Next.js 16', 'React 19', 'TypeScript', 'Supabase', 'PostgreSQL', 'Zod', 'MUI', 'react-pdf', 'Vercel'];

export default async function Home() {
  const t = await getT();
  const demoEnabled = isDemoEnabled();
  return (
    <AppI18n>
      <div className={`${appFont.variable} ${styles.page}`}>
        <header className={styles.nav}>
          <div className={styles.container}>
            <Link href="/" className={styles.logo}>{env.appName}</Link>
            <nav className={styles.navLinks} aria-label={t('Principal')}>
              <a href="#funciones">{t('Funciones')}</a>
              <a href="#tecnologia">{t('Tecnología')}</a>
              <Link href="/demo">{t('Demo')}</Link>
            </nav>
            <div className={styles.navActions}>
              <LandingControls />
              <Link href="/login" className={styles.buttonSmall}>{t('Iniciar sesión')}</Link>
            </div>
          </div>
        </header>

        <main>
          <section className={`${styles.container} ${styles.hero}`}>
            <p className={styles.eyebrow}>{t('SaaS multi-tenant para pequeños negocios')}</p>
            <h1 className={styles.title}>{t('Sitio web, catálogo y PDF para tu negocio, sin código')}</h1>
            <p className={styles.lead}>
              {t('Crea un sitio con tu marca, publica tus productos con búsqueda y filtros, recibe pedidos por WhatsApp y descarga un catálogo en PDF. Con un asistente de IA que edita por ti.')}
            </p>
            <div className={styles.ctas}>
              {demoEnabled && <TryDashboardButton className={styles.button} errorClassName={styles.demoError} />}
              <Link href="/demo" className={demoEnabled ? styles.buttonGhost : styles.button}>
                {t('Ver la demo en vivo')} <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/demo/pdf" className={styles.buttonGhost} target="_blank">
                <FileDown size={16} aria-hidden /> {t('PDF de ejemplo')}
              </Link>
            </div>
            {demoEnabled && <p className={styles.demoNote}>{t('Sin registro: entras a un negocio de prueba propio, con productos, pedidos y estadísticas, que se borra solo en 24 horas.')}</p>}
            <dl className={styles.stats}>
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.value}</dt>
                  <dd>{t(stat.label)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.container} aria-label={t('Ejemplo de sitio')}>
            <div className={styles.browser}>
              <div className={styles.browserBar}>
                <span /><span /><span />
                <p>{env.siteUrl.replace(/^https?:\/\//, '')}/catalogo/cafe-aurora</p>
              </div>
              <div className={styles.browserBody}>
                <SiteView site={buildSampleSite()} env={{ mode: 'preview', basePath: '/demo', currentPageId: null }} />
              </div>
            </div>
          </section>

          <section id="funciones" className={`${styles.container} ${styles.section}`}>
            <h2 className={styles.sectionTitle}>{t('Todo lo que un negocio necesita para vender en línea')}</h2>
            <div className={styles.grid}>
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className={styles.card}>
                  <Icon size={20} aria-hidden />
                  <h3>{t(title)}</h3>
                  <p>{t(text)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.container} ${styles.section}`}>
            <h2 className={styles.sectionTitle}>{t('Cómo funciona')}</h2>
            <ol className={styles.steps}>
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span aria-hidden>{index + 1}</span>
                  <div>
                    <h3>{t(step.title)}</h3>
                    <p>{t(step.text)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="tecnologia" className={`${styles.container} ${styles.section}`}>
            <p className={styles.eyebrow}>{t('Bajo el capó')}</p>
            <h2 className={styles.sectionTitle}>{t('Decisiones técnicas')}</h2>
            <div className={styles.grid}>
              {ENGINEERING.map(({ icon: Icon, title, text }) => (
                <div key={title} className={styles.card}>
                  <Icon size={20} aria-hidden />
                  <h3>{t(title)}</h3>
                  <p>{t(text)}</p>
                </div>
              ))}
            </div>
            <ul className={styles.stack} aria-label={t('Tecnologías')}>
              {STACK.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </section>

          <section className={`${styles.container} ${styles.cta}`}>
            <h2>{t('¿Quieres verlo por dentro?')}</h2>
            <p>{t('El código, la arquitectura y las pruebas están en GitHub. El acceso al panel es por invitación.')}</p>
            <div className={styles.ctas}>
              <a href={REPO_URL} className={styles.button} target="_blank" rel="noopener noreferrer">
                <Code2 size={16} aria-hidden /> {t('Ver el código')}
              </a>
              <Link href="/login" className={styles.buttonGhost}>{t('Ya tengo acceso')}</Link>
            </div>
          </section>
        </main>

        <footer className={`${styles.container} ${styles.footer}`}>
          <span>© {new Date().getFullYear()} {env.appName}</span>
          <nav aria-label={t('Enlaces')}>
            <Link href="/demo">{t('Demo')}</Link>
            <Link href="/demo/pdf" target="_blank">{t('PDF de ejemplo')}</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
        </footer>
      </div>
    </AppI18n>
  );
}
