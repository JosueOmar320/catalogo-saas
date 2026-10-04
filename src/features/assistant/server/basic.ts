import { parseActions } from '@/lib/assistant/actions';
import { rulesRespond } from './rules';
import { ProviderError, QuotaExceededError, type AssistantModel, type ModelInput, type ModelResult } from './types';

/* ------------------------------------------------------------ Modo básico */

/** Sin IA: intérprete de reglas para los pedidos más comunes (respaldo y desarrollo). */
export class RulesModel implements AssistantModel {
  readonly mode = 'basic' as const;
  async respond({ messages, context }: ModelInput): Promise<ModelResult> {
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const result = rulesRespond(last, context);
    const { actions, errors } = parseActions(result.actions);
    return { ...result, actions, mode: this.mode, provider: 'basic', warnings: errors };
  }
}

/**
 * Si el proveedor de IA agota su cuota gratuita o no responde, Garfield
 * sigue en modo básico (y lo avisa) en lugar de mostrar un error.
 */
export class WithBasicFallback implements AssistantModel {
  readonly mode = 'ai' as const;
  private basic = new RulesModel();

  constructor(private primary: AssistantModel) {}

  async respond(input: ModelInput): Promise<ModelResult> {
    try {
      return await this.primary.respond(input);
    } catch (error) {
      const quota = error instanceof QuotaExceededError;
      const unavailable = error instanceof ProviderError && error.status >= 500;
      if (!quota && !unavailable) throw error;
      console.warn('[assistant] usando modo básico:', (error as Error).message);
      const result = await this.basic.respond(input);
      const notice = quota ? 'Por hoy se agotó mi cuota gratuita de IA, así que sigo en modo básico (entiendo pedidos directos).' : 'El servicio de IA no respondió; mientras tanto sigo en modo básico.';
      return { ...result, message: `${notice}\n\n${result.message}`, warnings: [...result.warnings, (error as Error).message] };
    }
  }
}
