import { z } from 'zod';
import { msg } from '@/i18n/translate';

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, msg('Escribe un nombre')).max(80),
  description: z.string().trim().max(500),
  imagePath: z.string().max(300).nullable(),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.input<typeof categoryFormSchema>;
