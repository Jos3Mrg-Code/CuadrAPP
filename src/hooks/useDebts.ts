import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Debt, Account, DebtType } from '../types'

export function useDebts() {
  const { session } = useAuthStore()
  const [debts, setDebts] = useState<Debt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchDebts()
  }, [session])

  const fetchDebts = async () => {
    setLoading(true)
    const [debtsRes, accRes] = await Promise.all([
      supabase.from('debts').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', session!.user.id).eq('is_active', true),
    ])
    setDebts((debtsRes.data as Debt[]) ?? [])
    setAccounts((accRes.data as Account[]) ?? [])
    setLoading(false)
  }

  const addDebt = async (data: {
    name: string
    debt_type: DebtType
    total_amount: number
    interest_rate?: number
    due_date?: string
    color: string
    icon: string
  }) => {
    const { error } = await supabase.from('debts').insert({
      ...data,
      user_id: session!.user.id,
      remaining_amount: data.total_amount,
    })
    if (error) throw error
    await fetchDebts()
  }

  const addPayment = async (debt: Debt, amount: number, accountId: string) => {
    // Verificar saldo suficiente
    const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
    if (!acc || acc.balance < amount) throw new Error('Saldo insuficiente en la cuenta seleccionada')

    // Actualizar deuda
    const newRemaining = Math.max(debt.remaining_amount - amount, 0)
    const isPaid = newRemaining <= 0
    const { error: debtError } = await supabase
      .from('debts')
      .update({ remaining_amount: newRemaining, is_paid: isPaid })
      .eq('id', debt.id)
    if (debtError) throw debtError

    // Descontar de la cuenta
    const { error: accError } = await supabase
      .from('accounts')
      .update({ balance: acc.balance - amount })
      .eq('id', accountId)
    if (accError) throw accError

    await fetchDebts()
  }

  const markAsPaid = async (id: string) => {
    const { error } = await supabase.from('debts').update({ remaining_amount: 0, is_paid: true }).eq('id', id)
    if (error) throw error
    await fetchDebts()
  }

  const deleteDebt = async (id: string) => {
    const { error } = await supabase.from('debts').delete().eq('id', id)
    if (error) throw error
    await fetchDebts()
  }

  const activeDebts = debts.filter(d => !d.is_paid)
  const totalDebt = debts.reduce((s, d) => s + d.total_amount, 0)
  const totalRemaining = activeDebts.reduce((s, d) => s + d.remaining_amount, 0)
  const activeCount = activeDebts.length
  const paidOffCount = debts.length - activeCount

  return {
    debts, accounts, loading, totalDebt, totalRemaining, activeCount, paidOffCount,
    addDebt, addPayment, markAsPaid, deleteDebt, refresh: fetchDebts,
  }
}
