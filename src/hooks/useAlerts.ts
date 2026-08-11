import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export type AlertSeverity = 'danger' | 'warning' | 'success' | 'info'

export interface AppAlert {
  id: string
  severity: AlertSeverity
  icon: string
  title: string
  body: string
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

export function useAlerts() {
  const { session } = useAuthStore()
  const [alerts, setAlerts] = useState<AppAlert[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const generated: AppAlert[] = []

    // Fetch budgets with spent amounts
    const { data: budgets } = await supabase
      .from('budgets')
      .select('*, category:categories(name, icon)')
      .eq('user_id', session.user.id)

    if (budgets) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
      const weekStart = (() => {
        const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return d.toISOString().slice(0, 10)
      })()
      const weekEnd = (() => {
        const d = new Date(now); d.setDate(now.getDate() + (6 - ((now.getDay() + 6) % 7))); return d.toISOString().slice(0, 10)
      })()

      const { data: txs } = await supabase
        .from('transactions')
        .select('category_id, amount, date')
        .eq('user_id', session.user.id)
        .eq('type', 'expense')
        .gte('date', weekStart)
        .lte('date', monthEnd)

      for (const b of budgets as any[]) {
        const range = b.period === 'monthly' ? { start: monthStart, end: monthEnd } : { start: weekStart, end: weekEnd }
        const spent = (txs ?? [])
          .filter((t: any) => t.category_id === b.category_id && t.date >= range.start && t.date <= range.end)
          .reduce((s: number, t: any) => s + Number(t.amount), 0)
        const pct = (spent / b.amount) * 100
        const periodLabel = b.period === 'monthly' ? 'este mes' : 'esta semana'

        if (pct >= 100) {
          generated.push({
            id: `budget-over-${b.id}`,
            severity: 'danger',
            icon: '🚨',
            title: `Presupuesto excedido`,
            body: `Gastaste más de lo planeado en ${b.category.name} ${periodLabel} ($${spent.toLocaleString('es-CO', { maximumFractionDigits: 0 })} de $${b.amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })})`,
          })
        } else if (pct >= 80) {
          generated.push({
            id: `budget-warn-${b.id}`,
            severity: 'warning',
            icon: '⚠️',
            title: `Cerca del límite`,
            body: `Llevas el ${Math.round(pct)}% de tu presupuesto de ${b.category.name} ${periodLabel}`,
          })
        }
      }
    }

    // Fetch goals
    // Sin filtro de is_completed: el bucle de abajo distingue completadas de
    // pendientes (antes el filtro dejaba muerta la rama de "meta completada")
    const { data: goals } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', session.user.id)

    if (goals) {
      for (const g of goals as any[]) {
        if (g.is_completed) {
          generated.push({ id: `goal-done-${g.id}`, severity: 'success', icon: '🎉', title: '¡Meta completada!', body: `Lograste tu meta "${g.name}"` })
        } else if (g.deadline) {
          const days = daysUntil(g.deadline)
          if (days < 0) {
            generated.push({ id: `goal-overdue-${g.id}`, severity: 'danger', icon: '❌', title: 'Meta vencida', body: `La meta "${g.name}" venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}` })
          } else if (days <= 7) {
            generated.push({ id: `goal-soon-${g.id}`, severity: 'warning', icon: '⏰', title: 'Meta por vencer', body: `"${g.name}" vence en ${days === 0 ? 'hoy' : `${days} día${days !== 1 ? 's' : ''}`}` })
          }
        }
      }
    }

    // Fetch accounts with negative balance
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .lt('balance', 0)

    if (accounts) {
      for (const a of accounts as any[]) {
        generated.push({
          id: `account-neg-${a.id}`,
          severity: 'warning',
          icon: '📉',
          title: 'Saldo negativo',
          body: `La cuenta "${a.name}" tiene saldo negativo`,
        })
      }
    }

    // Pagos programados próximos / vencidos.
    // Solo para premium: si no, se notificaría sobre una pantalla bloqueada.
    const { data: planRow } = await supabase
      .from('user_plans')
      .select('plan, expires_at')
      .eq('user_id', session.user.id)
      .maybeSingle()
    const isPremium = planRow?.plan === 'premium' &&
      (!planRow.expires_at || new Date(planRow.expires_at).getTime() > Date.now())

    const { data: payments } = isPremium
      ? await supabase
          .from('scheduled_payments')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
      : { data: null }

    if (payments) {
      for (const p of payments as any[]) {
        const days = daysUntil(p.next_date)
        const amountStr = `$${Number(p.amount).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
        if (days < 0) {
          generated.push({
            id: `payment-overdue-${p.id}`,
            severity: 'danger',
            icon: '📅',
            title: 'Pago vencido',
            body: `"${p.name}" (${amountStr}) venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`,
          })
        } else if (days <= 3) {
          generated.push({
            id: `payment-due-${p.id}`,
            severity: 'warning',
            icon: '💸',
            title: 'Pago próximo',
            body: `"${p.name}" (${amountStr}) vence ${days === 0 ? 'hoy' : `en ${days} día${days !== 1 ? 's' : ''}`}`,
          })
        }
      }
    }

    if (generated.length === 0) {
      generated.push({ id: 'all-good', severity: 'success', icon: '✅', title: '¡Todo en orden!', body: 'No tienes alertas pendientes. Sigue así.' })
    }

    setAlerts(generated)
    setLoading(false)
  }, [session])

  const dangerCount = alerts.filter(a => a.severity === 'danger').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length
  const badgeCount = alerts.filter(a => a.id !== 'all-good').length

  return { alerts, loading, badgeCount, dangerCount, warningCount, refresh }
}
