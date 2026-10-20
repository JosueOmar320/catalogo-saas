'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Checkbox, Divider, FormControlLabel, FormGroup, FormLabel, Grid, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { SelectControl, SwitchControl, TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateContact } from '@/features/business/actions';
import { updateCatalogSettings } from '@/features/catalog/actions';
import { contactSchema, type BusinessContact } from '@/lib/business/profile';
import { contactActionsSchema, orderSchema, PAYMENT_METHODS, type ContactActionsConfig, type OrderSettings } from '@/lib/catalog/settings';
import { fillTemplate } from '@/lib/contact/actions';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { CouponsField } from './CouponsField';
import { BranchesField } from './BranchesField';
import { TablesField } from './TablesField';
import { ZonesField } from './ZonesField';
import { ScheduleField } from './ScheduleField';
import { msg } from '@/i18n/translate';

const PAYMENT_LABELS = { cash: msg('Efectivo'), card: msg('Tarjeta'), transfer: msg('Transferencia'), link: msg('Enlace de pago') } as const;

export function ContactForm({ contact, actions, order, businessName, catalogUrl }: { contact: BusinessContact; actions: ContactActionsConfig; order: OrderSettings; businessName: string; catalogUrl: string }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const contactForm = useForm<BusinessContact>({ resolver: zodResolver(contactSchema) as Resolver<BusinessContact>, defaultValues: contact });
  const actionsForm = useForm<ContactActionsConfig>({ resolver: zodResolver(contactActionsSchema) as Resolver<ContactActionsConfig>, defaultValues: actions });
  const orderForm = useForm<OrderSettings>({ resolver: zodResolver(orderSchema) as Resolver<OrderSettings>, defaultValues: order });
  const orderEnabled = useWatch({ control: orderForm.control, name: 'enabled' });
  const branchCount = useWatch({ control: orderForm.control, name: 'branches' })?.length ?? 0;
  const scheduleEnabled = useWatch({ control: contactForm.control, name: 'schedule.enabled' });
  const deliveryEnabled = useWatch({ control: orderForm.control, name: 'delivery' });
  const pausedOrders = useWatch({ control: orderForm.control, name: 'paused' });
  const scheduling = useWatch({ control: orderForm.control, name: 'scheduling' });
  const money = { input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } };
  const message = useWatch({ control: actionsForm.control, name: 'whatsapp.message' });
  const whatsappEnabled = useWatch({ control: actionsForm.control, name: 'whatsapp.enabled' });

  const example = fillTemplate(message ?? '', {
    businessName,
    contact,
    catalogUrl: '',
    item: { name: 'Croissant', priceLabel: '$48', sku: 'PAN-001', url: 'https://…/p/croissant' },
  });

  return (
    <Stack spacing={2.5}>
      <SectionCard title={t('Datos de contacto')} description={t('Se muestran en el pie de página y habilitan los botones de contacto.')}>
        <Box
          component="form"
          onSubmit={contactForm.handleSubmit((values) =>
            run(() => updateContact(values), { setError: contactForm.setError, onSuccess: () => { contactForm.reset(values); router.refresh(); } }),
          )}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="whatsapp" label="WhatsApp" placeholder="+52 55 1234 5678" helperText={t('Con código de país.')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="phone" label={t('Teléfono')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="email" label="Email" type="email" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="website" label={t('Sitio web')} placeholder="https://" /></Grid>
            <Grid size={{ xs: 12, sm: 8 }}><TextFieldControl control={contactForm.control} name="address" label={t('Dirección')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextFieldControl control={contactForm.control} name="city" label={t('Ciudad')} /></Grid>
            <Grid size={12}><TextFieldControl control={contactForm.control} name="mapsUrl" label={t('Enlace de Google Maps')} placeholder="https://maps.app.goo.gl/…" helperText={t('En Google Maps: Compartir → Copiar vínculo. Se usa para el botón de la dirección y para ubicar el pin del mapa.')} /></Grid>
            <Grid size={12}><ScheduleField form={contactForm} /></Grid>
            <Grid size={12}>
              {scheduleEnabled ? (
                <TextFieldControl control={contactForm.control} name="hours" label={t('Notas del horario (opcional)')} multiline minRows={2} placeholder={t('Días festivos: 9:00 – 14:00')} />
              ) : (
                <TextFieldControl control={contactForm.control} name="hours" label={t('Horarios')} multiline minRows={3} placeholder={t('Lunes a viernes: 9:00 – 18:00\nSábado: 10:00 – 14:00')} />
              )}
            </Grid>
            <Grid size={12}><TextFieldControl control={contactForm.control} name="additionalInfo" label={t('Información adicional')} multiline minRows={2} placeholder={t('Formas de pago, envíos, estacionamiento…')} helperText={t('Se muestra en la sección de contacto y en el PDF.')} /></Grid>
          </Grid>
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
            <Button type="submit" variant="contained" disabled={pending || !contactForm.formState.isDirty}>{t('Guardar contacto')}</Button>
          </Stack>
        </Box>
      </SectionCard>

      <SectionCard title={t('Botones de contacto')} description={t('Qué acciones ven tus clientes en cada producto o servicio.')}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={actionsForm.handleSubmit((values) =>
            run(() => updateCatalogSettings({ contactActions: values }), { onSuccess: () => { actionsForm.reset(values); router.refresh(); } }),
          )}
        >
          {!contact.whatsapp && whatsappEnabled && (
            <Alert severity="info">{t('Agrega tu número de WhatsApp arriba para que este botón aparezca.')}</Alert>
          )}
          <Box>
            <SwitchControl control={actionsForm.control} name="whatsapp.enabled" label="WhatsApp" description={t('Abre un chat con un mensaje sobre el producto.')} />
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 5 }}><TextFieldControl control={actionsForm.control} name="whatsapp.label" label={t('Texto del botón')} /></Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextFieldControl control={actionsForm.control} name="whatsapp.message" label={t('Mensaje')} multiline minRows={2} helperText={t('Variables: {producto} {precio} {sku} {url} {negocio}')} />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
              {t('Ejemplo: {example}', { example })}
            </Typography>
          </Box>
          <Box>
            <SwitchControl control={actionsForm.control} name="phone.enabled" label={t('Llamada')} description={t('Usa el teléfono (o el WhatsApp si no hay teléfono).')} />
            <TextFieldControl control={actionsForm.control} name="phone.label" label={t('Texto del botón')} sx={{ mt: 1, maxWidth: 320 }} />
          </Box>
          <Box>
            <SwitchControl control={actionsForm.control} name="email.enabled" label="Email" />
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 5 }}><TextFieldControl control={actionsForm.control} name="email.label" label={t('Texto del botón')} /></Grid>
              <Grid size={{ xs: 12, sm: 7 }}><TextFieldControl control={actionsForm.control} name="email.subject" label={t('Asunto')} /></Grid>
            </Grid>
          </Box>
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !actionsForm.formState.isDirty}>{t('Guardar botones')}</Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title={t('Pedidos por WhatsApp')} description={t('Tus clientes arman una lista de productos con cantidades y te la envían por WhatsApp con el total.')}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={orderForm.handleSubmit((values) =>
            run(() => updateCatalogSettings({ order: values }), { onSuccess: () => { orderForm.reset(values); router.refresh(); } }),
          )}
        >
          {!contact.whatsapp && orderEnabled && branchCount === 0 && (
            <Alert severity="info">{t('Agrega tu número de WhatsApp arriba (o el de tus sucursales) para recibir pedidos.')}</Alert>
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

          <Divider />
          <Typography variant="subtitle2">{t('Entrega')}</Typography>
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

          <Divider />
          <Typography variant="subtitle2">{t('¿Para cuándo?')}</Typography>
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

          <Divider />
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
          <Divider />
          <CouponsField control={orderForm.control} />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !orderForm.formState.isDirty}>{t('Guardar pedidos')}</Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
