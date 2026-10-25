'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, FormGroup, FormLabel, Grid, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { useFeatureEnabled } from '@/components/dashboard/DashboardContext';
import { SelectControl, SwitchControl, TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateCatalogSettings } from '@/features/catalog/actions';
import type { BusinessContact } from '@/lib/business/profile';
import { orderSchema, PAYMENT_METHODS, type OrderSettings } from '@/lib/catalog/settings';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { useAction } from '@/lib/hooks/use-action';
import { BranchesField } from './BranchesField';
import { CouponsField } from './CouponsField';
import { PromotionsField } from './PromotionsField';
import { TablesField } from './TablesField';
import { ZonesField } from './ZonesField';

const PAYMENT_LABELS = { cash: msg('Efectivo'), card: msg('Tarjeta'), transfer: msg('Transferencia'), link: msg('Enlace de pago') } as const;

const PARTS = [
  { id: 'recibir', label: msg('Recibir pedidos') },
  { id: 'entrega', label: msg('Entrega') },
  { id: 'cuando', label: msg('¿Para cuándo?') },
  { id: 'pago', label: msg('Pago y descuentos') },
] as const;

/**
 * Pedidos por WhatsApp, en su propia página: un solo formulario repartido en
 * tarjetas (recibir, entrega, para cuándo, pago y descuentos), un índice
 * arriba para saltar a cada una y una barra fija abajo cuando hay cambios
 * sin guardar.
 */
export function OrderSettingsForm({ contact, order, businessName, catalogUrl }: { contact: BusinessContact; order: OrderSettings; businessName: string; catalogUrl: string }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  // La bandeja de pedidos puede estar apagada para el negocio (la decide el administrador).
  const inboxAvailable = useFeatureEnabled('orders');
  const orderForm = useForm<OrderSettings>({ resolver: zodResolver(orderSchema) as Resolver<OrderSettings>, defaultValues: order });
  const orderEnabled = useWatch({ control: orderForm.control, name: 'enabled' });
  const branchCount = useWatch({ control: orderForm.control, name: 'branches' })?.length ?? 0;
  const deliveryEnabled = useWatch({ control: orderForm.control, name: 'delivery' });
  const pausedOrders = useWatch({ control: orderForm.control, name: 'paused' });
  const scheduling = useWatch({ control: orderForm.control, name: 'scheduling' });
  const money = { input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } };
  const dirty = orderForm.formState.isDirty;

  return (
    <Stack
      component="form"
      spacing={2.5}
      onSubmit={orderForm.handleSubmit((values) =>
        run(() => updateCatalogSettings({ order: values }), { onSuccess: () => { orderForm.reset(values); router.refresh(); } }),
      )}
    >
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} component="nav" aria-label={t('Secciones de pedidos')}>
        {PARTS.map((part) => (
          <Chip key={part.id} label={t(part.label)} variant="outlined" component="a" href={`#${part.id}`} clickable />
        ))}
      </Stack>

      <SectionCard id="recibir" title={t('Recibir pedidos')} description={t('Tus clientes arman una lista de productos con cantidades y te la envían por WhatsApp con el total.')}>
        <Stack spacing={2} sx={{ pb: 2 }}>
            {!contact.whatsapp && orderEnabled && branchCount === 0 && (
              <Alert severity="info">{t('Agrega tu número de WhatsApp en Contacto y horario (o el de tus sucursales) para recibir pedidos.')}</Alert>
            )}
            <SwitchControl
              control={orderForm.control}
              name="enabled"
              label={t('Recibir pedidos')}
              description={t('Los productos disponibles muestran "Agregar al pedido" en lugar del botón de contacto. Los servicios se siguen consultando.')}
            />
            <TextFieldControl control={orderForm.control} name="intro" label={t('Saludo del mensaje')} disabled={!orderEnabled} helperText={t('Primera línea del pedido. Variable: {negocio}')} />
            <SwitchControl control={orderForm.control} name="askName" label={t('Pedir el nombre del cliente')} description={t('Campo opcional en el pedido.')} />
            <SwitchControl
              control={orderForm.control}
              name="askPhone"
              label={t('Pedir el WhatsApp del cliente')}
              description={t('Campo opcional. Sólo se guarda en tu bandeja de pedidos (para tu lista de clientes y avisarle), no va en el mensaje.')}
            />
            {inboxAvailable && (
            <SwitchControl
              control={orderForm.control}
              name="inbox"
              label={t('Guardar los pedidos en el panel')}
              description={t('Cada pedido enviado queda en Pedidos para confirmarlo y darle seguimiento (al cliente se le avisa). Los datos del cliente se borran solos a los 180 días.')}
            />
            )}
            {inboxAvailable && (
            <SwitchControl
              control={orderForm.control}
              name="inboxStock"
              label={t('Descontar existencias al confirmar')}
              description={t('Al confirmar un pedido de la bandeja se restan las existencias de sus productos; si lo cancelas, se devuelven.')}
            />
            )}
            <SwitchControl
              control={orderForm.control}
              name="paused"
              label={t('Pausar pedidos')}
              description={t('Vacaciones o sin servicio: tus clientes ven el catálogo y un aviso, pero no pueden enviar pedidos.')}
            />
            {pausedOrders && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Controller
                    control={orderForm.control}
                    name="pausedUntil"
                    render={({ field }) => (
                      <TextField
                        type="date"
                        label={t('Hasta (opcional)')}
                        value={field.value}
                        // Se reanudan solos al terminar ese día, en la zona horaria de quien la programa.
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          orderForm.setValue('pauseTimeZone', event.target.value ? Intl.DateTimeFormat().resolvedOptions().timeZone : '', { shouldDirty: true });
                        }}
                        helperText={t('Vacío: hasta que la quites.')}
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextFieldControl control={orderForm.control} name="pauseMessage" label={t('Mensaje (opcional)')} placeholder={t('Volvemos el lunes con pan recién horneado.')} fullWidth />
                </Grid>
              </Grid>
            )}


        </Stack>
      </SectionCard>

      <SectionCard id="entrega" title={t('Entrega')} description={t('Cómo recibe su pedido el cliente y cuánto cuesta.')}>
        <Stack spacing={2} sx={{ pb: 2 }}>
            <SwitchControl control={orderForm.control} name="pickup" label={t('Recoger en el local')} description={t('El cliente pasa por su pedido.')} />
            <TablesField control={orderForm.control} catalogUrl={catalogUrl} businessName={businessName} />
            <BranchesField control={orderForm.control} />
            <SwitchControl control={orderForm.control} name="delivery" label={t('Envío a domicilio')} description={t('El cliente escribe su dirección al pedir.')} />
            {deliveryEnabled && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl control={orderForm.control} name="deliveryFee" label={t('Costo de envío')} inputMode="decimal" slotProps={money} helperText={t('Vacío: se confirma por WhatsApp. 0: gratis.')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl control={orderForm.control} name="freeDeliveryFrom" label={t('Envío gratis desde')} inputMode="decimal" slotProps={money} helperText={t('Opcional: monto del pedido.')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl control={orderForm.control} name="deliveryNote" label={t('Zona o tiempo de entrega')} placeholder={t('Sólo zona centro, 30–45 min')} />
                </Grid>
                <Grid size={12}>
                  <ZonesField control={orderForm.control} />
                </Grid>
              </Grid>
            )}
            <TextFieldControl
              control={orderForm.control}
              name="minimumOrder"
              label={t('Pedido mínimo')}
              inputMode="decimal"
              slotProps={money}
              helperText={t('Opcional: no se puede enviar un pedido menor.')}
              sx={{ maxWidth: { sm: 260 } }}
            />


        </Stack>
      </SectionCard>

      <SectionCard id="cuando" title={t('¿Para cuándo?')} description={t('Pedidos para más tarde o para otro día.')}>
        <Stack spacing={2} sx={{ pb: 2 }}>
            <SelectControl
              control={orderForm.control}
              name="scheduling"
              label={t('Pedir día y hora')}
              helperText={t('El cliente elige entre los horarios de tu negocio (Horario por día, arriba).')}
              options={[
                { value: 'off', label: t('No preguntar') },
                { value: 'optional', label: t('Opcional («lo antes posible» o un horario)') },
                { value: 'required', label: t('Obligatorio') },
              ]}
              sx={{ maxWidth: { sm: 420 } }}
            />
            {scheduling !== 'off' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <SelectControl
                    control={orderForm.control}
                    name="leadMinutes"
                    label={t('Tiempo de preparación')}
                    options={[0, 15, 30, 60, 120, 240, 1440, 2880].map((minutes) => ({
                      value: String(minutes),
                      label: minutes === 0 ? t('Sin espera') : minutes < 60 ? t('{count} min', { count: minutes }) : minutes < 1440 ? t('{count} h', { count: minutes / 60 }) : minutes === 1440 ? t('1 día') : t('{count} días', { count: minutes / 1440 }),
                    }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <SelectControl control={orderForm.control} name="scheduleDays" label={t('Hasta cuántos días antes')} options={[1, 2, 3, 7, 14, 30].map((days) => ({ value: String(days), label: days === 1 ? t('Sólo hoy') : t('{count} días', { count: days }) }))} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <SelectControl control={orderForm.control} name="slotMinutes" label={t('Cada')} options={['15', '30', '60'].map((m) => ({ value: m, label: t('{count} min', { count: m }) }))} />
                </Grid>
              </Grid>
            )}


        </Stack>
      </SectionCard>

      <SectionCard id="pago" title={t('Pago y descuentos')} description={t('Formas de pago, propina, promociones automáticas y cupones.')}>
        <Stack spacing={2} sx={{ pb: 2 }}>
            <Controller
              control={orderForm.control}
              name="payments"
              render={({ field }) => (
                <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                  <FormLabel component="legend" sx={{ typography: 'subtitle2', color: 'text.primary' }}>{t('Formas de pago')}</FormLabel>
                  <Typography variant="caption" color="text.secondary" component="p">{t('El cliente elige una al pedir (opcional).')}</Typography>
                  <FormGroup row>
                    {PAYMENT_METHODS.map((method) => (
                      <FormControlLabel
                        key={method}
                        label={t(PAYMENT_LABELS[method])}
                        control={
                          <Checkbox
                            checked={field.value.includes(method)}
                            onChange={(event) =>
                              field.onChange(event.target.checked ? PAYMENT_METHODS.filter((m) => m === method || field.value.includes(m)) : field.value.filter((m) => m !== method))
                            }
                          />
                        }
                      />
                    ))}
                  </FormGroup>
                </Box>
              )}
            />

          <SwitchControl control={orderForm.control} name="tips" label={t('Propina opcional')} description={t('El cliente puede dejar 10, 15 o 20 % de los productos; el mensaje la desglosa.')} />
          <PromotionsField control={orderForm.control} />
          <CouponsField control={orderForm.control} />
        </Stack>
      </SectionCard>

      {/* Con cambios sin guardar, la barra se queda fija abajo (esté donde esté la persona en la página); sin cambios, va al final. */}
      <Paper
        elevation={dirty ? 6 : 0}
        variant={dirty ? 'elevation' : 'outlined'}
        sx={{ position: dirty ? 'sticky' : 'static', bottom: 12, zIndex: 5, p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
        role="region"
        aria-label={t('Guardar pedidos')}
      >
        <Typography variant="body2" sx={{ flex: 1, minWidth: 160 }} color={dirty ? 'text.primary' : 'text.secondary'}>
          {dirty ? t('Tienes cambios sin guardar.') : t('Todo guardado.')}
        </Typography>
        <Button color="inherit" disabled={pending || !dirty} onClick={() => orderForm.reset()}>{t('Descartar')}</Button>
        <Button type="submit" variant="contained" disabled={pending || !dirty}>{t('Guardar pedidos')}</Button>
      </Paper>
    </Stack>
  );
}
