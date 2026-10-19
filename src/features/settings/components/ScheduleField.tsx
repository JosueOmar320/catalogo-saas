'use client';

import { Autocomplete, Box, Button, IconButton, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { CopyCheck, Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import { useController, useWatch, type Control, type UseFormReturn } from 'react-hook-form';
import { SwitchControl } from '@/components/form/fields';
import { useLocale, useT } from '@/i18n/client';
import type { BusinessContact } from '@/lib/business/profile';
import { weekdayName, type ScheduleDay } from '@/lib/business/schedule';

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
  const setRange = (at: number, key: 'from' | 'to', value: string) => set({ ...day, ranges: day.ranges.map((r, i) => (i === at ? { ...r, [key]: value } : r)) });
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
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          {day.ranges.map((range, at) => (
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
              {day.ranges.length > 1 && (
                <IconButton size="small" onClick={() => set({ ...day, ranges: day.ranges.filter((_, i) => i !== at) })} aria-label={t('Quitar el turno {index} del {day}', { index: at + 1, day: name })}>
                  <X size={14} />
                </IconButton>
              )}
            </Stack>
          ))}
          {day.ranges.length < MAX_RANGES && (
            <Button size="small" startIcon={<Plus size={14} />} onClick={() => set({ ...day, ranges: [...day.ranges, { from: '16:00', to: '20:00' }] })}>
              {t('Turno')}
            </Button>
          )}
        </Stack>
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
