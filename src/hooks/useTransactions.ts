import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Transaction, Category, Account } from '../types'

export interface TransactionLog {
  id: string
  transaction_id: string
  action: 'created' | 'edited' | 'deleted'
  snapshot: Partial<Transaction>
  changes: Record<string, { from: any; to: any }> | null
  created_at: string
}

export function useTransactions() {
  const { session } = useAuthStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchAll()
  }, [session])

  const fetchAll = async () => {
    setLoading(true)
    const userId = session!.user.id
    const [txRes, catRes, accRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${userId},is_default.eq.true`)
        .order('name'),
      supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true),
    ])
    setTransactions((txRes.data as Transaction[]) ?? [])
    setCategories((catRes.data as Category[]) ?? [])
    setAccounts((accRes.data as Account[]) ?? [])
    setLoading(false)
  }

  const getAccountBalance = async (accountId: string): Promise<number> => {
    const { data } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
    return data?.balance ?? 0
  }

  const applyBalanceDelta = async (accountId: string, delta: number) => {
    const balance = await getAccountBalance(accountId)
    await supabase.from('accounts').update({ balance: balance + delta }).eq('id', accountId)
  }

  const logAction = async (
    action: TransactionLog['action'],
    snapshot: Partial<Transaction>,
    changes: TransactionLog['changes'] = null
  ) => {
    const { error } = await supabase.from('transaction_logs').insert({
      transaction_id: snapshot.id,
      user_id: session!.user.id,
      action,
      snapshot,
      changes,
    })
    // La trazabilidad no debe tumbar la operación principal, pero tampoco
    // debe fallar en silencio como pasó hasta ahora
    if (error) console.warn('No se pudo registrar la traza:', error.message)
  }

  const addTransaction = async (data: {
    account_id: string
    category_id: string
    amount: number
    type: 'income' | 'expense'
    description: string
    date: string
  }) => {
    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({ ...data, user_id: session!.user.id })
      .select()
      .single()
    if (error) throw error

    const delta = data.type === 'income' ? data.amount : -data.amount
    await applyBalanceDelta(data.account_id, delta)
    await logAction('created', inserted)
    await fetchAll()
  }

  const editTransaction = async (
    original: Transaction,
    updated: {
      account_id: string
      category_id: string
      amount: number
      type: 'income' | 'expense'
      description: string
      date: string
    }
  ) => {
    const { error } = await supabase
      .from('transactions')
      .update(updated)
      .eq('id', original.id)
    if (error) throw error

    // Revertir efecto original
    const revertDelta = original.type === 'income' ? -original.amount : original.amount
    await applyBalanceDelta(original.account_id, revertDelta)

    // Aplicar nuevo efecto (puede ser otra cuenta)
    const applyDelta = updated.type === 'income' ? updated.amount : -updated.amount
    await applyBalanceDelta(updated.account_id, applyDelta)

    // Calcular qué cambió para la traza
    const changes: TransactionLog['changes'] = {}
    const fields = ['amount', 'type', 'account_id', 'category_id', 'description', 'date'] as const
    fields.forEach(f => {
      if ((original as any)[f] !== (updated as any)[f]) {
        changes![f] = { from: (original as any)[f], to: (updated as any)[f] }
      }
    })

    await logAction('edited', { ...original, ...updated }, changes)
    await fetchAll()
  }

  const deleteTransaction = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
    if (error) throw error

    // Revertir efecto en balance: gasto eliminado → sumar, ingreso eliminado → restar
    const revertDelta = tx.type === 'income' ? -tx.amount : tx.amount
    await applyBalanceDelta(tx.account_id, revertDelta)

    await logAction('deleted', tx)
    await fetchAll()
  }

  const fetchLogs = async (transactionId: string): Promise<TransactionLog[]> => {
    const { data } = await supabase
      .from('transaction_logs')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true })
    return (data as TransactionLog[]) ?? []
  }

  return { transactions, categories, accounts, loading, addTransaction, editTransaction, deleteTransaction, fetchLogs, refresh: fetchAll }
}
