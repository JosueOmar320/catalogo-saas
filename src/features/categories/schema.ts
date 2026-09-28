import { z } from 'zod';

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(80),
  description: z.string().trim().max(500),
  imagePath: z.string().max(300).nullable(),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.input<typeof categoryFormSchema>;
