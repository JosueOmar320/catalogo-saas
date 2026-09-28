'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, IconButton, MenuItem, Stack, TextField } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { SocialIcon } from '@/components/SocialIcon';
import { TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateSocialLinks } from '@/features/business/actions';
import { socialLinksSchema, type SocialLink } from '@/lib/business/profile';
import { useAction } from '@/lib/hooks/use-action';
import { SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS } from '@/lib/social/networks';

const formSchema = z.object({ links: socialLinksSchema });
type FormValues = { links: SocialLink[] };

export function SocialLinksForm({ links }: { links: SocialLink[] }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { links } });
  const { fields, append, remove } = useFieldArray({ control, name: 'links' });
  const watchedLinks = useWatch({ control, name: 'links' });
  const used = new Set(watchedLinks.map((l) => l.network));

  return (
    <SectionCard title="Redes sociales" description="Se muestran como íconos en el encabezado y el pie del catálogo.">
      <Stack
        component="form"
        spacing={1.5}
        onSubmit={handleSubmit((values) => run(() => updateSocialLinks(values.links), { onSuccess: () => { reset(values); router.refresh(); } }))}
      >
        {fields.map((field, index) => (
          <Stack key={field.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Controller
              control={control}
              name={`links.${index}.network`}
              render={({ field: f }) => (
                <TextField select value={f.value} onChange={f.onChange} sx={{ width: 180, flexShrink: 0 }} slotProps={{ htmlInput: { 'aria-label': 'Red social' } }}>
                  {SOCIAL_NETWORK_IDS.map((id) => (
                    <MenuItem key={id} value={id}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <SocialIcon network={id} size={15} />
                        <span>{SOCIAL_NETWORKS[id].label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextFieldControl control={control} name={`links.${index}.url`} placeholder={SOCIAL_NETWORKS[watchedLinks[index]?.network ?? 'website'].placeholder} slotProps={{ htmlInput: { 'aria-label': 'URL' } }} />
            <IconButton onClick={() => remove(index)} aria-label="Quitar" sx={{ mt: 0.5 }}>
              <Trash2 size={16} />
            </IconButton>
          </Stack>
        ))}
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Button
            color="inherit"
            startIcon={<Plus size={15} />}
            disabled={fields.length >= 12}
            onClick={() => append({ network: SOCIAL_NETWORK_IDS.find((id) => !used.has(id)) ?? 'website', url: '' })}
          >
            Agregar red
          </Button>
          <Button type="submit" variant="contained" disabled={pending || !formState.isDirty}>Guardar</Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
