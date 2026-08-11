import { UserPlan } from '../types'

/** Debe coincidir EXACTAMENTE con public.enforce_free_limits() en el SQL. */
export const FREE_LIMITS = { accounts: 2, goals: 2, budgets: 2 } as const
export type LimitKind = keyof typeof FREE_LIMITS

export const PREMIUM_FEATURES = [
  {
    icon: '📅',
    title: 'Calendario financiero',
    body: 'Pagos programados, recordatorios automáticos y la proyección de tu mes día por día.',
  },
  {
    icon: '♾️',
    title: 'Sin límites',
    body: `Cuentas, metas y presupuestos ilimitados. El plan gratis permite ${FREE_LIMITS.accounts} de cada uno.`,
  },
  {
    icon: '🤖',
    title: 'Asistente financiero con IA',
    body: 'Próximamente. Preguntas sobre tus finanzas en español y respuestas con tus datos reales.',
  },
]

export function isPlanActive(plan: UserPlan | null): boolean {
  if (!plan || plan.plan !== 'premium') return false
  if (!plan.expires_at) return true
  return new Date(plan.expires_at).getTime() > Date.now()
}

export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
}

export function formatPlanDate(iso: string | null): string {
  if (!iso) return 'sin vencimiento'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

const LIMIT_LABEL: Record<LimitKind, string> = {
  accounts: 'cuentas',
  goals: 'metas',
  budgets: 'presupuestos',
}

/** Traduce el error del trigger/RLS a algo legible en vez de un mensaje de Postgres. */
export function planErrorMessage(e: any, kind?: LimitKind): string | null {
  const msg = String(e?.message ?? '')
  if (e?.code === '23514' || msg.includes('plan_limit_reached')) {
    const k = (e?.hint as LimitKind) ?? kind ?? 'accounts'
    return `El plan gratis permite hasta ${FREE_LIMITS[k]} ${LIMIT_LABEL[k]}. Actualiza a Premium para tenerlas ilimitadas.`
  }
  if (e?.code === '42501' || /row-level security/i.test(msg)) {
    return 'Esta función es parte del plan Premium.'
  }
  return null
}
