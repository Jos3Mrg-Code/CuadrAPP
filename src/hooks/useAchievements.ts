import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import {
  ACHIEVEMENTS, bogotaDay, shiftDay, computeStreak, closedMonths,
  countPositiveMonths, countRespectedMonths, levelFor,
} from '../lib/achievements'
import { AchievementDef, AchievementStats, AchievementView, UnlockedAchievement } from '../types'

const STREAK_WINDOW_DAYS = 400  // cubre streak_100 y acota el payload

export function useAchievements() {
  const { session } = useAuthStore()
  const [stats, setStats] = useState<AchievementStats | null>(null)
  const [items, setItems] = useState<AchievementView[]>([])
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchAll()
  }, [session])

  const fetchAll = async () => {
    setLoading(true)
    const uid = session!.user.id
    const today = bogotaDay()
    const streakFrom = `${shiftDay(today, -STREAK_WINDOW_DAYS)}T00:00:00Z`
    const months = closedMonths(today, 3)

    const [txCount, txDays, txMonths, accRes, goalRes, budgetRes, unlockedRes, debtRes] = await Promise.all([
      supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('transactions').select('created_at').eq('user_id', uid)
        .gte('created_at', streakFrom).order('created_at', { ascending: true }),
      supabase.from('transactions').select('amount, type, category_id, date').eq('user_id', uid)
        .gte('date', months[months.length - 1].start).lte('date', months[0].end),
      supabase.from('accounts').select('id').eq('user_id', uid),
      supabase.from('savings_goals').select('current_amount, is_completed').eq('user_id', uid),
      supabase.from('budgets').select('category_id, amount, period, created_at').eq('user_id', uid),
      supabase.from('achievements').select('code, unlocked_at').eq('user_id', uid),
      supabase.from('debts').select('is_paid').eq('user_id', uid),
    ])

    const streak = computeStreak(((txDays.data ?? []) as { created_at: string }[]).map(r => r.created_at))
    const goals = (goalRes.data ?? []) as { current_amount: number; is_completed: boolean }[]
    const debts = (debtRes.data ?? []) as { is_paid: boolean }[]
    const monthTxs = (txMonths.data ?? []) as any[]
    const budgets = (budgetRes.data ?? []) as any[]

    const nextStats: AchievementStats = {
      totalTransactions: txCount.count ?? 0,
      activeDays: streak.activeDays,
      currentStreak: streak.current,
      bestStreak: streak.best,
      streakActiveToday: streak.activeToday,
      accountsCount: (accRes.data ?? []).length,
      goalsCount: goals.length,
      goalsCompleted: goals.filter(g => g.is_completed).length,
      totalSaved: goals.reduce((s, g) => s + Number(g.current_amount), 0),
      budgetsCount: budgets.length,
      budgetRespectedMonths: countRespectedMonths(months, budgets, monthTxs),
      positiveMonths: countPositiveMonths(months, monthTxs),
      debtsCount: debts.length,
      debtsPaid: debts.filter(d => d.is_paid).length,
    }

    // Trinquete: la tabla es la verdad, check() solo dispara la inserción la primera vez
    let unlockedRows = (unlockedRes.data ?? []) as UnlockedAchievement[]
    const already = new Set(unlockedRows.map(r => r.code))
    const missing = ACHIEVEMENTS.filter(a => !already.has(a.code) && a.check(nextStats))

    if (missing.length > 0) {
      await supabase.from('achievements').upsert(
        missing.map(a => ({ user_id: uid, code: a.code })),
        { onConflict: 'user_id,code', ignoreDuplicates: true },
      )
      // Refetch: unlocked_at lo pone el servidor, no se adivina en el cliente
      const { data: fresh } = await supabase
        .from('achievements').select('code, unlocked_at').eq('user_id', uid)
      if (fresh) unlockedRows = fresh as UnlockedAchievement[]
    }

    const byCode = new Map(unlockedRows.map(r => [r.code, r.unlocked_at]))
    const newCodes = new Set(missing.map(a => a.code))

    setItems(ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: byCode.has(a.code),   // de la tabla, NO de check(): monótono
      unlockedAt: byCode.get(a.code) ?? null,
      isNew: newCodes.has(a.code),
    })))
    setNewlyUnlocked(missing)
    setStats(nextStats)
    setLoading(false)
  }

  const xp = items.filter(i => i.unlocked).reduce((s, i) => s + i.points, 0)

  return {
    stats,
    items,
    newlyUnlocked,
    loading,
    xp,
    levelInfo: levelFor(xp),
    unlockedCount: items.filter(i => i.unlocked).length,
    totalCount: items.length,
    refresh: fetchAll,
  }
}
