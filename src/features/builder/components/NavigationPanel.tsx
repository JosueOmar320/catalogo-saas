'use client';

import { Box, Button, ButtonBase, IconButton, Stack, Switch, Tooltip, Typography } from '@mui/material';
import { ExternalLink, FileText, Mail, MessageCircle, Phone, Plus, Trash2 } from 'lucide-react';
import { SortableList } from '@/components/ui/SortableList';
import { FOOTER_STYLE_META, FOOTER_STYLES, HEADER_STYLE_META, HEADER_STYLES } from '@/lib/design/styles-registry';
import type { ThemeConfig } from '@/lib/design/theme';
import type { NavigationItem } from '@/lib/site/navigation';
import { useBuilder } from '../state';
import { Advanced, BackgroundEditor, Group, Segmented, SelectInput, SwitchRow, TextInput } from './controls';

const KIND_ICON = { page: FileText, url: ExternalLink, whatsapp: MessageCircle, phone: Phone, email: Mail } as const;
const KIND_LABEL = { page: 'Página', url: 'Enlace', whatsapp: 'WhatsApp', phone: 'Llamar', email: 'Email' } as const;

/** Menú (ítems ordenables), header (7 estilos) y footer. */
export function NavigationPanel() {
  const { state, dispatch } = useBuilder();
  const items = state.navigation.items;
  const setItems = (next: NavigationItem[]) => dispatch({ type: 'setNavigation', navigation: { items: next } });
  const updateItem = (id: string, patch: Partial<NavigationItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const theme = state.theme;
  const setHeader = (patch: Partial<ThemeConfig['header']>) => dispatch({ type: 'setTheme', theme: { ...theme, header: { ...theme.header, ...patch } } });
  const setFooter = (patch: Partial<ThemeConfig['footer']>) => dispatch({ type: 'setTheme', theme: { ...theme, footer: { ...theme.footer, ...patch } } });
  const pagesNotInMenu = state.pages.filter((p) => !items.some((i) => i.kind === 'page' && i.pageId === p.id));
  const addItem = (kind: NavigationItem['kind'], pageId = '') =>
    setItems([...items, { id: crypto.randomUUID(), kind, pageId, label: '', url: kind === 'url' ? 'https://' : '', visible: true, style: kind === 'whatsapp' ? 'button' : 'link', newTab: kind === 'url' }]);

  return (
    <Box>
      <Group title="Menú" description="Arrastra para ordenar. Puedes ocultar páginas, renombrarlas y agregar enlaces o botones.">
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>El menú está vacío.</Typography>
          ) : (
            <SortableList
              items={items}
              getId={(i) => i.id}
              onReorder={setItems}
              renderItem={(item) => {
                const Icon = KIND_ICON[item.kind];
                const page = state.pages.find((p) => p.id === item.pageId);
                const missing = item.kind === 'page' && !page;
                return (
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ color: 'text.secondary', display: 'flex' }}><Icon size={15} /></Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, color: item.visible ? 'text.primary' : 'text.disabled' }} noWrap>
                        {item.label || page?.title || KIND_LABEL[item.kind]}
                        {missing && ' (página eliminada)'}
                      </Typography>
                      <Tooltip title={item.visible ? 'Visible' : 'Oculto'}>
                        <Switch size="small" checked={item.visible} onChange={(e) => updateItem(item.id, { visible: e.target.checked })} slotProps={{ input: { 'aria-label': 'Visible' } }} />
                      </Tooltip>
                      <IconButton size="small" onClick={() => setItems(items.filter((i) => i.id !== item.id))} aria-label="Quitar del menú"><Trash2 size={14} /></IconButton>
                    </Stack>
                    <TextInput label="Texto" value={item.label} placeholder={page?.title ?? KIND_LABEL[item.kind]} onChange={(label) => updateItem(item.id, { label })} maxLength={40} />
                    {item.kind === 'url' && <TextInput label="URL" value={item.url} onChange={(url) => updateItem(item.id, { url })} />}
                    <Segmented label="Estilo" value={item.style} onChange={(style) => updateItem(item.id, { style })} options={[{ value: 'link', label: 'Enlace' }, { value: 'button', label: 'Botón' }]} />
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
          <Button size="small" variant="outlined" color="inherit" startIcon={<ExternalLink size={13} />} onClick={() => addItem('url')}>Enlace externo</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<MessageCircle size={13} />} onClick={() => addItem('whatsapp')}>WhatsApp</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<Phone size={13} />} onClick={() => addItem('phone')}>Llamar</Button>
        </Stack>
      </Group>

      <Group title="Estilo del header">
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {HEADER_STYLES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => setHeader({ style: id, ...(id === 'centered' || id === 'elegant' ? { logoPosition: 'center' as const } : {}) })}
              aria-pressed={theme.header.style === id}
              sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 1.5, border: 1, borderColor: theme.header.style === id ? 'primary.main' : 'divider', boxShadow: theme.header.style === id ? (t) => `0 0 0 1px ${t.palette.primary.main}` : 'none' }}
            >
              <HeaderSketch id={id} />
              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75 }}>{HEADER_STYLE_META[id].label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{HEADER_STYLE_META[id].description}</Typography>
            </ButtonBase>
          ))}
        </Box>
        <Segmented label="Logo" value={theme.header.logoPosition} onChange={(logoPosition) => setHeader({ logoPosition })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
        {theme.header.logoPosition === 'left' && (
          <Segmented label="Menú" value={theme.header.menuPosition} onChange={(menuPosition) => setHeader({ menuPosition })} options={[{ value: 'left', label: 'Izq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Der.' }]} />
        )}
        <Segmented label="Altura" value={theme.header.height} onChange={(height) => setHeader({ height })} options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'tall', label: 'Alto' }]} />
        <SwitchRow label="Fijo al hacer scroll" checked={theme.header.sticky} onChange={(sticky) => setHeader({ sticky })} />
        <SwitchRow label="Logo" checked={theme.header.showLogo} onChange={(showLogo) => setHeader({ showLogo })} />
        <SwitchRow label="Nombre del negocio" checked={theme.header.showName} onChange={(showName) => setHeader({ showName })} />
        <SwitchRow label="Redes sociales" checked={theme.header.showSocial} onChange={(showSocial) => setHeader({ showSocial })} />
        <SelectInput label="Botón destacado" value={theme.header.cta} onChange={(cta) => setHeader({ cta })} options={[{ value: 'none', label: 'Sin botón' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'contact', label: 'Ir a Contacto' }]} />
        {theme.header.cta !== 'none' && <TextInput label="Texto del botón" value={theme.header.ctaLabel} onChange={(ctaLabel) => setHeader({ ctaLabel })} maxLength={30} />}
        <Advanced title="Fondo del header (color, degradado o imagen)">
          <BackgroundEditor value={theme.header.background} onChange={(background) => setHeader({ background })} inheritLabel="Según estilo" />
        </Advanced>
      </Group>

      <Group title="Pie de página">
        <Segmented label="Estilo" value={theme.footer.style} onChange={(style) => setFooter({ style })} options={FOOTER_STYLES.map((id) => ({ value: id, label: FOOTER_STYLE_META[id].label }))} />
        <SwitchRow label="Enlaces a páginas" checked={theme.footer.showNav} onChange={(showNav) => setFooter({ showNav })} />
        <SwitchRow label="Contacto" checked={theme.footer.showContact} onChange={(showContact) => setFooter({ showContact })} />
        <SwitchRow label="Horarios" checked={theme.footer.showHours} onChange={(showHours) => setFooter({ showHours })} />
        <SwitchRow label="Redes sociales" checked={theme.footer.showSocial} onChange={(showSocial) => setFooter({ showSocial })} />
        <TextInput label="Texto personalizado" value={theme.footer.customText} placeholder="Vacío = slogan del negocio" onChange={(customText) => setFooter({ customText })} multiline rows={2} maxLength={500} />
        <Advanced title="Fondo del pie de página">
          <BackgroundEditor value={theme.footer.background} onChange={(background) => setFooter({ background })} inheritLabel="Según estilo" />
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
