'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Grid, Stack, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { SwitchControl, TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateContact } from '@/features/business/actions';
import { updateCatalogSettings } from '@/features/catalog/actions';
import { contactSchema, type BusinessContact } from '@/lib/business/profile';
import { contactActionsSchema, type ContactActionsConfig } from '@/lib/catalog/settings';
import { fillTemplate } from '@/lib/contact/actions';
import { useAction } from '@/lib/hooks/use-action';

export function ContactForm({ contact, actions, businessName }: { contact: BusinessContact; actions: ContactActionsConfig; businessName: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const contactForm = useForm<BusinessContact>({ resolver: zodResolver(contactSchema) as Resolver<BusinessContact>, defaultValues: contact });
  const actionsForm = useForm<ContactActionsConfig>({ resolver: zodResolver(contactActionsSchema) as Resolver<ContactActionsConfig>, defaultValues: actions });
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
      <SectionCard title="Datos de contacto" description="Se muestran en el pie de página y habilitan los botones de contacto.">
        <Box
          component="form"
          onSubmit={contactForm.handleSubmit((values) =>
            run(() => updateContact(values), { setError: contactForm.setError, onSuccess: () => { contactForm.reset(values); router.refresh(); } }),
          )}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="whatsapp" label="WhatsApp" placeholder="+52 55 1234 5678" helperText="Con código de país." /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="phone" label="Teléfono" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="email" label="Email" type="email" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextFieldControl control={contactForm.control} name="website" label="Sitio web" placeholder="https://" /></Grid>
            <Grid size={{ xs: 12, sm: 8 }}><TextFieldControl control={contactForm.control} name="address" label="Dirección" /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextFieldControl control={contactForm.control} name="city" label="Ciudad" /></Grid>
            <Grid size={12}><TextFieldControl control={contactForm.control} name="mapsUrl" label="Enlace de Google Maps" placeholder="https://maps.app.goo.gl/…" helperText="En Google Maps: Compartir → Copiar vínculo. Se usa para el botón de la dirección y para ubicar el pin del mapa." /></Grid>
            <Grid size={12}><TextFieldControl control={contactForm.control} name="hours" label="Horarios" multiline minRows={3} placeholder={'Lunes a viernes: 9:00 – 18:00\nSábado: 10:00 – 14:00'} /></Grid>
            <Grid size={12}><TextFieldControl control={contactForm.control} name="additionalInfo" label="Información adicional" multiline minRows={2} placeholder="Formas de pago, envíos, estacionamiento…" helperText="Se muestra en la sección de contacto y en el PDF." /></Grid>
          </Grid>
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
            <Button type="submit" variant="contained" disabled={pending || !contactForm.formState.isDirty}>Guardar contacto</Button>
          </Stack>
        </Box>
      </SectionCard>

      <SectionCard title="Botones de contacto" description="Qué acciones ven tus clientes en cada producto o servicio.">
        <Stack
          component="form"
          spacing={2}
          onSubmit={actionsForm.handleSubmit((values) =>
            run(() => updateCatalogSettings({ contactActions: values }), { onSuccess: () => { actionsForm.reset(values); router.refresh(); } }),
          )}
        >
          {!contact.whatsapp && whatsappEnabled && (
            <Alert severity="info">Agrega tu número de WhatsApp arriba para que este botón aparezca.</Alert>
          )}
          <Box>
            <SwitchControl control={actionsForm.control} name="whatsapp.enabled" label="WhatsApp" description="Abre un chat con un mensaje sobre el producto." />
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 5 }}><TextFieldControl control={actionsForm.control} name="whatsapp.label" label="Texto del botón" /></Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextFieldControl control={actionsForm.control} name="whatsapp.message" label="Mensaje" multiline minRows={2} helperText="Variables: {producto} {precio} {sku} {url} {negocio}" />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
              Ejemplo: {example}
            </Typography>
          </Box>
          <Box>
            <SwitchControl control={actionsForm.control} name="phone.enabled" label="Llamada" description="Usa el teléfono (o el WhatsApp si no hay teléfono)." />
            <TextFieldControl control={actionsForm.control} name="phone.label" label="Texto del botón" sx={{ mt: 1, maxWidth: 320 }} />
          </Box>
          <Box>
            <SwitchControl control={actionsForm.control} name="email.enabled" label="Email" />
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 5 }}><TextFieldControl control={actionsForm.control} name="email.label" label="Texto del botón" /></Grid>
              <Grid size={{ xs: 12, sm: 7 }}><TextFieldControl control={actionsForm.control} name="email.subject" label="Asunto" /></Grid>
            </Grid>
          </Box>
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !actionsForm.formState.isDirty}>Guardar botones</Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
