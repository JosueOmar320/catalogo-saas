'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isLocale } from './config';
import { setLocaleCookie } from './server';

/** Cambia el idioma de la app: cookie (este navegador) + perfil (otros dispositivos). */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  const user = await getUser();
  if (user) {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').update({ locale }).eq('id', user.id);
    if (error) console.error('[i18n] no se pudo guardar el idioma en el perfil', { code: error.code });
  }
  revalidatePath('/', 'layout');
}
