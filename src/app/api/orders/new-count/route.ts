import { NextResponse } from 'next/server';
import { countNewOrders } from '@/features/orders/inbox-queries';
import { getBusinessContext } from '@/lib/auth/session';

/** Pedidos nuevos del negocio activo, para el contador en el título de la pestaña del panel. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const count = ctx.siteKind === 'catalog' && ctx.features.orders ? await countNewOrders(ctx) : 0;
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
}
