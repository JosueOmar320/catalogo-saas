import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Destino de los enlaces de email de Supabase (confirmación, recuperación).
 * Soporta el flujo con token_hash (plantillas recomendadas) y el flujo PKCE (?code=).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const supabase = await createClient();

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error('missing token') };

  if (error) {
    return NextResponse.redirect(new URL('/login?error=link', origin));
  }
  return NextResponse.redirect(new URL(safeNext, origin));
}
