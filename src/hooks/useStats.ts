import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Transaction, Category } from '../types'

export type StatsPeriod = '1m' | '3m' | '6m' | '1y'

export interface MonthlyData {
  label: string
  income: number
  expense: number
}

export interface CategoryStat {
  category: Category
  amount: number
  percentage: number
  count: number
}

export interface StatsData {
  totalIncome: number
  totalExpense: number
  netBalance: number
  avgDailyExpense: number
  monthlyData: MonthlyData[]
  topExpenseCategories: CategoryStat[]
  topIncomeCategories: CategoryStat[]
  biggestTransactions: (Transaction & { account: any; category: any })[]
}

function periodStart(period: StatsPeriod): string {
  const now = new Date()
  if (period === '1m') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  if (period === '3m') return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)
  if (period === '6m') return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString('es-CO', { month: 'short' })
}

export function useStats() {
  const { session } = useAuthStore()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<StatsPeriod>('1m')

  const fetch = async (p: StatsPeriod = period) => {
    if (!session) return
    setLoading(true)
    const start = periodStart(p)
    const end = new Date().toISOString().slice(0, 10)

    const { data: txs } = await supabase
      .from('transactions')
      .select('*, account:accounts(name, icon), category:categories(id, name, icon, color, type)')
      .eq('user_id', session.user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })

    const transactions = (txs ?? []) as any[]

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const netBalance = totalIncome - totalExpense

    const days = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
    const avgDailyExpense = totalExpense / days

    // Monthly breakdown
    const monthMap: Record<string, MonthlyData> = {}
    const now = new Date()
    const months = p === '1m' ? 1 : p === '3m' ? 3 : p === '6m' ? 6 : 12
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = { label: monthLabel(d.getFullYear(), d.getMonth()), income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const key = t.date.slice(0, 7)
      if (monthMap[key]) {
        if (t.type === 'income') monthMap[key].income += Number(t.amount)
        else monthMap[key].expense += Number(t.amount)
      }
    }
    const monthlyData = Object.values(monthMap)

    // Category stats
    const catExpMap: Record<string, CategoryStat> = {}
    const catIncMap: Record<string, CategoryStat> = {}
    for (const t of transactions) {
      if (!t.category) continue
      const map = t.type === 'expense' ? catExpMap : catIncMap
      const key = t.category_id
      if (!map[key]) map[key] = { category: t.category, amount: 0, percentage: 0, count: 0 }
      map[key].amount += Number(t.amount)
      map[key].count++
    }
    const calcPct = (map: Record<string, CategoryStat>, total: number) =>
      Object.values(map)
        .map(c => ({ ...c, percentage: total > 0 ? (c.amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6)

    setData({
      totalIncome,
      totalExpense,
      netBalance,
      avgDailyExpense,
      monthlyData,
      topExpenseCategories: calcPct(catExpMap, totalExpense),
      topIncomeCategories: calcPct(catIncMap, totalIncome),
      biggestTransactions: [...transactions].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
    })
    setLoading(false)
  }

  const changePeriod = (p: StatsPeriod) => {
    setPeriod(p)
    fetch(p)
  }

  return { data, loading, period, changePeriod, refresh: () => fetch(period) }
}
