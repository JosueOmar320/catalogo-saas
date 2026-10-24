import { NextResponse, type NextRequest } from 'next/server';
import { withFallback } from '@/features/assistant/server/fallback';
import { guardAssistantRequest, logAssistantError } from '@/features/assistant/server/guard';
import { helpWithModel, helpWithoutModel, type HelpContext } from '@/features/assistant/server/help';
import { getTaskModel } from '@/features/assistant/server/model';
import { helpRequestSchema } from '@/lib/assistant/panel-guide';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// El modelo tiene LLM_BUDGET_MS (si el principal tarda, responde el de respaldo o la versión sin IA).
export const maxDuration = 60;
const LLM_BUDGET_MS = 40_000;

/** Garfield en todo el panel: responde dónde y cómo se hace algo, con enlaces a las áreas del panel. */
export async function POST(request: NextRequest) {
  const guarded = await guardAssistantRequest(request, helpRequestSchema);
  if (!guarded.ok) return guarded.response;
  const { ctx, data, t, locale } = guarded;
  const context: HelpContext = { messages: data.messages, path: data.path, admin: ctx.isPlatformAdmin, locale, businessName: ctx.business.name, catalog: ctx.siteKind === 'catalog' };

  try {
    const { result, mode, notice } = await withFallback(getTaskModel(process.env, { budgetMs: LLM_BUDGET_MS }), (model) => helpWithModel(model, context), () => helpWithoutModel(context, t));
    return NextResponse.json({ ...result, message: notice ? `${t(notice)}\n\n${result.message}` : result.message, mode }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logAssistantError('[assistant/help]', error);
    return NextResponse.json({ error: t('Garfield se enredó con la madeja. Intenta de nuevo.') }, { status: 500 });
  }
}
