import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  email: z.email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72),
});

export const forgotPasswordSchema = z.object({ email: z.email('Email inválido') });

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72),
});

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;
