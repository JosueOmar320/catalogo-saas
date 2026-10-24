import { NextResponse, type NextRequest } from 'next/server';
import { withFallback } from '@/features/assistant/server/fallback';
import { guardAssistantRequest, logAssistantError } from '@/features/assistant/server/guard';
import { getTaskModel } from '@/features/assistant/server/model';
import { writeWithModel, writeWithoutModel, type WriteContext } from '@/features/assistant/server/writer';
import { writeRequestSchema } from '@/lib/assistant/writer';
import { parseContact } from '@/lib/business/profile';
import { parseCatalogSettings } from '@/lib/catalog/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// El modelo tiene LLM_BUDGET_MS (si el principal tarda, responde el de respaldo o la versión sin IA).
export const maxDuration = 60;
const LLM_BUDGET_MS = 40_000;

/**
 * "Escribir con Garfield": propone textos para un campo de un formulario del
 * panel. No guarda nada: el usuario elige y guarda con el formulario.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardAssistantRequest(request, writeRequestSchema);
  if (!guarded.ok) return guarded.response;
  const { ctx, data, t } = guarded;

  // El negocio sale de la sesión (no del navegador); el ítem, del formulario sin guardar.
  const { data: categories } = await ctx.supabase.from('categories').select('name').eq('catalog_id', ctx.catalog.id).is('deleted_at', null).order('position').limit(12);
  const context: WriteContext = {
    kind: data.kind,
    current: data.current,
    instruction: data.instruction,
    language: parseCatalogSettings(ctx.catalog.settings).language,
    business: {
      name: ctx.business.name,
      slogan: ctx.business.slogan ?? '',
      description: (ctx.business.description ?? '').slice(0, 500),
      city: parseContact(ctx.business.contact).city,
      categories: (categories ?? []).map((c) => c.name),
    },
    item: data.item,
    review: data.review,
  };

  try {
    const { result, mode, notice } = await withFallback(getTaskModel(process.env, { budgetMs: LLM_BUDGET_MS }), (model) => writeWithModel(model, context), () => writeWithoutModel(context));
    if (result.length === 0) return NextResponse.json({ error: t('Me faltan datos para escribir algo útil. Completa el nombre o la descripción y vuelve a intentarlo.') }, { status: 422 });
    return NextResponse.json({ options: result, mode, notice: notice && t(notice) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logAssistantError('[assistant/write]', error);
    return NextResponse.json({ error: t('Garfield se enredó con la madeja. Intenta de nuevo.') }, { status: 500 });
  }
}
