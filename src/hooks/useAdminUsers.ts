import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AdminUserRow, PlanTier } from '../types'

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin`

/** Fetch crudo en vez de functions.invoke para conservar el mensaje de error
 *  en español que devuelve la función. */
async function callAdmin<T>(body: object): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({} as any))
  if (!res.ok) throw new Error(payload?.error ?? `Error ${res.status}`)
  return payload as T
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { refresh() }, [])

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await callAdmin<{ users: AdminUserRow[] }>({ action: 'list_users' })
      setUsers(data.users ?? [])
    } catch (e: any) {
      setError(e.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const setPlan = async (userId: string, plan: PlanTier, expiresAt: string | null, note: string | null) => {
    await callAdmin({ action: 'set_plan', user_id: userId, plan, expires_at: expiresAt, note })
    await refresh()
  }

  const premiumCount = users.filter(u => u.plan === 'premium').length

  return {
    users,
    loading,
    error,
    premiumCount,
    freeCount: users.length - premiumCount,
    setPlan,
    refresh,
  }
}
