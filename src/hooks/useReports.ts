import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Transaction, Account, Debt, SavingsGoal, Category } from '../types'

export interface CategorySummary {
  category: Category
  amount: number
  count: number
}

export interface ReportData {
  start: string
  end: string
  transactions: Transaction[]
  expenseByCategory: CategorySummary[]
  incomeByCategory: CategorySummary[]
  accounts: Account[]
  debts: Debt[]
  goals: SavingsGoal[]
  totalIncome: number
  totalExpense: number
  netBalance: number
}

export function useReports() {
  const { session } = useAuthStore()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async (start: string, end: string) => {
    if (!session) return
    setLoading(true)
    const userId = session.user.id

    const [txRes, accRes, debtRes, goalRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(name, icon)')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true }),
      supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true),
      supabase.from('debts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    const transactions = ((txRes.data as Transaction[]) ?? [])

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    const catExpMap: Record<string, CategorySummary> = {}
    const catIncMap: Record<string, CategorySummary> = {}
    for (const t of transactions) {
      if (!t.category) continue
      const map = t.type === 'expense' ? catExpMap : catIncMap
      const key = t.category_id
      if (!map[key]) map[key] = { category: t.category, amount: 0, count: 0 }
      map[key].amount += Number(t.amount)
      map[key].count++
    }
    const sortByAmount = (map: Record<string, CategorySummary>) =>
      Object.values(map).sort((a, b) => b.amount - a.amount)

    setData({
      start,
      end,
      transactions,
      expenseByCategory: sortByAmount(catExpMap),
      incomeByCategory: sortByAmount(catIncMap),
      accounts: (accRes.data as Account[]) ?? [],
      debts: (debtRes.data as Debt[]) ?? [],
      goals: (goalRes.data as SavingsGoal[]) ?? [],
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    })
    setLoading(false)
  }

  return { data, loading, generate }
}
