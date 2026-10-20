'use client';

import { Box, Button, ButtonBase, IconButton, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { ChevronDown, ExternalLink, FileText, Mail, MessageCircle, Phone, Plus, Trash2 } from 'lucide-react';
import { SortableList } from '@/components/ui/SortableList';
import { FOOTER_STYLE_META, FOOTER_STYLES, HEADER_STYLE_META, HEADER_STYLES } from '@/lib/design/styles-registry';
import type { ThemeConfig } from '@/lib/design/theme';
import { navParent, type NavigationItem } from '@/lib/site/navigation';
import { useBuilder } from '../state';
import { Advanced, BackgroundEditor, Group, LinkEditor, ListEditor, Segmented, SelectInput, SwitchRow, TextInput } from './controls';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';

const KIND_ICON = { page: FileText, url: ExternalLink, whatsapp: MessageCircle, phone: Phone, email: Mail, group: ChevronDown } as const;
const KIND_LABEL = { page: msg('Página'), url: msg('Enlace'), whatsapp: 'WhatsApp', phone: msg('Llamar'), email: msg('Email'), group: msg('Submenú') } as const;

/** Menú (ítems ordenables), header (7 estilos) y footer. */
export function NavigationPanel() {
  const t = useT();
  const { state, dispatch } = useBuilder();
  const items = state.navigation.items;
  const setItems = (next: NavigationItem[]) => dispatch({ type: 'setNavigation', navigation: { items: next } });
  const updateItem = (id: string, patch: Partial<NavigationItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const theme = state.theme;
  const setHeader = (patch: Partial<ThemeConfig['header']>) => dispatch({ type: 'setTheme', theme: { ...theme, header: { ...theme.header, ...patch } } });
  const setFooter = (patch: Partial<ThemeConfig['footer']>) => dispatch({ type: 'setTheme', theme: { ...theme, footer: { ...theme.footer, ...patch } } });
  const bar = theme.announcement;
  const setBar = (patch: Partial<ThemeConfig['announcement']>) => dispatch({ type: 'setTheme', theme: { ...theme, announcement: { ...bar, ...patch } } });
  const popup = theme.popup;
  const setPopup = (patch: Partial<ThemeConfig['popup']>) => dispatch({ type: 'setTheme', theme: { ...theme, popup: { ...popup, ...patch } } });
  const pagesNotInMenu = state.pages.filter((p) => !items.some((i) => i.kind === 'page' && i.pageId === p.id));
  const addItem = (kind: NavigationItem['kind'], pageId = '') =>
    setItems([...items, { id: crypto.randomUUID(), kind, pageId, label: kind === 'group' ? t('Más') : '', url: kind === 'url' ? 'https://' : '', visible: true, style: kind === 'whatsapp' ? 'button' : 'link', newTab: kind === 'url', parentId: '' }]);
  // Quitar un ítem con submenú deja a sus hijos en el primer nivel.
  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id).map((i) => (i.parentId === id ? { ...i, parentId: '' } : i)));
  const hasChildren = (id: string) => items.some((i) => navParent(i, items)?.id === id);
  // Posibles padres: ítems de primer nivel que no son botones.
  const parentOptions = (item: NavigationItem) => items.filter((i) => i.id !== item.id && !navParent(i, items) && i.style === 'link');
  /** Mueve el ítem al final del submenú elegido (o lo deja donde está si vuelve al primer nivel). */
  const setParent = (item: NavigationItem, parentId: string) => {
    const moved = { ...item, parentId, style: parentId ? ('link' as const) : item.style };
    if (!parentId) return setItems(items.map((i) => (i.id === item.id ? moved : i)));
    const rest = items.filter((i) => i.id !== item.id);
    const lastIndex = rest.reduce((last, i, index) => (i.id === parentId || i.parentId === parentId ? index : last), -1);
    setItems([...rest.slice(0, lastIndex + 1), moved, ...rest.slice(lastIndex + 1)]);
  };

  return (
    <Box>
      <Group title={t('Menú')} description={t('Arrastra para ordenar. Puedes ocultar páginas, renombrarlas, agregar enlaces o botones y agruparlos en submenús.')}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{t('El menú está vacío.')}</Typography>
          ) : (
            <SortableList
              items={items}
              getId={(i) => i.id}
              onReorder={setItems}
              renderItem={(item) => {
                const Icon = KIND_ICON[item.kind];
                const page = state.pages.find((p) => p.id === item.pageId);
                const missing = item.kind === 'page' && !page;
                const parent = navParent(item, items);
                const parents = parentOptions(item);
                return (
                  <Stack spacing={0.75} sx={parent ? { pl: 2, borderLeft: 2, borderColor: 'divider' } : undefined} role="group" aria-label={item.label || page?.title || t(KIND_LABEL[item.kind])}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ color: 'text.secondary', display: 'flex' }}><Icon size={15} /></Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, color: item.visible ? 'text.primary' : 'text.disabled' }} noWrap>
                        {item.label || page?.title || t(KIND_LABEL[item.kind])}
                        {missing && ` ${t('(página eliminada)')}`}
                      </Typography>
                      <Tooltip title={item.visible ? t('Visible') : t('Oculto')}>
                        <Switch size="small" checked={item.visible} onChange={(e) => updateItem(item.id, { visible: e.target.checked })} slotProps={{ input: { 'aria-label': 'Visible' } }} />
                      </Tooltip>
                      <IconButton size="small" onClick={() => removeItem(item.id)} aria-label={t('Quitar del menú')}><Trash2 size={14} /></IconButton>
                    </Stack>
                    <TextInput label={t('Texto')} value={item.label} placeholder={page?.title ?? t(KIND_LABEL[item.kind])} onChange={(label) => updateItem(item.id, { label })} maxLength={40} />
                    {item.kind === 'url' && <TextInput label="URL" value={item.url} onChange={(url) => updateItem(item.id, { url })} />}
                    {item.kind === 'group' ? (
                      !hasChildren(item.id) && <Typography variant="caption" color="text.secondary">{t('Elige «Dentro de: {label}» en otros ítems para llenarlo. Vacío no se muestra.', { label: item.label || t('Más') })}</Typography>
                    ) : (
                      <>
                        {!parent && <Segmented label={t('Estilo')} value={item.style} onChange={(style) => updateItem(item.id, { style })} options={[{ value: 'link', label: t('Enlace') }, { value: 'button', label: t('Botón') }]} />}
                        {!hasChildren(item.id) && (parent || parents.length > 0) && (
                          <SelectInput
                            label={t('Dentro de')}
                            value={parent?.id ?? ''}
                            onChange={(parentId) => setParent(item, parentId)}
                            options={[{ value: '', label: t('Menú principal') }, ...parents.map((p) => ({ value: p.id, label: p.label || state.pages.find((x) => x.id === p.pageId)?.title || t(KIND_LABEL[p.kind]) }))]}
                          />
                        )}
                      </>
                    )}
                  </Stack>
                );
              }}
            />
          )}
        </Box>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {pagesNotInMenu.map((p) => (
            <Button key={p.id} size="small" variant="outlined" color="inherit" startIcon={<Plus size={13} />} onClick={() => addItem('page', p.id)}>{p.title}</Button>
          ))}
          <Button size="small" variant="outlined" color="inherit" startIcon={<ExternalLink size={13} />} onClick={() => addItem('url')}>{t('Enlace externo')}</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<MessageCircle size={13} />} onClick={() => addItem('whatsapp')}>WhatsApp</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<Phone size={13} />} onClick={() => addItem('phone')}>{t('Llamar')}</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<ChevronDown size={13} />} onClick={() => addItem('group')}>{t('Submenú')}</Button>
        </Stack>
      </Group>

      <Group title={t('Estilo del header')}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {HEADER_STYLES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => setHeader({ style: id, ...(id === 'centered' || id === 'elegant' ? { logoPosition: 'center' as const } : {}) })}
              aria-pressed={theme.header.style === id}
              sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 1.5, border: 1, borderColor: theme.header.style === id ? 'primary.main' : 'divider', boxShadow: theme.header.style === id ? (th) => `0 0 0 1px ${th.palette.primary.main}` : 'none' }}
            >
              <HeaderSketch id={id} />
              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75 }}>{t(HEADER_STYLE_META[id].label)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{t(HEADER_STYLE_META[id].description)}</Typography>
            </ButtonBase>
          ))}
        </Box>
        <Segmented label={t('Logo')} value={theme.header.logoPosition} onChange={(logoPosition) => setHeader({ logoPosition })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
        {theme.header.logoPosition === 'left' && (
          <Segmented label={t('Menú')} value={theme.header.menuPosition} onChange={(menuPosition) => setHeader({ menuPosition })} options={[{ value: 'left', label: t('Izq.') }, { value: 'center', label: t('Centro') }, { value: 'right', label: t('Der.') }]} />
        )}
        <Segmented label={t('Altura')} value={theme.header.height} onChange={(height) => setHeader({ height })} options={[{ value: 'compact', label: t('Compacto') }, { value: 'normal', label: t('Normal') }, { value: 'tall', label: t('Alto') }]} />
        <SwitchRow label={t('Fijo al hacer scroll')} checked={theme.header.sticky} onChange={(sticky) => setHeader({ sticky })} />
        <SwitchRow label={t('Logo')} checked={theme.header.showLogo} onChange={(showLogo) => setHeader({ showLogo })} />
        <SwitchRow label={t('Nombre del negocio')} checked={theme.header.showName} onChange={(showName) => setHeader({ showName })} />
        <SwitchRow label={t('Redes sociales')} checked={theme.header.showSocial} onChange={(showSocial) => setHeader({ showSocial })} />
        <SelectInput label={t('Botón destacado')} value={theme.header.cta} onChange={(cta) => setHeader({ cta })} options={[{ value: 'none', label: t('Sin botón') }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'contact', label: t('Ir a Contacto') }]} />
        {theme.header.cta !== 'none' && <TextInput label={t('Texto del botón')} value={theme.header.ctaLabel} onChange={(ctaLabel) => setHeader({ ctaLabel })} maxLength={30} />}
        <Advanced title={t('Fondo del header (color, degradado o imagen)')}>
          <BackgroundEditor value={theme.header.background} onChange={(background) => setHeader({ background })} inheritLabel={t('Según estilo')} />
        </Advanced>
      </Group>

      <Group title={t('Barra de anuncios')}>
        <SwitchRow label={t('Mostrar arriba del sitio')} checked={bar.enabled} onChange={(enabled) => setBar({ enabled })} />
        {bar.enabled && (
          <>
            <TextInput label={t('Texto')} value={bar.text} placeholder={t('Envío gratis en pedidos desde $300')} onChange={(text) => setBar({ text })} maxLength={160} />
            <LinkEditor value={bar.link} onChange={(link) => setBar({ link })} pages={state.pages} />
            {bar.link.kind !== 'none' && (
              <TextInput label={t('Texto del enlace')} value={bar.linkLabel} placeholder={t('Vacío = todo el texto es el enlace')} onChange={(linkLabel) => setBar({ linkLabel })} maxLength={30} />
            )}
            <Segmented
              label={t('Color')}
              value={bar.tone}
              onChange={(tone) => setBar({ tone })}
              options={[
                { value: 'accent', label: t('Acento') },
                { value: 'dark', label: t('Oscuro') },
                { value: 'soft', label: t('Suave') },
              ]}
            />
            <TextField
              type="date"
              label={t('Mostrar hasta (opcional)')}
              value={bar.endsOn}
              // El día se entiende en la zona horaria de quien lo programa.
              onChange={(event) => setBar({ endsOn: event.target.value, timeZone: event.target.value ? Intl.DateTimeFormat().resolvedOptions().timeZone : '' })}
              helperText={t('Después de ese día la barra se oculta sola.')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <SwitchRow label={t('El visitante puede cerrarla')} checked={bar.dismissible} onChange={(dismissible) => setBar({ dismissible })} />
          </>
        )}
      </Group>

      <Group title={t('Ventana de bienvenida')} description={t('Una promoción que cada visitante ve una sola vez, unos segundos después de entrar. No aparece en esta vista previa.')}>
        <SwitchRow label={t('Mostrar a quien entra')} checked={popup.enabled} onChange={(enabled) => setPopup({ enabled })} />
        {popup.enabled && (
          <>
            <TextInput label={t('Título')} value={popup.title} placeholder={t('¡Bienvenido!')} onChange={(title) => setPopup({ title })} maxLength={80} />
            <TextInput label={t('Texto')} value={popup.text} placeholder={t('10 % de descuento en tu primer pedido.')} onChange={(text) => setPopup({ text })} multiline rows={2} maxLength={300} />
            <TextInput label={t('Código de cupón (opcional)')} value={popup.code} placeholder="BIENVENIDA" helper={t('Se muestra con un botón para copiarlo. Créalo en Configuración → Pedidos.')} onChange={(code) => setPopup({ code: code.toUpperCase() })} maxLength={24} />
            <LinkEditor value={popup.link} onChange={(link) => setPopup({ link })} pages={state.pages} />
            {popup.link.kind !== 'none' && <TextInput label={t('Texto del botón')} value={popup.buttonLabel} placeholder={t('Ver más')} onChange={(buttonLabel) => setPopup({ buttonLabel })} maxLength={30} />}
            <Segmented
              label={t('Aparece')}
              value={String(popup.delay)}
              onChange={(delay) => setPopup({ delay: Number(delay) })}
              options={[
                { value: '0', label: t('Al entrar') },
                { value: '3', label: '3 s' },
                { value: '8', label: '8 s' },
                { value: '15', label: '15 s' },
              ]}
            />
            <TextField
              type="date"
              label={t('Mostrar hasta (opcional)')}
              value={popup.endsOn}
              onChange={(event) => setPopup({ endsOn: event.target.value, timeZone: event.target.value ? Intl.DateTimeFormat().resolvedOptions().timeZone : '' })}
              helperText={t('Después de ese día ya no aparece.')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
      </Group>

      <Group title={t('Pie de página')}>
        <Segmented label={t('Estilo')} value={theme.footer.style} onChange={(style) => setFooter({ style })} options={FOOTER_STYLES.map((id) => ({ value: id, label: t(FOOTER_STYLE_META[id].label) }))} />
        <SwitchRow label={t('Enlaces a páginas')} checked={theme.footer.showNav} onChange={(showNav) => setFooter({ showNav })} />
        <SwitchRow label={t('Contacto')} checked={theme.footer.showContact} onChange={(showContact) => setFooter({ showContact })} />
        <SwitchRow label={t('Horarios')} checked={theme.footer.showHours} onChange={(showHours) => setFooter({ showHours })} />
        <SwitchRow label={t('Redes sociales')} checked={theme.footer.showSocial} onChange={(showSocial) => setFooter({ showSocial })} />
        <TextInput label={t('Texto personalizado')} value={theme.footer.customText} placeholder={t('Vacío = slogan del negocio')} onChange={(customText) => setFooter({ customText })} multiline rows={2} maxLength={500} />
        <Advanced title={t('Columnas de enlaces propias')} defaultOpen={theme.footer.columns.length > 0}>
          <Typography variant="caption" color="text.secondary">{t('Por ejemplo «Ayuda» con envíos, devoluciones y preguntas frecuentes.')}</Typography>
          <ListEditor
            items={theme.footer.columns}
            onChange={(columns) => setFooter({ columns })}
            max={4}
            addLabel={t('Agregar columna')}
            itemTitle={(column, index) => column.title || t('Columna {n}', { n: index + 1 })}
            create={() => ({ id: crypto.randomUUID(), title: '', links: [] })}
            renderItem={(column, update) => (
              <>
                <TextInput label={t('Título')} value={column.title} placeholder={t('Ayuda')} onChange={(title) => update({ ...column, title })} maxLength={40} />
                <ListEditor
                  items={column.links}
                  onChange={(links) => update({ ...column, links })}
                  max={8}
                  addLabel={t('Agregar enlace')}
                  itemTitle={(link, index) => link.label || state.pages.find((p) => p.id === link.link.pageId)?.title || t('Enlace {n}', { n: index + 1 })}
                  create={() => ({ id: crypto.randomUUID(), label: '', link: { kind: 'page' as const, pageId: '', url: '', message: '', newTab: false } })}
                  renderItem={(link, updateLink) => (
                    <>
                      <TextInput label={t('Texto')} value={link.label} placeholder={state.pages.find((p) => p.id === link.link.pageId)?.title} onChange={(label) => updateLink({ ...link, label })} maxLength={40} />
                      <LinkEditor value={link.link} onChange={(target) => updateLink({ ...link, link: target })} pages={state.pages} />
                    </>
                  )}
                />
              </>
            )}
          />
        </Advanced>
        <Advanced title={t('Fondo del pie de página')}>
          <BackgroundEditor value={theme.footer.background} onChange={(background) => setFooter({ background })} inheritLabel={t('Según estilo')} />
        </Advanced>
      </Group>
    </Box>
  );
}

/** Esquema mínimo de cada estilo de header. */
function HeaderSketch({ id }: { id: (typeof HEADER_STYLES)[number] }) {
  const dark = id === 'dark' || id === 'transparent';
  const bar = dark ? '#2a2a2a' : '#fff';
  const ink = dark ? '#fff' : '#333';
  const centered = id === 'centered' || id === 'elegant';
  return (
    <Box sx={{ height: 38, borderRadius: 1, bgcolor: id === 'transparent' ? '#6b7280' : '#f3f3f5', p: id === 'modern' ? 0.5 : 0, overflow: 'hidden' }}>
      <Box
        sx={{
          height: id === 'modern' ? 20 : 22,
          bgcolor: id === 'minimal' || id === 'transparent' ? 'transparent' : bar,
          borderRadius: id === 'modern' ? 1 : 0,
          borderBottom: id === 'classic' ? '1px solid #ddd' : id === 'elegant' ? '3px double #ccc' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: centered ? 'center' : 'space-between',
          px: 0.75,
          gap: 0.5,
        }}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: ink }} />
        {!centered && (
          <Stack direction="row" spacing={0.4}>
            {[0, 1, 2].map((i) => <Box key={i} sx={{ width: 10, height: 3, bgcolor: ink, opacity: 0.6 }} />)}
          </Stack>
        )}
      </Box>
      {centered && (
        <Stack direction="row" spacing={0.4} sx={{ justifyContent: 'center', mt: 0.5 }}>
          {[0, 1, 2, 3].map((i) => <Box key={i} sx={{ width: 10, height: 3, bgcolor: '#555', opacity: 0.6 }} />)}
        </Stack>
      )}
    </Box>
  );
}
