import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { planErrorMessage } from '../lib/plan'
import { SavingsGoal, Account } from '../types'

export function useGoals() {
  const { session } = useAuthStore()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchGoals()
  }, [session])

  const fetchGoals = async () => {
    setLoading(true)
    const [goalsRes, accRes] = await Promise.all([
      supabase.from('savings_goals').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', session!.user.id).eq('is_active', true),
    ])
    setGoals((goalsRes.data as SavingsGoal[]) ?? [])
    setAccounts((accRes.data as Account[]) ?? [])
    setLoading(false)
  }

  const addGoal = async (data: {
    name: string
    target_amount: number
    deadline?: string
    color: string
    icon: string
  }) => {
    const { error } = await supabase.from('savings_goals').insert({
      ...data,
      user_id: session!.user.id,
      current_amount: 0,
    })
    if (error) throw new Error(planErrorMessage(error, 'goals') ?? error.message)
    await fetchGoals()
  }

  const addContribution = async (goal: SavingsGoal, amount: number, accountId: string) => {
    // Verificar saldo suficiente
    const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
    if (!acc || acc.balance < amount) throw new Error('Saldo insuficiente en la cuenta seleccionada')

    // Actualizar meta
    const newAmount = Math.min(goal.current_amount + amount, goal.target_amount)
    const isCompleted = newAmount >= goal.target_amount
    const { error: goalError } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount, is_completed: isCompleted })
      .eq('id', goal.id)
    if (goalError) throw goalError

    // Descontar de la cuenta
    const { error: accError } = await supabase
      .from('accounts')
      .update({ balance: acc.balance - amount })
      .eq('id', accountId)
    if (accError) throw accError

    await fetchGoals()
  }

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) throw error
    await fetchGoals()
  }

  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const completed = goals.filter(g => g.is_completed).length

  return { goals, accounts, loading, totalSaved, totalTarget, completed, addGoal, addContribution, deleteGoal, refresh: fetchGoals }
}
