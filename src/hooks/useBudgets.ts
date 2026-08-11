import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { planErrorMessage } from '../lib/plan'
import { Budget, Category } from '../types'

export interface BudgetWithProgress extends Budget {
  category: Category
  spent: number
  remaining: number
  percentage: number
}

function periodRange(period: 'monthly' | 'weekly') {
  const now = new Date()
  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { start, end }
  }
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) }
}

export function useBudgets() {
  const { session } = useAuthStore()
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch()
  }, [session])

  const fetch = async () => {
    setLoading(true)
    const { data: rawBudgets } = await supabase
      .from('budgets')
      .select('*, category:categories(*)')
      .eq('user_id', session!.user.id)
      .order('created_at', { ascending: true })

    if (!rawBudgets) { setBudgets([]); setLoading(false); return }

    const monthRange = periodRange('monthly')
    const weekRange = periodRange('weekly')

    const { data: txs } = await supabase
      .from('transactions')
      .select('category_id, amount, date')
      .eq('user_id', session!.user.id)
      .eq('type', 'expense')
      .gte('date', weekRange.start)
      .lte('date', monthRange.end)

    const result: BudgetWithProgress[] = (rawBudgets as any[]).map(b => {
      const range = b.period === 'monthly' ? monthRange : weekRange
      const spent = (txs ?? [])
        .filter(t => t.category_id === b.category_id && t.date >= range.start && t.date <= range.end)
        .reduce((s, t) => s + Number(t.amount), 0)
      const remaining = Math.max(0, b.amount - spent)
      const percentage = Math.min(100, (spent / b.amount) * 100)
      return { ...b, spent, remaining, percentage }
    })

    setBudgets(result)
    setLoading(false)
  }

  const addBudget = async (data: { category_id: string; amount: number; period: 'monthly' | 'weekly' }) => {
    const { error } = await supabase.from('budgets').insert({ ...data, user_id: session!.user.id })
    if (error) throw new Error(planErrorMessage(error, 'budgets') ?? error.message)
    await fetch()
  }

  const editBudget = async (id: string, amount: number) => {
    const { error } = await supabase.from('budgets').update({ amount }).eq('id', id)
    if (error) throw error
    await fetch()
  }

  const deleteBudget = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)

  return { budgets, loading, totalBudget, totalSpent, addBudget, editBudget, deleteBudget, refresh: fetch }
}
