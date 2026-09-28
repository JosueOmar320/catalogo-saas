import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Sólo rutas que necesitan sesión. El catálogo público queda fuera para que sea cacheable.
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/preview', '/preview/:path*', '/reset-password', '/login', '/signup', '/api/:path*'],
};
