'use client';

import { Autocomplete, Box, Button, IconButton, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { CalendarPlus, CopyCheck, Plus, Trash2, X } from 'lucide-react';
import { useMemo } from 'react';
import { useController, useFieldArray, useWatch, type Control, type UseFormReturn } from 'react-hook-form';
import { SwitchControl } from '@/components/form/fields';
import { useLocale, useT } from '@/i18n/client';
import type { BusinessContact } from '@/lib/business/profile';
import { MAX_SPECIAL_DAYS, weekdayName, type ScheduleDay, type SpecialDay } from '@/lib/business/schedule';

const MAX_RANGES = 3;

/** Zonas horarias que conoce el navegador (todas, si las expone). */
function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

/**
 * Horario por día: interruptor, un renglón por día con sus turnos (hasta 3,
 * p. ej. 9:00–14:00 y 16:00–20:00) y la zona horaria del negocio.
 */
export function ScheduleField({ form }: { form: UseFormReturn<BusinessContact> }) {
  const t = useT();
  const { control, setValue, getValues } = form;
  const enabled = useWatch({ control, name: 'schedule.enabled' });
  const zones = useMemo(() => timeZones(), []);

  const copyToAll = (index: number) => {
    const day = getValues(`schedule.days.${index}`);
    getValues('schedule.days').forEach((_, other) => {
      if (other !== index) setValue(`schedule.days.${other}`, structuredClone(day), { shouldDirty: true });
    });
  };

  return (
    <Stack spacing={1.5}>
      <SwitchControl
        control={control}
        name="schedule.enabled"
        label={t('Horario por día')}
        description={t('Tu sitio muestra «Abierto ahora» o cuándo abres, y el pedido avisa si está cerrado.')}
        onChange={(on) => {
          // La primera vez se usa la zona horaria de este navegador.
          if (on && !getValues('schedule.timezone')) setValue('schedule.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone, { shouldDirty: true });
        }}
      />
      {enabled && (
        <>
          <Stack spacing={1} role="list" aria-label={t('Horario por día')}>
            {Array.from({ length: 7 }, (_, index) => (
              <DayRow key={index} control={control} index={index} onCopy={() => copyToAll(index)} />
            ))}
          </Stack>
          <TimeZoneField control={control} zones={zones} />
          <SpecialDays control={control} />
        </>
      )}
    </Stack>
  );
}

function DayRow({ control, index, onCopy }: { control: Control<BusinessContact>; index: number; onCopy: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { field, fieldState } = useController({ control, name: `schedule.days.${index}` });
  const day = field.value as ScheduleDay;
  const name = weekdayName(index, locale, 'long');
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const set = (next: ScheduleDay) => field.onChange(next);
  const invalid = Boolean(fieldState.error);

  return (
    <Stack role="listitem" direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" sx={{ alignItems: 'center', width: { sm: 190 }, flexShrink: 0 }}>
        <Switch
          checked={day.open}
          onChange={(event) => set({ open: event.target.checked, ranges: event.target.checked && day.ranges.length === 0 ? [{ from: '09:00', to: '18:00' }] : day.ranges })}
          slotProps={{ input: { 'aria-label': t('Abierto el {day}', { day: name }) } }}
        />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
      </Stack>
      {day.open ? (
        <RangesInput ranges={day.ranges} onChange={(ranges) => set({ ...day, ranges })} invalid={invalid} name={name} />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{t('Cerrado')}</Typography>
      )}
      <Box>
        <Tooltip title={t('Copiar a todos los días')}>
          <IconButton size="small" onClick={onCopy} aria-label={t('Copiar el horario del {day} a todos los días', { day: name })}>
            <CopyCheck size={15} />
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}

type Range = ScheduleDay['ranges'][number];

/** Turnos de un día (hasta 3): abre – cierra, quitar y agregar. `name`: el día, para los lectores de pantalla. */
function RangesInput({ ranges, onChange, invalid, name }: { ranges: Range[]; onChange: (ranges: Range[]) => void; invalid: boolean; name: string }) {
  const t = useT();
  const setRange = (at: number, key: 'from' | 'to', value: string) => onChange(ranges.map((r, i) => (i === at ? { ...r, [key]: value } : r)));
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
      {ranges.map((range, at) => (
        <Stack key={at} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <TextField
            type="time"
            size="small"
            value={range.from}
            onChange={(event) => setRange(at, 'from', event.target.value)}
            error={invalid}
            slotProps={{ htmlInput: { 'aria-label': t('{day}: abre', { day: name }), step: 300 } }}
            sx={{ width: 118 }}
          />
          <Typography variant="body2" color="text.secondary">–</Typography>
          <TextField
            type="time"
            size="small"
            value={range.to}
            onChange={(event) => setRange(at, 'to', event.target.value)}
            error={invalid}
            slotProps={{ htmlInput: { 'aria-label': t('{day}: cierra', { day: name }), step: 300 } }}
            sx={{ width: 118 }}
          />
          {ranges.length > 1 && (
            <IconButton size="small" onClick={() => onChange(ranges.filter((_, i) => i !== at))} aria-label={t('Quitar el turno {index} del {day}', { index: at + 1, day: name })}>
              <X size={14} />
            </IconButton>
          )}
        </Stack>
      ))}
      {ranges.length < MAX_RANGES && (
        <Button size="small" startIcon={<Plus size={14} />} onClick={() => onChange([...ranges, { from: '16:00', to: '20:00' }])}>
          {t('Turno')}
        </Button>
      )}
    </Stack>
  );
}

/** Mañana en el navegador ("2026-10-20"): la fecha que propone un día especial nuevo. */
const tomorrow = () => {
  const date = new Date(Date.now() + 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Días especiales: feriados, vacaciones u horario corto. Reemplazan al horario
 * de la semana en esa fecha (en el sitio, el «Abierto ahora» y los horarios
 * para pedir).
 */
function SpecialDays({ control }: { control: Control<BusinessContact> }) {
  const t = useT();
  const { fields, append, remove } = useFieldArray({ control, name: 'schedule.special' });
  const { fieldState } = useController({ control, name: 'schedule.special' });
  const rootError = fieldState.error?.root?.message ?? fieldState.error?.message;

  return (
    <Stack spacing={1}>
      <Box>
        <Typography variant="subtitle2">{t('Días especiales')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('Feriados, vacaciones u horario corto: ese día se usa este horario en lugar del de la semana.')}
        </Typography>
      </Box>
      {fields.length > 0 && (
        <Stack spacing={1} role="list" aria-label={t('Días especiales')}>
          {fields.map((field, index) => (
            <SpecialDayRow key={field.id} control={control} index={index} onRemove={() => remove(index)} />
          ))}
        </Stack>
      )}
      {rootError && (
        <Typography variant="caption" color="error">
          {t(rootError)}
        </Typography>
      )}
      {fields.length < MAX_SPECIAL_DAYS && (
        <Box>
          <Button size="small" variant="outlined" color="inherit" startIcon={<CalendarPlus size={14} />} onClick={() => append({ date: tomorrow(), open: false, ranges: [], note: '' })}>
            {t('Agregar día especial')}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function SpecialDayRow({ control, index, onRemove }: { control: Control<BusinessContact>; index: number; onRemove: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { field, fieldState } = useController({ control, name: `schedule.special.${index}` });
  const day = field.value as SpecialDay;
  const set = (next: Partial<SpecialDay>) => field.onChange({ ...day, ...next });
  const name = /^\d{4}-\d{2}-\d{2}$/.test(day.date)
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))
    : t('Día especial');
  const invalid = Boolean(fieldState.error);

  return (
    <Stack role="listitem" spacing={1} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
        <TextField
          type="date"
          size="small"
          label={t('Fecha')}
          value={day.date}
          onChange={(event) => set({ date: event.target.value })}
          error={Boolean(fieldState.error && 'date' in fieldState.error)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 170 }}
        />
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Switch
            checked={day.open}
            onChange={(event) => set({ open: event.target.checked, ranges: event.target.checked && day.ranges.length === 0 ? [{ from: '10:00', to: '14:00' }] : day.ranges })}
            slotProps={{ input: { 'aria-label': t('Abierto el {day}', { day: name }) } }}
          />
          <Typography variant="body2" color={day.open ? 'text.primary' : 'text.secondary'}>
            {day.open ? t('Abierto') : t('Cerrado')}
          </Typography>
        </Stack>
        <TextField
          size="small"
          label={t('Motivo (opcional)')}
          placeholder={t('Ej. Día de Muertos')}
          value={day.note}
          onChange={(event) => set({ note: event.target.value })}
          slotProps={{ htmlInput: { maxLength: 60 } }}
          sx={{ flex: 1 }}
        />
        <IconButton size="small" onClick={onRemove} aria-label={t('Quitar el día especial del {day}', { day: name })}>
          <Trash2 size={15} />
        </IconButton>
      </Stack>
      {day.open && <RangesInput ranges={day.ranges} onChange={(ranges) => set({ ranges })} invalid={invalid} name={name} />}
    </Stack>
  );
}

function TimeZoneField({ control, zones }: { control: Control<BusinessContact>; zones: string[] }) {
  const t = useT();
  const { field, fieldState } = useController({ control, name: 'schedule.timezone' });
  return (
    <Autocomplete
      options={zones}
      value={field.value || null}
      onChange={(_, value) => field.onChange(value ?? '')}
      sx={{ maxWidth: 360 }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('Zona horaria')}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ? t(fieldState.error.message) : t('Para saber si estás abierto aunque tu cliente esté en otra zona.')}
        />
      )}
    />
  );
}
