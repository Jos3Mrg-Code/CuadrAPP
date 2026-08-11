import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Transaction, Account } from '../types'

interface DashboardData {
  totalBalance: number
  monthIncome: number
  monthExpense: number
  recentTransactions: Transaction[]
  categoryExpenses: { name: string; value: number; color: string; icon: string }[]
  accounts: Account[]
}

const CATEGORY_COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444',
]

export function useDashboard() {
  const { session } = useAuthStore()
  const [data, setData] = useState<DashboardData>({
    totalBalance: 0,
    monthIncome: 0,
    monthExpense: 0,
    recentTransactions: [],
    categoryExpenses: [],
    accounts: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchDashboard()
  }, [session])

  const fetchDashboard = async () => {
    setLoading(true)
    const userId = session!.user.id
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    const [accountsRes, transactionsRes, monthRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true),
      supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(5),
      supabase
        .from('transactions')
        .select('amount, type, category:categories(name, color, icon)')
        .eq('user_id', userId)
        .gte('date', firstOfMonth),
    ])

    const accounts: Account[] = accountsRes.data ?? []
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

    const monthTx = monthRes.data ?? []
    const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    // Agrupar gastos por categoría
    const catMap: Record<string, { value: number; color: string; icon: string }> = {}
    monthTx.filter(t => t.type === 'expense').forEach((t, i) => {
      const name = (t.category as any)?.name ?? 'Otros'
      const color = (t.category as any)?.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]
      const icon = (t.category as any)?.icon ?? '💸'
      if (!catMap[name]) catMap[name] = { value: 0, color, icon }
      catMap[name].value += t.amount
    })

    const categoryExpenses = Object.entries(catMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    setData({
      totalBalance,
      monthIncome,
      monthExpense,
      recentTransactions: (transactionsRes.data as Transaction[]) ?? [],
      categoryExpenses,
      accounts,
    })
    setLoading(false)
  }

  return { ...data, loading, refresh: fetchDashboard }
}
