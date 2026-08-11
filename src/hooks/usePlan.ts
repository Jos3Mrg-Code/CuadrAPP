import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { UserPlan } from '../types'
import { isPlanActive, daysLeft } from '../lib/plan'

/** El plan se carga una vez en _layout.tsx y vive en el store: cargarlo por
 *  pantalla haría parpadear la píldora PRO en usuarios premium. */
export function usePlan() {
  const { session, plan, setPlan } = useAuthStore()

  const refresh = useCallback(async () => {
    if (!session) return
    // Columnas explícitas: el cliente no tiene privilegio sobre `note`,
    // un select('*') fallaría con 42501.
    const { data } = await supabase
      .from('user_plans')
      .select('user_id, plan, expires_at, is_admin')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setPlan((data as UserPlan) ?? {
      user_id: session.user.id, plan: 'free', expires_at: null, is_admin: false,
    })
  }, [session])

  const isPremium = isPlanActive(plan)

  return {
    plan,
    loading: plan === null,
    isPremium,
    // Conveniencia de UI: la Edge Function re-verifica is_admin en el servidor.
    isAdmin: plan?.is_admin === true,
    expiresAt: plan?.expires_at ?? null,
    daysLeft: isPremium ? daysLeft(plan?.expires_at ?? null) : null,
    refresh,
  }
}
