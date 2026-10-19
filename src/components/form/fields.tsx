'use client';

import { FormControlLabel, MenuItem, Stack, Switch, TextField, Typography, type TextFieldProps } from '@mui/material';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useT } from '@/i18n/client';

type BaseProps<T extends FieldValues> = { control: Control<T>; name: FieldPath<T> };

/** TextField conectado a React Hook Form, con mensaje de error y ayuda. */
export function TextFieldControl<T extends FieldValues>({
  control,
  name,
  helperText,
  ...props
}: BaseProps<T> & Omit<TextFieldProps, 'name'>) {
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          {...field}
          value={field.value ?? ''}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ? t(fieldState.error.message) : helperText}
        />
      )}
    />
  );
}

type Option = { value: string; label: string };

export function SelectControl<T extends FieldValues>({
  control,
  name,
  options,
  ...props
}: BaseProps<T> & Omit<TextFieldProps, 'name' | 'select'> & { options: Option[] }) {
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          {...field}
          select
          value={field.value ?? ''}
          // Permite mostrar opciones con valor vacío (p. ej. "Sin categoría").
          slotProps={{ ...props.slotProps, inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ? t(fieldState.error.message) : props.helperText}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

/** Interruptor con etiqueta y descripción opcional. */
export function SwitchControl<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: BaseProps<T> & { label: string; description?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0, py: 0.5, gap: 1.25, width: '100%', justifyContent: 'space-between' }}
          labelPlacement="start"
          control={<Switch checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} sx={{ mt: 0.25 }} />}
          label={
            <Stack spacing={0.25}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
              {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
            </Stack>
          }
        />
      )}
    />
  );
}
