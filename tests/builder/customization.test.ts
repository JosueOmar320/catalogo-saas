import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSampleSite } from '@/lib/site/sample-site';
import { flattenNavigation, navigationSchema, resolveNavigation, type NavigationItem } from '@/lib/site/navigation';
import { headerOverlaysPage } from '@/lib/site/resolve';
import { createSection, parseSections, sectionSchema } from '@/lib/site/section-schemas';
import { pageFromRow } from '@/lib/site/pages';
import { themeSchema } from '@/lib/design/theme';
import { buildHeaderProps, footerColumns } from '@/site-renderer/chrome';
import { linkContext } from '@/site-renderer/env';

const site = buildSampleSite();
const env = { mode: 'public', basePath: '/catalogo/demo', currentPageId: null } as const;
const [home, menu, events, about] = site.pages;
const item = (patch: Partial<NavigationItem>): NavigationItem => ({ id: crypto.randomUUID(), kind: 'page', pageId: '', label: '', url: '', visible: true, style: 'link', newTab: false, parentId: '', ...patch });

describe('Estilo de sección: animación, px, tablet', () => {
  it('las secciones guardadas antes reciben los valores nuevos por defecto', () => {
    const [section] = parseSections([{ id: 's1', type: 'text', visible: true, content: {}, style: { paddingTop: 'lg' } }]);
    assert.equal(section.style.paddingTop, 'lg');
    assert.equal(section.style.animation, 'none');
    assert.equal(section.style.paddingTopPx, 64);
    assert.deepEqual(section.style.tablet, { paddingTop: 'inherit', paddingBottom: 'inherit', textAlign: 'inherit' });
    assert.equal(section.style.hideOnTablet, false);
  });

  it('relleno exacto en px dentro de un rango', () => {
    const base = createSection('text');
    const ok = sectionSchema.safeParse({ ...base, style: { ...base.style, paddingTop: 'custom', paddingTopPx: 140, animation: 'up' } });
    assert.ok(ok.success);
    assert.ok(!sectionSchema.safeParse({ ...base, style: { ...base.style, paddingTopPx: 900 } }).success);
    assert.ok(!sectionSchema.safeParse({ ...base, style: { ...base.style, animation: 'spin' } }).success);
  });
});

describe('Submenús', () => {
  const links = linkContext(site, env);

  it('los hijos van dentro de su padre (página o grupo), siempre como enlaces y en el orden de la lista', () => {
    const group = item({ kind: 'group', label: 'Conócenos' });
    const nav = navigationSchema.parse({
      items: [
        item({ pageId: home.id }),
        item({ pageId: menu.id, id: 'menu' }),
        item({ pageId: events.id, parentId: 'menu', style: 'button' }),
        group,
        item({ pageId: about.id, parentId: group.id }),
        item({ kind: 'url', url: 'https://ejemplo.com', label: 'Blog', parentId: group.id }),
      ],
    });
    const resolved = resolveNavigation(nav, site.pages, links);
    assert.deepEqual(resolved.map((i) => [i.label, i.children.map((c) => c.label)]), [
      [home.title, []],
      [menu.title, [events.title]],
      ['Conócenos', [about.title, 'Blog']],
    ]);
    assert.equal(resolved[1].children[0].style, 'link');
    assert.equal(resolved[2].href, '');
    // En el pie de página: todo plano y sin los grupos (no tienen enlace).
    assert.deepEqual(flattenNavigation(resolved).map((i) => i.label), [home.title, menu.title, events.title, about.title, 'Blog']);
  });

  it('padre oculto oculta su submenú; un grupo vacío no se muestra; sin padre válido queda en el primer nivel', () => {
    const nav = navigationSchema.parse({
      items: [
        item({ pageId: menu.id, id: 'menu', visible: false }),
        item({ pageId: events.id, parentId: 'menu' }),
        item({ kind: 'group', label: 'Vacío', id: 'g' }),
        item({ pageId: about.id, parentId: 'no-existe', id: 'about' }),
        // Un submenú no tiene submenús: el nieto sube al primer nivel.
        item({ pageId: home.id, parentId: 'about' }),
      ],
    });
    assert.deepEqual(resolveNavigation(nav, site.pages, links).map((i) => i.label), [about.title, home.title]);
  });

  it('el grupo sin texto usa "Más" en el idioma del sitio', () => {
    const nav = navigationSchema.parse({ items: [item({ kind: 'group', id: 'g' }), item({ pageId: about.id, parentId: 'g' })] });
    assert.equal(resolveNavigation(nav, site.pages, links)[0].label, 'Más');
  });
});

describe('Header y pie de página por página', () => {
  const hero = [{ visible: true, type: 'hero' }];
  const text = [{ visible: true, type: 'text' }];

  it('auto: sólo el estilo transparente sobre un hero; overlay y solid lo fuerzan', () => {
    const transparent = { ...site.theme, header: { ...site.theme.header, style: 'transparent' as const } };
    assert.equal(headerOverlaysPage(transparent, hero), true);
    assert.equal(headerOverlaysPage(transparent, text), false);
    assert.equal(headerOverlaysPage(transparent, hero, 'solid'), false);
    assert.equal(headerOverlaysPage(transparent, hero, 'hidden'), false);
    assert.equal(headerOverlaysPage(site.theme, text, 'overlay'), true);
    assert.equal(headerOverlaysPage(site.theme, [], 'overlay'), false);
  });

  it('las páginas guardadas antes muestran header y pie; las rutas ocultas se calculan una vez', () => {
    const old = pageFromRow({ id: about.id, title: 'A', slug: 'a', template: 'custom', is_home: false, is_published: true, sections: [], style: {}, seo: {} });
    assert.equal(old.style.header, 'auto');
    assert.equal(old.style.hideFooter, false);

    const pages = site.pages.map((p) => (p.id === about.id ? { ...p, style: { ...p.style, header: 'hidden' as const, hideFooter: true } } : p));
    const props = buildHeaderProps({ ...site, pages }, env);
    assert.deepEqual(props.headerHiddenPaths, [`/catalogo/demo/${about.slug}`]);
    assert.deepEqual(props.footerHiddenPaths, [`/catalogo/demo/${about.slug}`]);
  });
});

describe('Columnas propias del pie de página', () => {
  it('resuelve los enlaces, usa el título de la página y descarta lo que no se puede mostrar', () => {
    const theme = themeSchema.parse({
      ...site.theme,
      footer: {
        ...site.theme.footer,
        columns: [
          {
            id: 'c1',
            title: 'Ayuda',
            links: [
              { id: 'l1', label: '', link: { kind: 'page', pageId: about.id } },
              { id: 'l2', label: 'Envíos', link: { kind: 'url', url: 'https://ejemplo.com/envios' } },
              { id: 'l3', label: 'Roto', link: { kind: 'url', url: 'javascript:alert(1)' } },
              { id: 'l4', label: 'Nada', link: { kind: 'none' } },
            ],
          },
          { id: 'c2', title: 'Vacía', links: [] },
        ],
      },
    });
    const columns = footerColumns({ ...site, theme }, env);
    assert.deepEqual(
      columns.map((c) => [c.title, c.links.map((l) => [l.label, l.href, l.external])]),
      [['Ayuda', [[about.title, `/catalogo/demo/${about.slug}`, false], ['Envíos', 'https://ejemplo.com/envios', true]]]],
    );
  });

  it('a lo más 4 columnas de 8 enlaces', () => {
    const column = (id: string) => ({ id, title: id, links: [] });
    assert.ok(!themeSchema.safeParse({ ...site.theme, footer: { ...site.theme.footer, columns: ['a', 'b', 'c', 'd', 'e'].map(column) } }).success);
  });
});
