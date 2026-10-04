import type { BusinessContact } from '@/lib/business/profile';
import { digitsOnly } from '@/lib/utils/phone';
import type { ContactActionsConfig } from '@/lib/catalog/settings';

/**
 * Registro de acciones de contacto. Para agregar una nueva (link externo,
 * formulario, reservación, compra): agregarla a contactActionsSchema y aquí.
 */
export type ContactActionType = keyof ContactActionsConfig;

export type ContactContext = {
  businessName: string;
  contact: BusinessContact;
  item?: { name: string; priceLabel: string | null; sku: string | null; url: string };
  catalogUrl: string;
};

export type ResolvedContactAction = {
  type: ContactActionType;
  label: string;
  href: string;
  external: boolean;
};

/** Reemplaza variables {producto}, {precio}, {sku}, {url}, {negocio}. */
export function fillTemplate(template: string, ctx: ContactContext): string {
  const vars: Record<string, string> = {
    producto: ctx.item?.name ?? ctx.businessName,
    precio: ctx.item?.priceLabel ?? '',
    sku: ctx.item?.sku ?? '',
    url: ctx.item?.url ?? ctx.catalogUrl,
    negocio: ctx.businessName,
  };
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type ActionDefinition<K extends ContactActionType> = {
  /** Devuelve null si falta el dato necesario (p. ej. no hay teléfono configurado). */
  resolve: (config: ContactActionsConfig[K], ctx: ContactContext) => Omit<ResolvedContactAction, 'type'> | null;
};

const DEFINITIONS: { [K in ContactActionType]: ActionDefinition<K> } = {
  whatsapp: {
    resolve: (config, ctx) => {
      const number = digitsOnly(ctx.contact.whatsapp).replace('+', '');
      if (!number) return null;
      const text = encodeURIComponent(fillTemplate(config.message, ctx));
      return { label: config.label, href: `https://wa.me/${number}?text=${text}`, external: true };
    },
  },
  phone: {
    resolve: (config, ctx) => {
      const number = digitsOnly(ctx.contact.phone || ctx.contact.whatsapp);
      return number ? { label: config.label, href: `tel:${number}`, external: false } : null;
    },
  },
  email: {
    resolve: (config, ctx) => {
      if (!ctx.contact.email) return null;
      const subject = encodeURIComponent(fillTemplate(config.subject, ctx));
      return { label: config.label, href: `mailto:${ctx.contact.email}?subject=${subject}`, external: false };
    },
  },
};

const ORDER: ContactActionType[] = ['whatsapp', 'phone', 'email'];

/** Acciones habilitadas y con datos suficientes, en orden de prioridad. */
export function resolveContactActions(config: ContactActionsConfig, ctx: ContactContext): ResolvedContactAction[] {
  return ORDER.flatMap((type) => {
    const actionConfig = config[type];
    if (!actionConfig.enabled) return [];
    const definition = DEFINITIONS[type] as ActionDefinition<typeof type>;
    const resolved = definition.resolve(actionConfig as never, ctx);
    return resolved ? [{ type, ...resolved }] : [];
  });
}
