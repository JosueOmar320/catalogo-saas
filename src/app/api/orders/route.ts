import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { noContent, readJsonBody } from '@/lib/api/beacon';
import { isSupabaseConfigured } from '@/lib/env';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';

/**
 * El sitio público avisa que un visitante envió su pedido por WhatsApp
 * (navigator.sendBeacon). Siempre se cuentan pedidos y productos; si el negocio
 * usa la bandeja de pedidos, llega también la copia del pedido (lo que dice el
 * mensaje: nombre si lo dio, entrega, productos, importes) y se guarda para el
 * negocio. La validación de fondo (negocio publicado, pedidos activos y bandeja
 * activa, productos de ese catálogo, precios de los contadores) la hace
 * record_order_v2 en la base; aquí se filtra la forma, el origen y el ritmo.
 *
 * Responde 204 aunque el pedido no cuente: el visitante no espera respuesta y
 * así tampoco sirve para averiguar qué negocios o productos existen.
 */
const text = (max: number) => z.string().max(max);
const amount = z.number().min(0).max(99_999_999).nullable();
const orderSchema = z.object({
  reference: z.string().regex(/^[A-Z0-9]{4,8}$/),
  customerName: text(80),
  // Opcional: los sitios en caché de antes de los clientes no lo mandan. La base lo normaliza.
  customerPhone: text(20).default(''),
  fulfillment: z.enum(['pickup', 'delivery', 'table', '']),
  address: text(300),
  zone: text(60),
  branch: text(60),
  table: text(20),
  when: text(40),
  payment: text(20),
  note: text(500),
  coupon: text(24),
  currency: text(3),
  subtotal: amount,
  discount: amount,
  deliveryFee: amount,
  tip: amount,
  total: amount,
  partial: z.boolean(),
  lines: z.array(z.object({ itemId: text(120), name: z.string().min(1).max(160), qty: z.number().int().min(1).max(99), unitPrice: amount, note: text(200) })).min(1).max(50),
});

const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  items: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(99) })).min(1).max(50),
  /** Copia para la bandeja (sólo si el negocio la usa). Si no es válida, se cuenta el pedido sin copia. */
  order: z.unknown().optional(),
});

// Con la copia del pedido: hasta 50 líneas con nombre y nota (~25 KB).
const MAX_BYTES = 32_000;
// Por IP y negocio: un visitante real no envía 20 pedidos en una hora.
const LIMIT = 20;
const WINDOW_SECONDS = 3600;

export async function POST(request: NextRequest) {
  const read = await readJsonBody(request, bodySchema, { maxBytes: MAX_BYTES });
  if (!read.ok) return read.response;
  const { body } = read;

  // Sin base (recién clonado, demo) no hay dónde contar.
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return noContent();
  if (!(await consumeRateLimit(`order:${await clientIp()}:${body.slug}`, LIMIT, WINDOW_SECONDS))) {
    return new NextResponse(null, { status: 429 });
  }

  const order = orderSchema.safeParse(body.order);
  const { error } = await createAdminClient().rpc('record_order_v2', { p_business_slug: body.slug, p_items: body.items, p_order: order.success ? (order.data as Json) : null });
  if (error) console.error('[orders] no se pudo registrar el pedido', { code: error.code });
  return noContent();
}
