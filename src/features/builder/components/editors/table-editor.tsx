'use client';

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowLeft, ArrowRight, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { TABLE_MAX_COLUMNS, TABLE_MAX_ROWS } from '@/lib/site/section-schemas';
import { addTableColumn, moveTableColumn, parseTablePaste, removeTableColumn } from '@/lib/site/table';
import { Group, ListEditor, Segmented, SwitchRow, TextInput } from '../controls';
import { Heading, useContent, type EditorProps } from './content-editors';

/** Pegar una tabla desde Excel, Google Sheets o un CSV (reemplaza la actual). */
function PasteDialog({ open, onClose, onPaste }: { open: boolean; onClose: () => void; onPaste: (text: string, header: boolean) => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const [header, setHeader] = useState(true);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('Pegar desde Excel o Google Sheets')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('Copia las celdas en tu hoja de cálculo y pégalas aquí (también sirve un CSV). Reemplaza la tabla actual.')}</Typography>
        <TextField autoFocus fullWidth multiline minRows={8} value={text} onChange={(e) => setText(e.target.value)} label={t('Celdas copiadas')} slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'ui-monospace, monospace', fontSize: 13 } } }} />
        <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={header} onChange={(e) => setHeader(e.target.checked)} />} label={t('La primera fila son los títulos de las columnas')} />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={!text.trim()} onClick={() => { onPaste(text, header); setText(''); }}>{t('Usar estas celdas')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function TableEditor(props: EditorProps<'table'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  const [paste, setPaste] = useState(false);
  const table = { columns: c.columns, rows: c.rows };
  const setTable = (next: typeof table) => set(next);
  const columnName = (i: number) => c.columns[i]?.label || t('Columna {n}', { n: i + 1 });

  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Columnas')} description={t('Los títulos de arriba. Números y precios se ven mejor alineados a la derecha.')}>
        <Button size="small" variant="outlined" startIcon={<ClipboardPaste size={14} />} onClick={() => setPaste(true)} sx={{ alignSelf: 'flex-start' }}>{t('Pegar desde Excel o Google Sheets')}</Button>
        {c.columns.map((column, i) => (
          <Stack key={column.id} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <TextField size="small" fullWidth label={t('Columna {n}', { n: i + 1 })} value={column.label} onChange={(e) => setTable({ ...table, columns: c.columns.map((col, j) => (j === i ? { ...col, label: e.target.value.slice(0, 80) } : col)) })} />
            <TextField select size="small" value={column.align} onChange={(e) => setTable({ ...table, columns: c.columns.map((col, j) => (j === i ? { ...col, align: e.target.value as typeof col.align } : col)) })} sx={{ width: 108, flexShrink: 0 }} slotProps={{ htmlInput: { 'aria-label': t('Alineación de {column}', { column: columnName(i) }) } }}>
              <MenuItem value="left">{t('Izquierda')}</MenuItem>
              <MenuItem value="center">{t('Centro')}</MenuItem>
              <MenuItem value="right">{t('Derecha')}</MenuItem>
            </TextField>
            <Tooltip title={t('Mover a la izquierda')}><span><IconButton size="small" disabled={i === 0} onClick={() => setTable(moveTableColumn(table, i, i - 1))} aria-label={t('Mover {column} a la izquierda', { column: columnName(i) })}><ArrowLeft size={14} /></IconButton></span></Tooltip>
            <Tooltip title={t('Mover a la derecha')}><span><IconButton size="small" disabled={i === c.columns.length - 1} onClick={() => setTable(moveTableColumn(table, i, i + 1))} aria-label={t('Mover {column} a la derecha', { column: columnName(i) })}><ArrowRight size={14} /></IconButton></span></Tooltip>
            <Tooltip title={t('Quitar columna')}><span><IconButton size="small" disabled={c.columns.length <= 1} onClick={() => setTable(removeTableColumn(table, i))} aria-label={t('Quitar la columna {column}', { column: columnName(i) })}><Trash2 size={14} /></IconButton></span></Tooltip>
          </Stack>
        ))}
        {c.columns.length < TABLE_MAX_COLUMNS && (
          <Button variant="outlined" color="inherit" startIcon={<Plus size={14} />} onClick={() => setTable(addTableColumn(table, t('Nueva columna')))}>{t('Agregar columna')}</Button>
        )}
      </Group>
      <Group title={t('Filas')}>
        <ListEditor
          items={c.rows}
          onChange={(rows) => set({ rows })}
          create={() => ({ id: crypto.randomUUID(), cells: c.columns.map(() => '') })}
          addLabel={t('Agregar fila')}
          max={TABLE_MAX_ROWS}
          itemTitle={(row, index) => row.cells[0] || t('Fila {n}', { n: index + 1 })}
          renderItem={(row, update) => (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
              {c.columns.map((column, i) => (
                <TextField key={column.id} size="small" label={columnName(i)} value={row.cells[i] ?? ''} onChange={(e) => update({ ...row, cells: c.columns.map((_, j) => (j === i ? e.target.value.slice(0, 300) : (row.cells[j] ?? ''))) })} />
              ))}
            </Box>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Estilo')} value={c.variant} onChange={(variant) => set({ variant })} options={[{ value: 'simple', label: t('Simple') }, { value: 'striped', label: t('Rayas') }, { value: 'bordered', label: t('Bordes') }]} />
        <Segmented label={t('Encabezado')} value={c.header} onChange={(header) => set({ header })} options={[{ value: 'accent', label: t('Color') }, { value: 'dark', label: t('Oscuro') }, { value: 'plain', label: t('Sin fondo') }]} />
        <TextField select size="small" label={t('Columna destacada')} value={c.highlight} onChange={(e) => set({ highlight: Number(e.target.value) })} helperText={t('Por ejemplo, el plan recomendado.')}>
          <MenuItem value={0}>{t('Ninguna')}</MenuItem>
          {c.columns.map((column, i) => <MenuItem key={column.id} value={i + 1}>{columnName(i)}</MenuItem>)}
        </TextField>
        <SwitchRow label={t('La primera columna nombra cada fila')} description={t('En negritas y fija al deslizar en celular.')} checked={c.rowHeaders} onChange={(rowHeaders) => set({ rowHeaders })} />
        <SwitchRow label={t('Compacta')} checked={c.compact} onChange={(compact) => set({ compact })} />
        <Segmented label={t('En celular')} value={c.mobile} onChange={(mobile) => set({ mobile })} options={[{ value: 'scroll', label: t('Deslizar') }, { value: 'cards', label: t('Tarjetas') }]} />
        <TextInput label={t('Nota debajo de la tabla')} value={c.note} placeholder={t('ej. Precios en MXN, IVA incluido')} onChange={(note) => set({ note })} maxLength={200} />
      </Group>
      <PasteDialog
        open={paste}
        onClose={() => setPaste(false)}
        onPaste={(text, header) => {
          const parsed = parseTablePaste(text, { header });
          if (parsed) setTable(parsed);
          setPaste(false);
        }}
      />
    </>
  );
}
