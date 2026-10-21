'use client';

import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ResolvedNavItem } from '@/lib/site/navigation';
import { SocialIcon } from './SocialIcon';
import { SOCIAL_NETWORKS } from '@/lib/social/networks';
import { WelcomePopup } from './WelcomePopup';
import { AnnouncementBar } from './AnnouncementBar';
import { BackgroundLayers } from './Background';
import { pathIn, useSitePath } from './ChromeGate';
import type { HeaderProps } from './chrome';
import { Icon } from './Icon';
import { useSiteT } from './SiteI18n';
import { SiteImage } from './SiteImage';
import styles from './site.module.css';

/**
 * Header del sitio con 7 estilos (data-style), logo a la izquierda o al
 * centro, menú a la izquierda/centro/derecha, sticky, transparente sobre el
 * hero (pasa a sólido con un fundido suave al hacer scroll) y menú móvil.
 */
export function SiteHeader(props: HeaderProps) {
  const { header, brand, items, cta, social, overlayPaths, headerHiddenPaths, homePath } = props;
  const t = useSiteT();
  const current = useSitePath(props.currentPath);
  const overlay = pathIn(overlayPaths, current);
  const hidden = pathIn(headerHiddenPaths, current);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const sentinel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !overlay) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [overlay]);

  // Menú móvil: Escape lo cierra (y devuelve el foco al botón que lo abrió).
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => (href.split('?')[0].replace(/\/$/, '') || '/') === current;
  const centered = header.logoPosition === 'center';
  const customBg = header.background.type !== 'inherit';
  // Con el menú móvil abierto, la barra se ve sólida igual que el panel que despliega.
  const solid = scrolled || open;

  const brandNode = (header.showLogo || header.showName) && (
    <a href={homePath} className={styles.brand} data-page-id={items.find((i) => i.href === homePath)?.pageId}>
      {header.showLogo && (
        <span className={styles.brandLogo}>
          {brand.logoUrl ? <SiteImage src={brand.logoUrl} alt={brand.name} sizes="64px" priority /> : <span className={styles.brandInitial}>{brand.name.charAt(0).toUpperCase()}</span>}
        </span>
      )}
      {header.showName && <span className={styles.brandName}>{brand.name}</span>}
    </a>
  );

  const linkProps = (item: ResolvedNavItem) => ({
    href: item.href,
    'data-page-id': item.pageId ?? undefined,
    target: item.external ? '_blank' : undefined,
    rel: item.external ? 'noopener noreferrer' : undefined,
    onClick: () => setOpen(false),
  });

  // Menú móvil: los submenús se muestran abiertos, con sangría.
  const mobileLinks = () =>
    items.map((item) =>
      item.children.length === 0 ? (
        <a key={item.id} {...linkProps(item)} className={item.style === 'button' ? styles.btn : styles.navLink} data-variant={item.style === 'button' ? 'solid' : undefined} aria-current={isActive(item.href) ? 'page' : undefined}>
          {item.label}
        </a>
      ) : (
        <div key={item.id} className={styles.mobileGroup}>
          {item.href ? <a {...linkProps(item)} className={styles.navLink} aria-current={isActive(item.href) ? 'page' : undefined}>{item.label}</a> : <span className={styles.mobileGroupLabel}>{item.label}</span>}
          {item.children.map((child) => (
            <a key={child.id} {...linkProps(child)} className={`${styles.navLink} ${styles.mobileSubLink}`} aria-current={isActive(child.href) ? 'page' : undefined}>
              {child.label}
            </a>
          ))}
        </div>
      ),
    );

  const navLinks = (className = styles.navLink) =>
    items.map((item) =>
      item.children.length > 0 ? (
        <NavDropdown key={item.id} item={item} className={className} isActive={isActive} linkProps={linkProps} />
      ) : item.style === 'button' ? (
        <a key={item.id} href={item.href} className={`${styles.btn} ${styles.btnSmall}`} data-variant="solid" data-page-id={item.pageId ?? undefined} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} onClick={() => setOpen(false)}>
          {item.label}
        </a>
      ) : (
        <a key={item.id} href={item.href} className={className} aria-current={isActive(item.href) ? 'page' : undefined} data-page-id={item.pageId ?? undefined} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} onClick={() => setOpen(false)}>
          {item.label}
        </a>
      ),
    );

  const socialNode = social.length > 0 && (
    <div className={styles.headerSocial}>
      {social.slice(0, 4).map((link) => (
        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.iconButton} aria-label={SOCIAL_NETWORKS[link.network].label}>
          <SocialIcon network={link.network} size={16} />
        </a>
      ))}
    </div>
  );

  const ctaNode = cta && (
    <a href={cta.href} className={`${styles.btn} ${styles.btnSmall} ${styles.headerCta}`} data-variant="solid" data-page-id={cta.pageId} target={cta.external ? '_blank' : undefined} rel={cta.external ? 'noopener noreferrer' : undefined}>
      {header.cta === 'whatsapp' && <Icon id="message-circle" size={15} />}
      {cta.label}
    </a>
  );

  const toggle = items.length > 0 && (
    <button ref={toggleRef} type="button" className={styles.menuToggle} aria-expanded={open} aria-controls={menuId} aria-label={open ? t('Cerrar menú') : t('Abrir menú')} onClick={() => setOpen((o) => !o)}>
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
  );

  return (
    <>
      {props.announcement && <AnnouncementBar {...props.announcement} />}
      {props.popup && <WelcomePopup {...props.popup} />}
      {!hidden && <span ref={sentinel} className={styles.headerSentinel} aria-hidden />}
      {!hidden && (
        <header
          className={`${styles.header} ${centered ? styles.headerTwoRows : ''}`}
          data-style={header.style}
          data-sticky={header.sticky}
          data-overlay={overlay}
          data-scrolled={solid}
          data-custom-bg={customBg}
        >
          <div className={styles.headerInner}>
            <div className={styles.headerSurface}>{customBg && <BackgroundLayers background={header.background} />}</div>
            <div className={styles.container}>
              {centered ? (
                <div className={styles.headerBar}>
                  <div className={styles.headerLeft}>
                    {toggle}
                    {socialNode}
                  </div>
                  {brandNode}
                  <div className={styles.headerActions}>{ctaNode}</div>
                </div>
              ) : (
                <div className={styles.headerBar}>
                  {brandNode}
                  {header.menuPosition === 'left' && <nav className={`${styles.nav} ${styles.navLeft}`} aria-label={t('Principal')}>{navLinks()}</nav>}
                  <span className={styles.headerSpacer} />
                  {header.menuPosition === 'center' && <nav className={`${styles.nav} ${styles.navCenter}`} aria-label={t('Principal')}>{navLinks()}</nav>}
                  {header.menuPosition === 'right' && <nav className={styles.nav} aria-label={t('Principal')}>{navLinks()}</nav>}
                  <div className={styles.headerActions}>
                    {socialNode}
                    {ctaNode}
                    {toggle}
                  </div>
                </div>
              )}
              {centered && items.length > 0 && (
                <nav className={styles.headerNavRow} aria-label={t('Principal')}>
                  <div className={styles.nav}>{navLinks()}</div>
                </nav>
              )}
            </div>
            {open && (
              <nav id={menuId} className={styles.mobilePanel} aria-label={t('Menú móvil')}>
                {mobileLinks()}
                {cta && (
                  <a href={cta.href} className={styles.btn} data-variant="solid" target={cta.external ? '_blank' : undefined} rel="noopener noreferrer">
                    {cta.label}
                  </a>
                )}
              </nav>
            )}
          </div>
        </header>
      )}
    </>
  );
}

type LinkProps = (item: ResolvedNavItem) => { href: string; target?: string; rel?: string; onClick: () => void };

/**
 * Submenú del header (escritorio): botón con aria-expanded que abre la
 * lista; con mouse también se abre al pasar por encima. Escape o sacar el
 * foco lo cierran. Si el ítem es una página, su texto sigue siendo enlace.
 */
function NavDropdown({ item, className, isActive, linkProps }: { item: ResolvedNavItem; className: string; isActive: (href: string) => boolean; linkProps: LinkProps }) {
  const t = useSiteT();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  // Abierto al pasar el mouse: el clic que sigue no debe cerrarlo.
  const openedByHover = useRef(false);
  const current = item.children.some((child) => isActive(child.href));
  const close = () => setOpen(false);

  return (
    <div
      ref={root}
      className={styles.navGroup}
      data-open={open || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse' || open) return;
        openedByHover.current = true;
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        openedByHover.current = false;
        close();
      }}
      onBlur={(event) => !root.current?.contains(event.relatedTarget as Node | null) && close()}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        close();
        toggle.current?.focus();
      }}
    >
      {item.href && (
        <a {...linkProps(item)} className={className} aria-current={isActive(item.href) ? 'page' : undefined}>
          {item.label}
        </a>
      )}
      <button
        ref={toggle}
        type="button"
        className={`${className} ${styles.navGroupToggle}`}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={item.href ? t('Más opciones de {label}', { label: item.label }) : undefined}
        data-current={current || undefined}
        onClick={() => {
          const keepOpen = openedByHover.current;
          openedByHover.current = false;
          setOpen((o) => keepOpen || !o);
        }}
      >
        {!item.href && item.label}
        <ChevronDown size={14} aria-hidden />
      </button>
      <ul id={listId} className={styles.navDropdown} hidden={!open}>
        {item.children.map((child) => {
          const props = linkProps(child);
          return (
            <li key={child.id}>
              <a
                {...props}
                onClick={() => {
                  close();
                  props.onClick();
                }}
                className={styles.navDropdownLink}
                aria-current={isActive(child.href) ? 'page' : undefined}
              >
                {child.label}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
