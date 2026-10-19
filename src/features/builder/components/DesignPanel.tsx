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

type DesignTab = 'theme' | 'colors' | 'type' | 'style' | 'background' | 'cards';

export type IdentityImages = { logoUrl: string | null; coverUrl: string | null; faviconUrl: string | null };

export function DesignPanel({ identity, initialTab = 'theme' }: { identity: IdentityImages; initialTab?: DesignTab }) {
  const { state, dispatch } = useBuilder();
  const [tab, setTab] = useState<DesignTab>(initialTab);
  const theme = state.theme;
  const setTheme = (next: ThemeConfig) => dispatch({ type: 'setTheme', theme: next });
  const patch = <K extends keyof ThemeConfig>(key: K, value: Partial<ThemeConfig[K]>) =>
    setTheme({ ...theme, [key]: typeof value === 'object' && !Array.isArray(value) ? { ...(theme[key] as object), ...value } : value });

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider', mt: 1 }}>
        <Tab value="theme" label="Tema" />
        <Tab value="colors" label="Colores" />
        <Tab value="type" label="Tipografía" />
        <Tab value="style" label="Estilo" />
        <Tab value="background" label="Fondo" />
        <Tab value="cards" label="Tarjetas" />
      </Tabs>
      {tab === 'theme' && <ThemeTab theme={theme} setTheme={setTheme} identity={identity} />}
      {tab === 'colors' && <ColorsTab theme={theme} patch={patch} />}
      {tab === 'type' && <TypographyTab theme={theme} patch={patch} />}
      {tab === 'style' && <StyleTab theme={theme} patch={patch} />}
      {tab === 'background' && (
        <Group title="Fondo global del sitio" description="Cada página y sección puede sobrescribirlo desde su configuración.">
          <BackgroundEditor value={theme.background} onChange={(background) => setTheme({ ...theme, background })} allowInherit={false} />
        </Group>
      )}
      {tab === 'cards' && <CardsTab theme={theme} patch={patch} />}
    </Box>
  );
}

type TabProps = { theme: ThemeConfig; patch: <K extends keyof ThemeConfig>(key: K, value: Partial<ThemeConfig[K]>) => void };

function ThemeTab({ theme, setTheme, identity }: { theme: ThemeConfig; setTheme: (t: ThemeConfig) => void; identity: IdentityImages }) {
  const router = useRouter();
  const { run } = useAction();
  const persist = (action: () => ReturnType<typeof setBusinessLogo>) => run(action, { onSuccess: () => router.refresh() }).then(() => undefined);
  return (
    <>
      <Group title="Temas" description="Un punto de partida: cambia colores, tipografía, header, tarjetas, botones y fondo. Después puedes ajustar todo.">
        <Grid container spacing={1}>
          {THEME_PRESETS.map((preset) => (
            <Grid key={preset.id} size={6}>
              <ButtonBase
                onClick={() => setTheme(applyPreset(theme, preset))}
                aria-pressed={theme.preset === preset.id}
                sx={{ display: 'block', width: '100%', textAlign: 'left', p: 1, borderRadius: 1.5, border: 1, borderColor: theme.preset === preset.id ? 'primary.main' : 'divider', boxShadow: theme.preset === preset.id ? (t) => `0 0 0 1px ${t.palette.primary.main}` : 'none' }}
              >
                <Box sx={{ height: 52, borderRadius: 1, bgcolor: preset.swatch[0], border: 1, borderColor: 'divider', p: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontFamily: FONT_FAMILIES[(preset.theme.typography?.headingFont ?? 'inter') as FontId], color: preset.theme.colors?.heading, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Aa</Typography>
                  <Stack direction="row" spacing={0.5}>
                    {preset.swatch.map((c, i) => (
                      <Box key={i} sx={{ width: 13, height: 13, borderRadius: '50%', bgcolor: c, border: 1, borderColor: 'divider' }} />
                    ))}
                  </Stack>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75 }}>{preset.name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{preset.description}</Typography>
              </ButtonBase>
            </Grid>
          ))}
        </Grid>
      </Group>
      <Group title="Identidad" description="Se guardan al subirlas.">
        <ImageField label="Logo" description="Cuadrado, PNG con fondo transparente." kind="logo" value={identity.logoUrl} onChange={(path) => persist(() => setBusinessLogo(path))} width={64} />
        <ImageField label="Imagen principal" description="Se usa al compartir el sitio y como portada del PDF." kind="cover" value={identity.coverUrl} onChange={(path) => persist(() => setCatalogMedia({ field: 'cover_path', path }))} width={120} aspectRatio="16 / 9" />
        <ImageField label="Favicon" description="Ícono de la pestaña del navegador." kind="favicon" value={identity.faviconUrl} onChange={(path) => persist(() => setCatalogMedia({ field: 'favicon_path', path }))} width={44} />
      </Group>
    </>
  );
}

const COLOR_GROUPS: { title: string; fields: { key: keyof ThemeConfig['colors']; label: string; description?: string }[] }[] = [
  {
    title: 'Marca',
    fields: [
      { key: 'primary', label: 'Principal', description: 'Logo sin imagen, detalles y fondos suaves.' },
      { key: 'secondary', label: 'Secundario' },
      { key: 'accent', label: 'Acento', description: 'Antetítulos, íconos, enlaces y filtros activos.' },
    ],
  },
  {
    title: 'Superficies',
    fields: [
      { key: 'background', label: 'Fondo' },
      { key: 'surface', label: 'Tarjetas' },
      { key: 'border', label: 'Bordes' },
    ],
  },
  {
    title: 'Texto',
    fields: [
      { key: 'heading', label: 'Títulos' },
      { key: 'text', label: 'Texto' },
      { key: 'mutedText', label: 'Texto secundario' },
    ],
  },
  {
    title: 'Acciones y precios',
    fields: [
      { key: 'button', label: 'Botones' },
      { key: 'buttonText', label: 'Texto de botones' },
      { key: 'price', label: 'Precios' },
    ],
  },
  {
    title: 'Estados',
    fields: [
      { key: 'success', label: 'Éxito', description: 'Disponible, confirmaciones.' },
      { key: 'warning', label: 'Aviso', description: 'Últimas unidades, recordatorios.' },
      { key: 'error', label: 'Error', description: 'Agotado, no disponible.' },
    ],
  },
];

function ColorsTab({ theme, patch }: TabProps) {
  const c = theme.colors;
  const warnings = [
    contrastRatio(c.text, c.background) < MIN_READABLE_CONTRAST && 'El texto se lee con dificultad sobre el fondo.',
    contrastRatio(c.text, c.surface) < MIN_READABLE_CONTRAST && 'El texto se lee con dificultad sobre las tarjetas.',
    contrastRatio(c.buttonText, c.button) < MIN_READABLE_CONTRAST && 'El texto de los botones tiene poco contraste.',
  ].filter(Boolean) as string[];
  return (
    <>
      {warnings.map((w) => (
        <Alert key={w} severity="warning" sx={{ mt: 2 }}>{w}</Alert>
      ))}
      {COLOR_GROUPS.map((group) => (
        <Group key={group.title} title={group.title}>
          {group.fields.map((f) => (
            <ColorInput key={f.key} label={f.label} description={f.description} value={c[f.key]} onChange={(value) => patch('colors', { [f.key]: value })} />
          ))}
        </Group>
      ))}
    </>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: FontId; onChange: (value: FontId) => void }) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value as FontId)}>
      {FONT_IDS.map((id) => (
        <MenuItem key={id} value={id} sx={{ fontFamily: FONT_FAMILIES[id], fontSize: 15 }}>{FONTS[id].label}</MenuItem>
      ))}
    </TextField>
  );
}

function TypographyTab({ theme, patch }: TabProps) {
  const t = theme.typography;
  return (
    <>
      <Group title="Fuentes">
        <FontSelect label="Títulos" value={t.headingFont} onChange={(headingFont) => patch('typography', { headingFont })} />
        <FontSelect label="Texto" value={t.bodyFont} onChange={(bodyFont) => patch('typography', { bodyFont })} />
        <FontSelect label="Precios" value={t.priceFont} onChange={(priceFont) => patch('typography', { priceFont })} />
      </Group>
      <Group title="Tamaños y ritmo">
        <SliderInput label="Tamaño base" value={t.baseSize} min={14} max={20} format={(v) => `${v}px`} onChange={(baseSize) => patch('typography', { baseSize })} />
        <Segmented label="Tamaño de títulos" value={t.headingScale} onChange={(headingScale) => patch('typography', { headingScale })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
        <Segmented label="Peso de títulos" value={t.headingWeight} onChange={(headingWeight) => patch('typography', { headingWeight })} options={[{ value: '400', label: '400' }, { value: '500', label: '500' }, { value: '600', label: '600' }, { value: '700', label: '700' }, { value: '800', label: '800' }]} />
        <SliderInput label="Interlineado" value={t.lineHeight} min={1.2} max={2} step={0.05} format={(v) => v.toFixed(2)} onChange={(lineHeight) => patch('typography', { lineHeight })} />
        <SliderInput label="Espaciado de letras (títulos)" value={t.headingLetterSpacing} min={-0.05} max={0.2} step={0.01} format={(v) => `${v.toFixed(2)}em`} onChange={(headingLetterSpacing) => patch('typography', { headingLetterSpacing })} />
        <Segmented label="Títulos en" value={t.headingCase} onChange={(headingCase) => patch('typography', { headingCase })} options={[{ value: 'none', label: 'Normal' }, { value: 'uppercase', label: 'MAYÚSCULAS' }]} />
      </Group>
      <TypeRolesEditor theme={theme} patch={patch} />
    </>
  );
}

/** Ajuste fino por rol (H1…Botón). Todo en "Auto" sigue la escala de arriba. */
function TypeRolesEditor({ theme, patch }: TabProps) {
  const [role, setRole] = useState<TypeRole>('h1');
  const roles = theme.typography.roles;
  const r = roles[role];
  const resolved = resolveTokens(theme).roles[role];
  const set = (value: Partial<typeof r>) => patch('typography', { roles: { ...roles, [role]: { ...r, ...value } } });
  const touched = TYPE_ROLES.filter((k) => JSON.stringify(roles[k]) !== JSON.stringify(DEFAULT_ROLE));
  return (
    <Group title="Jerarquía tipográfica" description="Ajusta cada nivel por separado. «Auto» sigue la escala del tema.">
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
        {TYPE_ROLES.map((k) => (
          <Chip key={k} size="small" label={`${TYPE_ROLE_LABELS[k]}${touched.includes(k) ? ' •' : ''}`} color={k === role ? 'primary' : 'default'} variant={k === role ? 'filled' : 'outlined'} onClick={() => setRole(k)} />
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
          {role === 'button' ? 'Ver catálogo' : role === 'label' ? 'Novedades' : role === 'body' || role === 'small' ? 'Texto de ejemplo para tu sitio.' : 'Título de ejemplo'}
        </Typography>
        <Typography variant="caption" color="text.secondary">{resolved.size}px · móvil {resolved.mobileSize}px · peso {resolved.weight}</Typography>
      </Box>
      <SliderInput label="Tamaño (escritorio)" value={r.size} min={0} max={role === 'h1' ? 120 : 72} format={(v) => (v ? `${v}px` : 'Auto')} onChange={(size) => set({ size })} />
      <SliderInput label="Tamaño (móvil)" value={r.mobileSize} min={0} max={role === 'h1' ? 72 : 48} format={(v) => (v ? `${v}px` : 'Auto')} onChange={(mobileSize) => set({ mobileSize })} />
      <SelectInput label="Peso" value={r.weight} onChange={(weight) => set({ weight })} options={[{ value: 'auto', label: 'Auto' }, ...['300', '400', '500', '600', '700', '800'].map((w) => ({ value: w as typeof r.weight, label: w }))]} />
      <SliderInput label="Interlineado" value={r.lineHeight} min={0} max={2.5} step={0.05} format={(v) => (v ? v.toFixed(2) : 'Auto')} onChange={(lineHeight) => set({ lineHeight })} />
      <SliderInput label="Espaciado de letras" value={r.letterSpacing ?? 0} min={-0.1} max={0.4} step={0.01} format={(v) => (r.letterSpacing === null ? 'Auto' : `${v.toFixed(2)}em`)} onChange={(letterSpacing) => set({ letterSpacing })} />
      <Segmented label="Mayúsculas" value={r.transform} onChange={(transform) => set({ transform })} options={[{ value: 'auto', label: 'Auto' }, { value: 'none', label: 'Normal' }, { value: 'uppercase', label: 'AA' }, { value: 'capitalize', label: 'Aa' }]} />
      <Segmented label="Fuente" value={r.font} onChange={(font) => set({ font })} options={[{ value: 'auto', label: 'Auto' }, { value: 'heading', label: 'Títulos' }, { value: 'body', label: 'Texto' }]} />
      {touched.includes(role) && <Button size="small" color="inherit" onClick={() => set(DEFAULT_ROLE)} sx={{ alignSelf: 'flex-start' }}>Restablecer {TYPE_ROLE_LABELS[role]}</Button>}
    </Group>
  );
}

const DEFAULT_ROLE = { size: 0, mobileSize: 0, weight: 'auto', lineHeight: 0, letterSpacing: null, transform: 'auto', font: 'auto' } as const;

function StyleTab({ theme, patch }: TabProps) {
  return (
    <>
      <Group title="Espaciado">
        <Segmented label="Aire entre secciones" value={theme.spacing.sectionPadding} onChange={(sectionPadding) => patch('spacing', { sectionPadding })} options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }, { value: 'spacious', label: 'XL' }]} />
        <Segmented label="Separación de elementos" value={theme.spacing.gap} onChange={(gap) => patch('spacing', { gap })} options={[{ value: 'tight', label: 'Poca' }, { value: 'normal', label: 'Normal' }, { value: 'loose', label: 'Mucha' }]} />
        <Segmented label="Ancho máximo" value={theme.spacing.maxWidth} onChange={(maxWidth) => patch('spacing', { maxWidth })} options={[{ value: 'narrow', label: '960' }, { value: 'normal', label: '1180' }, { value: 'wide', label: '1360' }, { value: 'full', label: 'Total' }]} />
        <Segmented label="Título → contenido" value={theme.spacing.titleSpacing} onChange={(titleSpacing) => patch('spacing', { titleSpacing })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
      </Group>
      <Group title="Bordes y sombras">
        <SliderInput label="Redondeo de esquinas" value={theme.shape.radius} min={0} max={28} format={(v) => `${v}px`} onChange={(radius) => patch('shape', { radius })} />
        <Segmented label="Grosor de bordes" value={theme.shape.borderWidth} onChange={(borderWidth) => patch('shape', { borderWidth })} options={[0, 1, 2, 3].map((n) => ({ value: n, label: `${n}px` }))} />
        <Segmented label="Sombras" value={theme.shape.shadow} onChange={(shadow) => patch('shape', { shadow })} options={[{ value: 'none', label: 'Sin' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Media' }, { value: 'strong', label: 'Fuerte' }]} />
      </Group>
      <Group title="Botones">
        <Segmented label="Estilo" value={theme.buttons.style} onChange={(style) => patch('buttons', { style })} options={[{ value: 'solid', label: 'Sólido' }, { value: 'outline', label: 'Borde' }, { value: 'soft', label: 'Suave' }, { value: 'ghost', label: 'Texto' }]} />
        <Segmented label="Forma" value={theme.buttons.shape} onChange={(shape) => patch('buttons', { shape })} options={[{ value: 'square', label: 'Recta' }, { value: 'rounded', label: 'Redondeada' }, { value: 'pill', label: 'Píldora' }]} />
        <Segmented label="Tamaño" value={theme.buttons.size} onChange={(size) => patch('buttons', { size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        <Segmented label="Al pasar el mouse" value={theme.buttons.hover} onChange={(hover) => patch('buttons', { hover })} options={[{ value: 'darken', label: 'Oscurecer' }, { value: 'lift', label: 'Elevar' }, { value: 'grow', label: 'Crecer' }, { value: 'none', label: 'Nada' }]} />
        <SwitchRow label="Sombra" checked={theme.buttons.shadow} onChange={(shadow) => patch('buttons', { shadow })} />
        <SwitchRow label="Texto en mayúsculas" checked={theme.buttons.uppercase} onChange={(uppercase) => patch('buttons', { uppercase })} />
      </Group>
    </>
  );
}

const BADGE_LABELS = { new: 'Nuevo', featured: 'Destacado', sale: 'Oferta', popular: 'Popular', soldOut: 'Agotado' } as const;

function CardsTab({ theme, patch }: TabProps) {
  const cards = theme.cards;
  const badges = theme.badges;
  return (
    <>
      <Group title="Estilo de tarjeta" description="Se aplica en todo el sitio; cada sección de productos puede usar otro.">
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {CARD_STYLES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => patch('cards', { style: id })}
              aria-pressed={cards.style === id}
              sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 1.5, border: 1, borderColor: cards.style === id ? 'primary.main' : 'divider', boxShadow: cards.style === id ? (t) => `0 0 0 1px ${t.palette.primary.main}` : 'none' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{CARD_STYLE_META[id].label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block' }}>{CARD_STYLE_META[id].description}</Typography>
            </ButtonBase>
          ))}
        </Box>
        <Segmented label="Imagen" value={cards.imagePosition} onChange={(imagePosition) => patch('cards', { imagePosition })} options={[{ value: 'top', label: 'Arriba' }, { value: 'side', label: 'Lateral' }, { value: 'overlay', label: 'Con texto' }, { value: 'circle', label: 'Circular' }]} />
        <Segmented label="Proporción" value={cards.imageRatio} onChange={(imageRatio) => patch('cards', { imageRatio })} options={[{ value: 'square', label: '1:1' }, { value: 'portrait', label: '4:5' }, { value: 'landscape', label: '4:3' }, { value: 'wide', label: '16:9' }]} />
        <Segmented label="Alineación" value={cards.align} onChange={(align) => patch('cards', { align })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
        <Segmented label="Al pasar el mouse" value={cards.hover} onChange={(hover) => patch('cards', { hover })} options={[{ value: 'none', label: 'Nada' }, { value: 'zoom', label: 'Zoom' }, { value: 'lift', label: 'Elevar' }, { value: 'shadow', label: 'Sombra' }]} />
        <Segmented label="Botón" value={cards.button} onChange={(button) => patch('cards', { button })} options={[{ value: 'none', label: 'Sin' }, { value: 'solid', label: 'Botón' }, { value: 'link', label: 'Enlace' }, { value: 'icon', label: 'Ícono' }]} />
      </Group>
      <Group title="Qué mostrar">
        <SwitchRow label="Precio" checked={cards.showPrice} onChange={(showPrice) => patch('cards', { showPrice })} />
        <SwitchRow label="Descripción" checked={cards.showDescription} onChange={(showDescription) => patch('cards', { showDescription })} />
        <SwitchRow label="Categoría" checked={cards.showCategory} onChange={(showCategory) => patch('cards', { showCategory })} />
        <SwitchRow label="Badges" checked={cards.showBadges} onChange={(showBadges) => patch('cards', { showBadges })} />
        <SwitchRow label="Disponibilidad" checked={cards.showAvailability} onChange={(showAvailability) => patch('cards', { showAvailability })} />
        <SwitchRow label="Código / SKU" checked={cards.showSku} onChange={(showSku) => patch('cards', { showSku })} />
      </Group>
      <Group title="Badges y etiquetas" description="Se asignan en cada producto. Oferta y Agotado pueden ser automáticos.">
        <Segmented label="Estilo" value={badges.style} onChange={(style) => patch('badges', { style })} options={[{ value: 'solid', label: 'Sólido' }, { value: 'soft', label: 'Suave' }, { value: 'outline', label: 'Borde' }]} />
        <Segmented label="Forma" value={badges.shape} onChange={(shape) => patch('badges', { shape })} options={[{ value: 'pill', label: 'Píldora' }, { value: 'square', label: 'Recta' }]} />
        <Segmented label="Posición" value={badges.position} onChange={(position) => patch('badges', { position })} options={[{ value: 'top-left', label: '↖' }, { value: 'top-right', label: '↗' }, { value: 'bottom-left', label: '↙' }]} />
        <SwitchRow label="Oferta automática" description="Si tiene precio anterior." checked={badges.autoSale} onChange={(autoSale) => patch('badges', { autoSale })} />
        <SwitchRow label="Agotado automático" checked={badges.autoSoldOut} onChange={(autoSoldOut) => patch('badges', { autoSoldOut })} />
        <SwitchRow label="Destacado automático" description="Para ítems marcados como destacados." checked={badges.autoFeatured} onChange={(autoFeatured) => patch('badges', { autoFeatured })} />
        {BADGE_KEYS.map((key) => (
          <Stack key={key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextInput label={BADGE_LABELS[key]} value={badges[key].label} onChange={(label) => patch('badges', { [key]: { ...badges[key], label } })} maxLength={20} />
            <Box sx={{ flexShrink: 0 }}>
              <ColorInput label="" value={badges[key].color} onChange={(color) => patch('badges', { [key]: { ...badges[key], color } })} />
            </Box>
          </Stack>
        ))}
      </Group>
    </>
  );
}
