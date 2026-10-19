'use client';

import { Alert, Box, Button, ButtonBase, Chip, Grid, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImageField } from '@/components/form/ImageField';
import { setBusinessLogo } from '@/features/business/actions';
import { setCatalogMedia } from '@/features/catalog/actions';
import { contrastRatio, MIN_READABLE_CONTRAST } from '@/lib/design/color';
import { FONT_IDS, FONTS, type FontId } from '@/lib/design/fonts';
import { applyPreset, THEME_PRESETS } from '@/lib/design/presets';
import { BADGE_KEYS, CARD_STYLE_META, CARD_STYLES } from '@/lib/design/styles-registry';
import { TYPE_ROLE_LABELS, TYPE_ROLES, type ThemeConfig, type TypeRole } from '@/lib/design/theme';
import { resolveTokens } from '@/lib/design/tokens';
import { useAction } from '@/lib/hooks/use-action';
import { FONT_FAMILIES } from '@/site-renderer/fonts';
import { useBuilder } from '../state';
import { BackgroundEditor, ColorInput, Group, Segmented, SelectInput, SliderInput, SwitchRow, TextInput } from './controls';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';

type DesignTab = 'theme' | 'colors' | 'type' | 'style' | 'background' | 'cards';

export type IdentityImages = { logoUrl: string | null; coverUrl: string | null; faviconUrl: string | null };

export function DesignPanel({ identity, initialTab = 'theme' }: { identity: IdentityImages; initialTab?: DesignTab }) {
  const t = useT();
  const { state, dispatch } = useBuilder();
  const [tab, setTab] = useState<DesignTab>(initialTab);
  const theme = state.theme;
  const setTheme = (next: ThemeConfig) => dispatch({ type: 'setTheme', theme: next });
  const patch = <K extends keyof ThemeConfig>(key: K, value: Partial<ThemeConfig[K]>) =>
    setTheme({ ...theme, [key]: typeof value === 'object' && !Array.isArray(value) ? { ...(theme[key] as object), ...value } : value });

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider', mt: 1 }}>
        <Tab value="theme" label={t('Tema')} />
        <Tab value="colors" label={t('Colores')} />
        <Tab value="type" label={t('Tipografía')} />
        <Tab value="style" label={t('Estilo')} />
        <Tab value="background" label={t('Fondo')} />
        <Tab value="cards" label={t('Tarjetas')} />
      </Tabs>
      {tab === 'theme' && <ThemeTab theme={theme} setTheme={setTheme} identity={identity} />}
      {tab === 'colors' && <ColorsTab theme={theme} patch={patch} />}
      {tab === 'type' && <TypographyTab theme={theme} patch={patch} />}
      {tab === 'style' && <StyleTab theme={theme} patch={patch} />}
      {tab === 'background' && (
        <Group title={t('Fondo global del sitio')} description={t('Cada página y sección puede sobrescribirlo desde su configuración.')}>
          <BackgroundEditor value={theme.background} onChange={(background) => setTheme({ ...theme, background })} allowInherit={false} />
        </Group>
      )}
      {tab === 'cards' && <CardsTab theme={theme} patch={patch} />}
    </Box>
  );
}

type TabProps = { theme: ThemeConfig; patch: <K extends keyof ThemeConfig>(key: K, value: Partial<ThemeConfig[K]>) => void };

function ThemeTab({ theme, setTheme, identity }: { theme: ThemeConfig; setTheme: (t: ThemeConfig) => void; identity: IdentityImages }) {
  const t = useT();
  const router = useRouter();
  const { run } = useAction();
  const persist = (action: () => ReturnType<typeof setBusinessLogo>) => run(action, { onSuccess: () => router.refresh() }).then(() => undefined);
  return (
    <>
      <Group title={t('Temas')} description={t('Un punto de partida: cambia colores, tipografía, header, tarjetas, botones y fondo. Después puedes ajustar todo.')}>
        <Grid container spacing={1}>
          {THEME_PRESETS.map((preset) => (
            <Grid key={preset.id} size={6}>
              <ButtonBase
                onClick={() => setTheme(applyPreset(theme, preset))}
                aria-pressed={theme.preset === preset.id}
                sx={{ display: 'block', width: '100%', textAlign: 'left', p: 1, borderRadius: 1.5, border: 1, borderColor: theme.preset === preset.id ? 'primary.main' : 'divider', boxShadow: theme.preset === preset.id ? (th) => `0 0 0 1px ${th.palette.primary.main}` : 'none' }}
              >
                <Box sx={{ height: 52, borderRadius: 1, bgcolor: preset.swatch[0], border: 1, borderColor: 'divider', p: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontFamily: FONT_FAMILIES[(preset.theme.typography?.headingFont ?? 'inter') as FontId], color: preset.theme.colors?.heading, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Aa</Typography>
                  <Stack direction="row" spacing={0.5}>
                    {preset.swatch.map((c, i) => (
                      <Box key={i} sx={{ width: 13, height: 13, borderRadius: '50%', bgcolor: c, border: 1, borderColor: 'divider' }} />
                    ))}
                  </Stack>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75 }}>{t(preset.name)}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{t(preset.description)}</Typography>
              </ButtonBase>
            </Grid>
          ))}
        </Grid>
      </Group>
      <Group title={t('Identidad')} description={t('Se guardan al subirlas.')}>
        <ImageField label={t('Logo')} description={t('Cuadrado, PNG con fondo transparente.')} kind="logo" value={identity.logoUrl} onChange={(path) => persist(() => setBusinessLogo(path))} width={64} />
        <ImageField label={t('Imagen principal')} description={t('Se usa al compartir el sitio y como portada del PDF.')} kind="cover" value={identity.coverUrl} onChange={(path) => persist(() => setCatalogMedia({ field: 'cover_path', path }))} width={120} aspectRatio="16 / 9" />
        <ImageField label={t('Favicon')} description={t('Ícono de la pestaña del navegador.')} kind="favicon" value={identity.faviconUrl} onChange={(path) => persist(() => setCatalogMedia({ field: 'favicon_path', path }))} width={44} />
      </Group>
    </>
  );
}

const COLOR_GROUPS: { title: string; fields: { key: keyof ThemeConfig['colors']; label: string; description?: string }[] }[] = [
  {
    title: msg('Marca'),
    fields: [
      { key: 'primary', label: msg('Principal'), description: msg('Logo sin imagen, detalles y fondos suaves.') },
      { key: 'secondary', label: msg('Secundario') },
      { key: 'accent', label: msg('Acento'), description: msg('Antetítulos, íconos, enlaces y filtros activos.') },
    ],
  },
  {
    title: msg('Superficies'),
    fields: [
      { key: 'background', label: msg('Fondo') },
      { key: 'surface', label: msg('Tarjetas') },
      { key: 'border', label: msg('Bordes') },
    ],
  },
  {
    title: msg('Texto'),
    fields: [
      { key: 'heading', label: msg('Títulos') },
      { key: 'text', label: msg('Texto') },
      { key: 'mutedText', label: msg('Texto secundario') },
    ],
  },
  {
    title: msg('Acciones y precios'),
    fields: [
      { key: 'button', label: msg('Botones') },
      { key: 'buttonText', label: msg('Texto de botones') },
      { key: 'price', label: msg('Precios') },
    ],
  },
  {
    title: msg('Estados'),
    fields: [
      { key: 'success', label: msg('Éxito'), description: msg('Disponible, confirmaciones.') },
      { key: 'warning', label: msg('Aviso'), description: msg('Últimas unidades, recordatorios.') },
      { key: 'error', label: msg('Error'), description: msg('Agotado, no disponible.') },
    ],
  },
];

function ColorsTab({ theme, patch }: TabProps) {
  const t = useT();
  const c = theme.colors;
  const warnings = [
    contrastRatio(c.text, c.background) < MIN_READABLE_CONTRAST && t('El texto se lee con dificultad sobre el fondo.'),
    contrastRatio(c.text, c.surface) < MIN_READABLE_CONTRAST && t('El texto se lee con dificultad sobre las tarjetas.'),
    contrastRatio(c.buttonText, c.button) < MIN_READABLE_CONTRAST && t('El texto de los botones tiene poco contraste.'),
  ].filter(Boolean) as string[];
  return (
    <>
      {warnings.map((w) => (
        <Alert key={w} severity="warning" sx={{ mt: 2 }}>{w}</Alert>
      ))}
      {COLOR_GROUPS.map((group) => (
        <Group key={group.title} title={t(group.title)}>
          {group.fields.map((f) => (
            <ColorInput key={f.key} label={t(f.label)} description={f.description && t(f.description)} value={c[f.key]} onChange={(value) => patch('colors', { [f.key]: value })} />
          ))}
        </Group>
      ))}
    </>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: FontId; onChange: (value: FontId) => void }) {
  const t = useT();
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value as FontId)}>
      {FONT_IDS.map((id) => (
        <MenuItem key={id} value={id} sx={{ fontFamily: FONT_FAMILIES[id], fontSize: 15 }}>{t(FONTS[id].label)}</MenuItem>
      ))}
    </TextField>
  );
}

function TypographyTab({ theme, patch }: TabProps) {
  const t = useT();
  const ty = theme.typography;
  return (
    <>
      <Group title={t('Fuentes')}>
        <FontSelect label={t('Títulos')} value={ty.headingFont} onChange={(headingFont) => patch('typography', { headingFont })} />
        <FontSelect label={t('Texto')} value={ty.bodyFont} onChange={(bodyFont) => patch('typography', { bodyFont })} />
        <FontSelect label={t('Precios')} value={ty.priceFont} onChange={(priceFont) => patch('typography', { priceFont })} />
      </Group>
      <Group title={t('Tamaños y ritmo')}>
        <SliderInput label={t('Tamaño base')} value={ty.baseSize} min={14} max={20} format={(v) => `${v}px`} onChange={(baseSize) => patch('typography', { baseSize })} />
        <Segmented label={t('Tamaño de títulos')} value={ty.headingScale} onChange={(headingScale) => patch('typography', { headingScale })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
        <Segmented label={t('Peso de títulos')} value={ty.headingWeight} onChange={(headingWeight) => patch('typography', { headingWeight })} options={[{ value: '400', label: '400' }, { value: '500', label: '500' }, { value: '600', label: '600' }, { value: '700', label: '700' }, { value: '800', label: '800' }]} />
        <SliderInput label={t('Interlineado')} value={ty.lineHeight} min={1.2} max={2} step={0.05} format={(v) => v.toFixed(2)} onChange={(lineHeight) => patch('typography', { lineHeight })} />
        <SliderInput label={t('Espaciado de letras (títulos)')} value={ty.headingLetterSpacing} min={-0.05} max={0.2} step={0.01} format={(v) => `${v.toFixed(2)}em`} onChange={(headingLetterSpacing) => patch('typography', { headingLetterSpacing })} />
        <Segmented label={t('Títulos en')} value={ty.headingCase} onChange={(headingCase) => patch('typography', { headingCase })} options={[{ value: 'none', label: t('Normal') }, { value: 'uppercase', label: t('MAYÚSCULAS') }]} />
      </Group>
      <TypeRolesEditor theme={theme} patch={patch} />
    </>
  );
}

/** Ajuste fino por rol (H1…Botón). Todo en "Auto" sigue la escala de arriba. */
function TypeRolesEditor({ theme, patch }: TabProps) {
  const t = useT();
  const [role, setRole] = useState<TypeRole>('h1');
  const roles = theme.typography.roles;
  const r = roles[role];
  const resolved = resolveTokens(theme).roles[role];
  const set = (value: Partial<typeof r>) => patch('typography', { roles: { ...roles, [role]: { ...r, ...value } } });
  const touched = TYPE_ROLES.filter((k) => JSON.stringify(roles[k]) !== JSON.stringify(DEFAULT_ROLE));
  return (
    <Group title={t('Jerarquía tipográfica')} description={t('Ajusta cada nivel por separado. «Auto» sigue la escala del tema.')}>
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
        {TYPE_ROLES.map((k) => (
          <Chip key={k} size="small" label={`${t(TYPE_ROLE_LABELS[k])}${touched.includes(k) ? ' •' : ''}`} color={k === role ? 'primary' : 'default'} variant={k === role ? 'filled' : 'outlined'} onClick={() => setRole(k)} />
        ))}
      </Stack>
      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Typography
          sx={{
            fontFamily: FONT_FAMILIES[resolved.font === 'heading' ? theme.typography.headingFont : theme.typography.bodyFont],
            fontSize: Math.min(resolved.size, 44),
            fontWeight: resolved.weight,
            lineHeight: resolved.lineHeight,
            letterSpacing: `${resolved.letterSpacing}em`,
            textTransform: resolved.transform as 'none',
          }}
          noWrap
        >
          {role === 'button' ? t('Ver catálogo') : role === 'label' ? t('Novedades') : role === 'body' || role === 'small' ? t('Texto de ejemplo para tu sitio.') : t('Título de ejemplo')}
        </Typography>
        <Typography variant="caption" color="text.secondary">{t('{size}px · móvil {mobileSize}px · peso {weight}', { size: resolved.size, mobileSize: resolved.mobileSize, weight: resolved.weight })}</Typography>
      </Box>
      <SliderInput label={t('Tamaño (escritorio)')} value={r.size} min={0} max={role === 'h1' ? 120 : 72} format={(v) => (v ? `${v}px` : t('Auto'))} onChange={(size) => set({ size })} />
      <SliderInput label={t('Tamaño (móvil)')} value={r.mobileSize} min={0} max={role === 'h1' ? 72 : 48} format={(v) => (v ? `${v}px` : t('Auto'))} onChange={(mobileSize) => set({ mobileSize })} />
      <SelectInput label={t('Peso')} value={r.weight} onChange={(weight) => set({ weight })} options={[{ value: 'auto', label: t('Auto') }, ...['300', '400', '500', '600', '700', '800'].map((w) => ({ value: w as typeof r.weight, label: w }))]} />
      <SliderInput label={t('Interlineado')} value={r.lineHeight} min={0} max={2.5} step={0.05} format={(v) => (v ? v.toFixed(2) : t('Auto'))} onChange={(lineHeight) => set({ lineHeight })} />
      <SliderInput label={t('Espaciado de letras')} value={r.letterSpacing ?? 0} min={-0.1} max={0.4} step={0.01} format={(v) => (r.letterSpacing === null ? t('Auto') : `${v.toFixed(2)}em`)} onChange={(letterSpacing) => set({ letterSpacing })} />
      <Segmented label={t('Mayúsculas')} value={r.transform} onChange={(transform) => set({ transform })} options={[{ value: 'auto', label: t('Auto') }, { value: 'none', label: t('Normal') }, { value: 'uppercase', label: 'AA' }, { value: 'capitalize', label: 'Aa' }]} />
      <Segmented label={t('Tipo de letra')} value={r.font} onChange={(font) => set({ font })} options={[{ value: 'auto', label: t('Auto') }, { value: 'heading', label: t('Títulos') }, { value: 'body', label: t('Texto') }]} />
      {touched.includes(role) && <Button size="small" color="inherit" onClick={() => set(DEFAULT_ROLE)} sx={{ alignSelf: 'flex-start' }}>{t('Restablecer {role}', { role: t(TYPE_ROLE_LABELS[role]) })}</Button>}
    </Group>
  );
}

const DEFAULT_ROLE = { size: 0, mobileSize: 0, weight: 'auto', lineHeight: 0, letterSpacing: null, transform: 'auto', font: 'auto' } as const;

function StyleTab({ theme, patch }: TabProps) {
  const t = useT();
  return (
    <>
      <Group title={t('Espaciado')}>
        <Segmented label={t('Aire entre secciones')} value={theme.spacing.sectionPadding} onChange={(sectionPadding) => patch('spacing', { sectionPadding })} options={[{ value: 'compact', label: t('Compacto') }, { value: 'normal', label: t('Normal') }, { value: 'relaxed', label: t('Amplio') }, { value: 'spacious', label: 'XL' }]} />
        <Segmented label={t('Separación de elementos')} value={theme.spacing.gap} onChange={(gap) => patch('spacing', { gap })} options={[{ value: 'tight', label: t('Poca') }, { value: 'normal', label: t('Normal') }, { value: 'loose', label: t('Mucha') }]} />
        <Segmented label={t('Ancho máximo')} value={theme.spacing.maxWidth} onChange={(maxWidth) => patch('spacing', { maxWidth })} options={[{ value: 'narrow', label: '960' }, { value: 'normal', label: '1180' }, { value: 'wide', label: '1360' }, { value: 'full', label: t('Total') }]} />
        <Segmented label={t('Título → contenido')} value={theme.spacing.titleSpacing} onChange={(titleSpacing) => patch('spacing', { titleSpacing })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
      </Group>
      <Group title={t('Bordes y sombras')}>
        <SliderInput label={t('Redondeo de esquinas')} value={theme.shape.radius} min={0} max={28} format={(v) => `${v}px`} onChange={(radius) => patch('shape', { radius })} />
        <Segmented label={t('Grosor de bordes')} value={theme.shape.borderWidth} onChange={(borderWidth) => patch('shape', { borderWidth })} options={[0, 1, 2, 3].map((n) => ({ value: n, label: `${n}px` }))} />
        <Segmented label={t('Sombras')} value={theme.shape.shadow} onChange={(shadow) => patch('shape', { shadow })} options={[{ value: 'none', label: t('Sin') }, { value: 'soft', label: t('Suave') }, { value: 'medium', label: t('Media') }, { value: 'strong', label: t('Fuerte') }]} />
      </Group>
      <Group title={t('Botones')}>
        <Segmented label={t('Estilo')} value={theme.buttons.style} onChange={(style) => patch('buttons', { style })} options={[{ value: 'solid', label: t('Sólido') }, { value: 'outline', label: t('Borde') }, { value: 'soft', label: t('Suave') }, { value: 'ghost', label: t('Texto') }]} />
        <Segmented label={t('Forma')} value={theme.buttons.shape} onChange={(shape) => patch('buttons', { shape })} options={[{ value: 'square', label: t('Recta') }, { value: 'rounded', label: t('Redondeada') }, { value: 'pill', label: t('Píldora') }]} />
        <Segmented label={t('Tamaño')} value={theme.buttons.size} onChange={(size) => patch('buttons', { size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        <Segmented label={t('Al pasar el mouse')} value={theme.buttons.hover} onChange={(hover) => patch('buttons', { hover })} options={[{ value: 'darken', label: t('Oscurecer') }, { value: 'lift', label: t('Elevar') }, { value: 'grow', label: t('Crecer') }, { value: 'none', label: t('Nada') }]} />
        <SwitchRow label={t('Sombra')} checked={theme.buttons.shadow} onChange={(shadow) => patch('buttons', { shadow })} />
        <SwitchRow label={t('Texto en mayúsculas')} checked={theme.buttons.uppercase} onChange={(uppercase) => patch('buttons', { uppercase })} />
      </Group>
    </>
  );
}

const BADGE_LABELS = { new: msg('Nuevo'), featured: msg('Destacado'), sale: msg('Oferta'), popular: msg('Popular'), soldOut: msg('Agotado') } as const;

function CardsTab({ theme, patch }: TabProps) {
  const t = useT();
  const cards = theme.cards;
  const badges = theme.badges;
  return (
    <>
      <Group title={t('Estilo de tarjeta')} description={t('Se aplica en todo el sitio; cada sección de productos puede usar otro.')}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {CARD_STYLES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => patch('cards', { style: id })}
              aria-pressed={cards.style === id}
              sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 1.5, border: 1, borderColor: cards.style === id ? 'primary.main' : 'divider', boxShadow: cards.style === id ? (th) => `0 0 0 1px ${th.palette.primary.main}` : 'none' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(CARD_STYLE_META[id].label)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block' }}>{t(CARD_STYLE_META[id].description)}</Typography>
            </ButtonBase>
          ))}
        </Box>
        <Segmented label={t('Imagen')} value={cards.imagePosition} onChange={(imagePosition) => patch('cards', { imagePosition })} options={[{ value: 'top', label: t('Arriba') }, { value: 'side', label: t('Lateral') }, { value: 'overlay', label: t('Con texto') }, { value: 'circle', label: t('Circular') }]} />
        <Segmented label={t('Proporción')} value={cards.imageRatio} onChange={(imageRatio) => patch('cards', { imageRatio })} options={[{ value: 'square', label: '1:1' }, { value: 'portrait', label: '4:5' }, { value: 'landscape', label: '4:3' }, { value: 'wide', label: '16:9' }]} />
        <Segmented label={t('Alineación')} value={cards.align} onChange={(align) => patch('cards', { align })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
        <Segmented label={t('Al pasar el mouse')} value={cards.hover} onChange={(hover) => patch('cards', { hover })} options={[{ value: 'none', label: t('Nada') }, { value: 'zoom', label: t('Zoom') }, { value: 'lift', label: t('Elevar') }, { value: 'shadow', label: t('Sombra') }]} />
        <Segmented label={t('Botón')} value={cards.button} onChange={(button) => patch('cards', { button })} options={[{ value: 'none', label: t('Sin') }, { value: 'solid', label: t('Botón') }, { value: 'link', label: t('Enlace') }, { value: 'icon', label: t('Ícono') }]} />
      </Group>
      <Group title={t('Qué mostrar')}>
        <SwitchRow label={t('Precio')} checked={cards.showPrice} onChange={(showPrice) => patch('cards', { showPrice })} />
        <SwitchRow label={t('Descripción')} checked={cards.showDescription} onChange={(showDescription) => patch('cards', { showDescription })} />
        <SwitchRow label={t('Categoría')} checked={cards.showCategory} onChange={(showCategory) => patch('cards', { showCategory })} />
        <SwitchRow label={t('Badges')} checked={cards.showBadges} onChange={(showBadges) => patch('cards', { showBadges })} />
        <SwitchRow label={t('Disponibilidad')} checked={cards.showAvailability} onChange={(showAvailability) => patch('cards', { showAvailability })} />
        <SwitchRow label={t('Código / SKU')} checked={cards.showSku} onChange={(showSku) => patch('cards', { showSku })} />
      </Group>
      <Group title={t('Badges y etiquetas')} description={t('Se asignan en cada producto. Oferta y Agotado pueden ser automáticos.')}>
        <Segmented label={t('Estilo')} value={badges.style} onChange={(style) => patch('badges', { style })} options={[{ value: 'solid', label: t('Sólido') }, { value: 'soft', label: t('Suave') }, { value: 'outline', label: t('Borde') }]} />
        <Segmented label={t('Forma')} value={badges.shape} onChange={(shape) => patch('badges', { shape })} options={[{ value: 'pill', label: t('Píldora') }, { value: 'square', label: t('Recta') }]} />
        <Segmented label={t('Posición')} value={badges.position} onChange={(position) => patch('badges', { position })} options={[{ value: 'top-left', label: '↖' }, { value: 'top-right', label: '↗' }, { value: 'bottom-left', label: '↙' }]} />
        <SwitchRow label={t('Oferta automática')} description={t('Si tiene precio anterior.')} checked={badges.autoSale} onChange={(autoSale) => patch('badges', { autoSale })} />
        <SwitchRow label={t('Agotado automático')} checked={badges.autoSoldOut} onChange={(autoSoldOut) => patch('badges', { autoSoldOut })} />
        <SwitchRow label={t('Destacado automático')} description={t('Para ítems marcados como destacados.')} checked={badges.autoFeatured} onChange={(autoFeatured) => patch('badges', { autoFeatured })} />
        {BADGE_KEYS.map((key) => (
          <Stack key={key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextInput label={t(BADGE_LABELS[key])} value={badges[key].label} onChange={(label) => patch('badges', { [key]: { ...badges[key], label } })} maxLength={20} />
            <Box sx={{ flexShrink: 0 }}>
              <ColorInput label="" value={badges[key].color} onChange={(color) => patch('badges', { [key]: { ...badges[key], color } })} />
            </Box>
          </Stack>
        ))}
      </Group>
    </>
  );
}
