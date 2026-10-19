import { NextResponse, type NextRequest } from 'next/server';
import { linkSecret } from '@/features/notifications/catalog-review';
import { verifyUnsubscribeToken } from '@/lib/email/links';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Baja del aviso semanal sin iniciar sesión (el token firmado identifica a la
 * persona). Dos formas, ambas POST para que los escáneres de enlaces de los
 * correos no den de baja a nadie al "visitar" el enlace:
 *  · el botón de /baja (formulario) → vuelve a /baja?listo=1
 *  · la baja en un clic del cliente de correo (List-Unsubscribe-Post) → 200
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const fromPage = form?.get('source') === 'page';
  const token = (form?.get('token') as string | null) ?? request.nextUrl.searchParams.get('token');
  const userId = verifyUnsubscribeToken(token, linkSecret());

  if (!userId || !isServiceRoleConfigured()) {
    return fromPage ? NextResponse.redirect(new URL('/baja?error=1', request.url), 303) : new NextResponse('invalid', { status: 400 });
  }
  const { error } = await createAdminClient().from('profiles').update({ notify_catalog_review: false }).eq('id', userId);
  if (error) {
    console.error('[unsubscribe] no se pudo guardar', { code: error.code });
    return fromPage ? NextResponse.redirect(new URL('/baja?error=1', request.url), 303) : new NextResponse('error', { status: 500 });
  }
  return fromPage ? NextResponse.redirect(new URL('/baja?listo=1', request.url), 303) : new NextResponse('ok', { status: 200 });
}
