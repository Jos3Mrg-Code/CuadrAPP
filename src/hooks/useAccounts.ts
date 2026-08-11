import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { planErrorMessage } from '../lib/plan'
import { Account, AccountType } from '../types'

export function useAccounts() {
  const { session } = useAuthStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch()
  }, [session])

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', session!.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    setAccounts((data as Account[]) ?? [])
    setLoading(false)
  }

  const addAccount = async (data: {
    name: string
    type: AccountType
    balance: number
    color: string
    icon: string
  }) => {
    const { error } = await supabase.from('accounts').insert({
      ...data,
      user_id: session!.user.id,
    })
    // El límite del plan gratis lo aplica un trigger en la base: se traduce
    // el error de Postgres a algo legible (defensa en profundidad, por si el
    // conteo del cliente está desactualizado o alguien salta la UI).
    if (error) throw new Error(planErrorMessage(error, 'accounts') ?? error.message)
    await fetch()
  }

  const editAccount = async (id: string, data: { name: string; balance: number; color: string; icon: string }) => {
    const { error } = await supabase.from('accounts').update(data).eq('id', id)
    if (error) throw error
    await fetch()
  }

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', id)
    if (error) throw error
    await fetch()
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return { accounts, loading, totalBalance, addAccount, editAccount, deleteAccount, refresh: fetch }
}
