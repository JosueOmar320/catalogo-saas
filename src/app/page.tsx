import { ArrowRight, FileDown, MessageCircle, Palette, Search, Smartphone, Zap } from 'lucide-react';
import Link from 'next/link';
import { SiteView } from '@/site-renderer';
import { appFont } from '@/components/providers/app-font';
import { buildSampleSite } from '@/lib/site/sample-site';
import { env } from '@/lib/env';
import styles from './landing.module.css';

const FEATURES = [
  { icon: Zap, title: 'Tu sitio en minutos', text: 'Páginas, secciones y catálogo listos para editar. Sin código ni diseñadores.' },
  { icon: Palette, title: 'Tu marca, tu estilo', text: '10 temas, fondos con imagen o patrón, navbar, tarjetas y botones con vista previa en vivo.' },
  { icon: MessageCircle, title: 'Ventas por WhatsApp', text: 'Cada producto tiene un botón que abre un chat con el mensaje listo.' },
  { icon: Smartphone, title: 'Perfecto en el celular', text: 'Rápido, con búsqueda y navegación por categorías pensadas para móvil.' },
  { icon: FileDown, title: 'Catálogo en PDF', text: '6 plantillas con tu logo, colores, tipografía y fondo. Listo para imprimir o enviar.' },
  { icon: Search, title: 'Encontrable en Google', text: 'SEO, Open Graph y una URL propia para cada producto.' },
];

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Gratis, con tu email.' },
  { title: 'Agrega productos y servicios', text: 'Fotos, precios, categorías.' },
  { title: 'Publica y comparte', text: 'Un enlace para WhatsApp, redes y tu bio.' },
];

export default function Home() {
  return (
    <div className={`${appFont.variable} ${styles.page}`}>
      <header className={styles.nav}>
        <div className={styles.container}>
          <span className={styles.logo}>{env.appName}</span>
          <nav className={styles.navLinks}>
            <Link href="/demo">Ver demo</Link>
            <Link href="/login" className={styles.buttonSmall}>Iniciar sesión</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={`${styles.container} ${styles.hero}`}>
          <p className={styles.eyebrow}>Catálogos digitales para pequeños negocios</p>
          <h1 className={styles.title}>Tu catálogo profesional, listo para compartir hoy</h1>
          <p className={styles.lead}>
            Publica tus productos y servicios con tu marca, recibe consultas por WhatsApp y descarga un PDF para imprimir. Todo sin escribir código.
          </p>
          <div className={styles.ctas}>
            <Link href="/login" className={styles.button}>
              Iniciar sesión <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/demo" className={styles.buttonGhost}>Ver un ejemplo</Link>
          </div>
        </section>

        <section className={styles.container} aria-label="Ejemplo de catálogo">
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

        <section className={`${styles.container} ${styles.section}`}>
          <h2 className={styles.sectionTitle}>Todo lo que necesitas para vender mejor</h2>
          <div className={styles.features}>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className={styles.feature}>
                <Icon size={20} aria-hidden />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.container} ${styles.section}`}>
          <h2 className={styles.sectionTitle}>Tres pasos</h2>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span>{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.container} ${styles.cta}`}>
          <h2>¿Quieres tu catálogo?</h2>
          <p>El acceso es por invitación. Pide tu cuenta al administrador y te la entregamos lista para usar.</p>
          <Link href="/login" className={styles.button}>
            Ya tengo acceso <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className={`${styles.container} ${styles.footer}`}>
        <span>© {new Date().getFullYear()} {env.appName}</span>
        <Link href="/demo/pdf" target="_blank">PDF de ejemplo</Link>
      </footer>
    </div>
  );
}
