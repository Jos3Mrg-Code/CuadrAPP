import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Transaction, Debt, SavingsGoal, ScheduledPayment, PaymentFrequency, Category, Account } from '../types'

export type CalendarItem =
  | { kind: 'transaction'; tx: Transaction }
  | { kind: 'debt_due'; debt: Debt }
  | { kind: 'goal_deadline'; goal: SavingsGoal }
  | { kind: 'payment'; payment: ScheduledPayment; isNext: boolean }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Avanza un período con clamp al último día del mes destino (maneja 31→feb y cruce de año)
export function addPeriod(dateStr: string, freq: Exclude<PaymentFrequency, 'once'>): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  if (freq === 'weekly') return toStr(new Date(y, m - 1, day + 7, 12))
  const months = freq === 'monthly' ? 1 : 12
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate()
  return toStr(new Date(y, m - 1 + months, Math.min(day, lastDay), 12))
}

// Ocurrencias del pago dentro de [monthStart, monthEnd] (comparación lexicográfica de YYYY-MM-DD)
export function projectOccurrences(p: ScheduledPayment, monthStart: string, monthEnd: string): string[] {
  if (p.frequency === 'once') {
    return p.next_date >= monthStart && p.next_date <= monthEnd ? [p.next_date] : []
  }
  const dates: string[] = []
  let occ = p.next_date
  let guard = 0
  while (occ <= monthEnd && guard++ < 500) {
    if (occ >= monthStart) dates.push(occ)
    occ = addPeriod(occ, p.frequency)
  }
  return dates
}

export function useCalendar(year: number, month: number) {
  const { session } = useAuthStore()
  const [dayMap, setDayMap] = useState<Record<string, CalendarItem[]>>({})
  const [payments, setPayments] = useState<ScheduledPayment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchAll()
  }, [session, year, month])

  const fetchAll = async () => {
    setLoading(true)
    const userId = session!.user.id
    const monthStart = `${year}-${pad(month + 1)}-01`
    const monthEnd = toStr(new Date(year, month + 1, 0, 12))

    const [txRes, debtRes, goalRes, payRes, catRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*, category:categories(*)').eq('user_id', userId)
        .gte('date', monthStart).lte('date', monthEnd).order('created_at', { ascending: false }),
      supabase.from('debts').select('*').eq('user_id', userId).eq('is_paid', false).not('due_date', 'is', null),
      supabase.from('savings_goals').select('*').eq('user_id', userId).eq('is_completed', false).not('deadline', 'is', null),
      supabase.from('scheduled_payments').select('*, category:categories(*)').eq('user_id', userId).eq('is_active', true),
      supabase.from('categories').select('*').or(`user_id.eq.${userId},is_default.eq.true`).eq('type', 'expense').order('name'),
      supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true),
    ])

    const map: Record<string, CalendarItem[]> = {}
    const push = (key: string, item: CalendarItem) => {
      if (!map[key]) map[key] = []
      map[key].push(item)
    }

    ;((txRes.data as Transaction[]) ?? []).forEach(tx => push(tx.date, { kind: 'transaction', tx }))
    ;((debtRes.data as Debt[]) ?? []).forEach(d => {
      if (d.due_date! >= monthStart && d.due_date! <= monthEnd) push(d.due_date!, { kind: 'debt_due', debt: d })
    })
    ;((goalRes.data as SavingsGoal[]) ?? []).forEach(g => {
      if (g.deadline! >= monthStart && g.deadline! <= monthEnd) push(g.deadline!, { kind: 'goal_deadline', goal: g })
    })
    const pays = (payRes.data as ScheduledPayment[]) ?? []
    pays.forEach(p => {
      projectOccurrences(p, monthStart, monthEnd).forEach(dateStr =>
        push(dateStr, { kind: 'payment', payment: p, isNext: dateStr === p.next_date })
      )
    })

    setDayMap(map)
    setPayments(pays)
    setCategories((catRes.data as Category[]) ?? [])
    setAccounts((accRes.data as Account[]) ?? [])
    setLoading(false)
  }

  const addScheduledPayment = async (data: {
    name: string
    amount: number
    frequency: PaymentFrequency
    next_date: string
    category_id?: string
    account_id?: string
    color: string
    icon: string
  }) => {
    const { error } = await supabase.from('scheduled_payments').insert({
      ...data,
      user_id: session!.user.id,
    })
    if (error) throw error
    await fetchAll()
  }

  // Marca la ocurrencia actual como pagada: si tiene cuenta, crea la transacción de gasto
  // (espejando useTransactions.addTransaction: insert → delta balance → log) y avanza next_date
  const markOccurrencePaid = async (p: ScheduledPayment) => {
    if (p.account_id) {
      const { data: inserted, error } = await supabase.from('transactions').insert({
        user_id: session!.user.id,
        account_id: p.account_id,
        category_id: p.category_id ?? null,
        amount: p.amount,
        type: 'expense',
        description: p.name,
        date: p.next_date,
      }).select().single()
      if (error) throw error

      const { data: acc } = await supabase.from('accounts').select('balance').eq('id', p.account_id).single()
      await supabase.from('accounts').update({ balance: (acc?.balance ?? 0) - p.amount }).eq('id', p.account_id)
      await supabase.from('transaction_logs').insert({
        transaction_id: inserted.id,
        user_id: session!.user.id,
        action: 'created',
        snapshot: inserted,
        changes: null,
      })
    }

    const update = p.frequency === 'once'
      ? { is_active: false }
      : { next_date: addPeriod(p.next_date, p.frequency) }
    const { error: upErr } = await supabase.from('scheduled_payments').update(update).eq('id', p.id)
    if (upErr) throw upErr

    await fetchAll()
  }

  const deleteScheduledPayment = async (id: string) => {
    const { error } = await supabase.from('scheduled_payments').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  return {
    dayMap, payments, categories, accounts, loading,
    addScheduledPayment, markOccurrencePaid, deleteScheduledPayment, refresh: fetchAll,
  }
}
