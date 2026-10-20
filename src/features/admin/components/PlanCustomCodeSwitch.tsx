'use client';

import { Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { setPlanCustomCode } from '../actions';

/** Código propio para todo un plan (los negocios con decisión propia no cambian). */
export function PlanCustomCodeSwitch({ planId, planName, enabled }: { planId: string; planName: string; enabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <Switch
      checked={enabled}
      disabled={pending}
      onChange={(e) => run(() => setPlanCustomCode(planId, e.target.checked), { onSuccess: () => router.refresh() })}
      slotProps={{ input: { 'aria-label': t('Código propio en el plan {plan}', { plan: planName }) } }}
    />
  );
}
