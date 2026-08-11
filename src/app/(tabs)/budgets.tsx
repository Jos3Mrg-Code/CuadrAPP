import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, TextInput, ScrollView, Alert, RefreshControl,
} from 'react-native'
import { showAlert } from '../../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useBudgets, BudgetWithProgress } from '../../hooks/useBudgets'
import { usePlan } from '../../hooks/usePlan'
import { FREE_LIMITS } from '../../lib/plan'
import { confirm } from '../../lib/confirm'
import { Category } from '../../types'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(n: number) { return `${Math.round(n)}%` }

export default function BudgetsScreen() {
  const { budgets, loading, totalBudget, totalSpent, addBudget, editBudget, deleteBudget, refresh } = useBudgets()
  const { isPremium } = usePlan()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<BudgetWithProgress | null>(null)
  const atLimit = !isPremium && budgets.length >= FREE_LIMITS.budgets

  useFocusEffect(useCallback(() => { refresh() }, []))

  const monthlyBudgets = budgets.filter(b => b.period === 'monthly')
  const weeklyBudgets = budgets.filter(b => b.period === 'weekly')

  const overBudget = budgets.filter(b => b.spent > b.amount).length
  const totalRemaining = Math.max(0, totalBudget - totalSpent)
  const globalPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Presupuestos</Text>
        <TouchableOpacity
          style={[s.addBtn, atLimit && s.addBtnLocked]}
          onPress={() => (atLimit ? router.push('/upgrade') : setShowAdd(true))}
        >
          <Text style={s.addBtnText}>{atLimit ? '🔒 Límite' : '+ Nuevo'}</Text>
        </TouchableOpacity>
      </View>

      {atLimit && (
        <TouchableOpacity style={s.limitBanner} onPress={() => router.push('/upgrade')}>
          <Text style={s.limitText}>
            Usaste {budgets.length}/{FREE_LIMITS.budgets} presupuestos del plan gratis · Hazte Premium
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
        ListHeaderComponent={
          <>
            {/* Summary card */}
            {budgets.length > 0 && (
              <View style={s.summaryCard}>
                <View style={s.summaryGlow} />
                <View style={s.summaryRow}>
                  <View>
                    <Text style={s.summaryLabel}>Presupuesto total</Text>
                    <Text style={s.summaryAmount}>{fmt(totalBudget)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.summaryLabel}>Gastado</Text>
                    <Text style={[s.summaryAmount, { color: globalPct > 80 ? '#F87171' : '#34D399' }]}>{fmt(totalSpent)}</Text>
                  </View>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, {
                    width: `${globalPct}%` as any,
                    backgroundColor: globalPct > 100 ? '#EF4444' : globalPct > 80 ? '#F97316' : '#6366F1',
                  }]} />
                </View>
                <View style={s.summaryFooter}>
                  <Text style={s.summaryRemaining}>Disponible: {fmt(totalRemaining)}</Text>
                  {overBudget > 0 && (
                    <Text style={s.overBudgetBadge}>⚠ {overBudget} excedido{overBudget !== 1 ? 's' : ''}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Monthly */}
            {monthlyBudgets.length > 0 && (
              <Text style={s.sectionTitle}>Mensual</Text>
            )}
            {monthlyBudgets.map(b => (
              <BudgetCard key={b.id} budget={b} onPress={() => setEditing(b)} onDelete={() => confirm('Eliminar presupuesto', `¿Eliminar presupuesto de ${b.category.name}?`, () => deleteBudget(b.id))} />
            ))}

            {/* Weekly */}
            {weeklyBudgets.length > 0 && (
              <Text style={s.sectionTitle}>Semanal</Text>
            )}
            {weeklyBudgets.map(b => (
              <BudgetCard key={b.id} budget={b} onPress={() => setEditing(b)} onDelete={() => confirm('Eliminar presupuesto', `¿Eliminar presupuesto de ${b.category.name}?`, () => deleteBudget(b.id))} />
            ))}

            {/* Empty */}
            {!loading && budgets.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📊</Text>
                <Text style={s.emptyTitle}>Sin presupuestos</Text>
                <Text style={s.emptySub}>Crea presupuestos por categoría para controlar tus gastos cada mes o semana</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
                  <Text style={s.emptyBtnText}>+ Crear presupuesto</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        contentContainerStyle={s.list}
      />

      <AddBudgetModal
        visible={showAdd}
        existingCategoryIds={budgets.map(b => b.category_id)}
        onClose={() => setShowAdd(false)}
        onSave={async (data) => { await addBudget(data); setShowAdd(false) }}
      />
      <EditBudgetModal
        budget={editing}
        onClose={() => setEditing(null)}
        onSave={async (amount) => { if (editing) { await editBudget(editing.id, amount); setEditing(null) } }}
        onDelete={() => {
          if (!editing) return
          const b = editing
          setEditing(null)
          confirm('Eliminar presupuesto', `¿Eliminar presupuesto de ${b.category.name}?`, () => deleteBudget(b.id))
        }}
      />
    </SafeAreaView>
  )
}

function BudgetCard({ budget: b, onPress, onDelete }: { budget: BudgetWithProgress; onPress: () => void; onDelete: () => void }) {
  const over = b.spent > b.amount
  const warn = !over && b.percentage >= 80
  const barColor = over ? '#EF4444' : warn ? '#F97316' : '#6366F1'

  return (
    <TouchableOpacity style={s.card} onPress={onPress} onLongPress={onDelete} activeOpacity={0.8}>
      <View style={s.cardTop}>
        <View style={[s.catIcon, { backgroundColor: b.category.color + '22' }]}>
          <Text style={{ fontSize: 22 }}>{b.category.icon}</Text>
        </View>
        <View style={s.cardInfo}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardName}>{b.category.name}</Text>
            {over && <Text style={s.overTag}>Excedido</Text>}
            {warn && !over && <Text style={s.warnTag}>Cerca del límite</Text>}
          </View>
          <Text style={s.cardPeriod}>{b.period === 'monthly' ? 'Este mes' : 'Esta semana'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.cardSpent, { color: over ? '#F87171' : '#F8FAFC' }]}>{fmt(b.spent)}</Text>
          <Text style={s.cardBudget}>de {fmt(b.amount)}</Text>
        </View>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${b.percentage}%` as any, backgroundColor: barColor }]} />
      </View>
      <View style={s.cardBottom}>
        <Text style={[s.cardPct, { color: barColor }]}>{pct(b.percentage)}</Text>
        <Text style={s.cardRemaining}>
          {over ? `Excedido por ${fmt(b.spent - b.amount)}` : `Disponible: ${fmt(b.remaining)}`}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function EditBudgetModal({ budget, onClose, onSave, onDelete }: {
  budget: BudgetWithProgress | null
  onClose: () => void
  onSave: (amount: number) => Promise<void>
  onDelete: () => void
}) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (budget) setAmount(budget.amount.toString())
  }, [budget])

  if (!budget) return null

  const handle = async () => {
    const num = parseFloat(amount.replace(',', '.'))
    if (isNaN(num) || num <= 0) { showAlert('Error', 'Ingresa un monto válido'); return }
    setSaving(true)
    try { await onSave(num) } catch (e: any) { showAlert('Error', e.message) } finally { setSaving(false) }
  }

  return (
    <Modal visible={!!budget} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={m.title}>Editar presupuesto</Text>
          <TouchableOpacity onPress={handle} disabled={saving}><Text style={m.save}>{saving ? '...' : 'Guardar'}</Text></TouchableOpacity>
        </View>
        <View style={m.body}>
          <View style={[m.catPreview, { backgroundColor: budget.category.color + '22' }]}>
            <Text style={{ fontSize: 36 }}>{budget.category.icon}</Text>
            <View>
              <Text style={m.catName}>{budget.category.name}</Text>
              <Text style={m.catPeriod}>{budget.period === 'monthly' ? 'Mensual' : 'Semanal'}</Text>
            </View>
          </View>

          <Text style={m.label}>Monto del presupuesto</Text>
          <View style={m.amountRow}>
            <Text style={m.currency}>$</Text>
            <TextInput style={m.amountInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor="#64748B" autoFocus />
          </View>

          <View style={m.statsRow}>
            <View style={m.statBox}>
              <Text style={m.statLabel}>Gastado</Text>
              <Text style={[m.statValue, { color: budget.spent > budget.amount ? '#F87171' : '#34D399' }]}>{fmt(budget.spent)}</Text>
            </View>
            <View style={m.statBox}>
              <Text style={m.statLabel}>Disponible</Text>
              <Text style={m.statValue}>{fmt(Math.max(0, budget.amount - budget.spent))}</Text>
            </View>
            <View style={m.statBox}>
              <Text style={m.statLabel}>Uso</Text>
              <Text style={m.statValue}>{pct(budget.percentage)}</Text>
            </View>
          </View>

          <TouchableOpacity style={m.deleteBtn} onPress={onDelete}>
            <Text style={m.deleteBtnText}>🗑 Eliminar presupuesto</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function AddBudgetModal({ visible, existingCategoryIds, onClose, onSave }: {
  visible: boolean
  existingCategoryIds: string[]
  onClose: () => void
  onSave: (data: { category_id: string; amount: number; period: 'monthly' | 'weekly' }) => Promise<void>
}) {
  const { session } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible || !session) return
    supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense')
      .or(`user_id.eq.${session.user.id},is_default.eq.true`)
      .order('name')
      .then(({ data }) => {
        const available = (data as Category[] ?? []).filter(c => !existingCategoryIds.includes(c.id))
        setCategories(available)
        setSelectedCat(available[0] ?? null)
      })
  }, [visible])

  const handle = async () => {
    const num = parseFloat(amount.replace(',', '.'))
    if (!selectedCat || isNaN(num) || num <= 0) { showAlert('Error', 'Selecciona una categoría e ingresa un monto'); return }
    setSaving(true)
    try { await onSave({ category_id: selectedCat.id, amount: num, period }) }
    catch (e: any) { showAlert('Error', e.message) }
    finally { setSaving(false) }
  }

  const reset = () => { setAmount(''); setPeriod('monthly'); setSelectedCat(categories[0] ?? null) }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose() }}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={() => { reset(); onClose() }}><Text style={m.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={m.title}>Nuevo presupuesto</Text>
          <TouchableOpacity onPress={handle} disabled={saving}><Text style={m.save}>{saving ? '...' : 'Guardar'}</Text></TouchableOpacity>
        </View>
        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          {categories.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ color: '#64748B', fontSize: 15, textAlign: 'center' }}>
                Ya tienes presupuestos para todas las categorías de gastos disponibles.
              </Text>
            </View>
          ) : (
            <>
              {/* Preview */}
              {selectedCat && (
                <View style={[m.catPreview, { backgroundColor: selectedCat.color + '22' }]}>
                  <Text style={{ fontSize: 36 }}>{selectedCat.icon}</Text>
                  <View>
                    <Text style={m.catName}>{selectedCat.name}</Text>
                    <Text style={m.catPeriod}>{period === 'monthly' ? 'Mensual' : 'Semanal'} · {amount ? fmt(parseFloat(amount) || 0) : '$0'}</Text>
                  </View>
                </View>
              )}

              <Text style={m.label}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[m.catChip, selectedCat?.id === cat.id && { backgroundColor: cat.color + '33', borderColor: cat.color }]}
                      onPress={() => setSelectedCat(cat)}
                    >
                      <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                      <Text style={[m.catChipText, selectedCat?.id === cat.id && { color: '#F8FAFC' }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={m.label}>Período</Text>
              <View style={m.periodRow}>
                {(['monthly', 'weekly'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[m.periodBtn, period === p && m.periodBtnActive]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text style={[m.periodBtnText, period === p && { color: '#F8FAFC' }]}>
                      {p === 'monthly' ? '📅 Mensual' : '📆 Semanal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={m.label}>Monto límite</Text>
              <View style={m.amountRow}>
                <Text style={m.currency}>$</Text>
                <TextInput
                  style={m.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnLocked: { backgroundColor: '#334155' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  limitBanner: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#F9731618', borderWidth: 1, borderColor: '#F9731644', borderRadius: 14, padding: 12 },
  limitText: { color: '#F97316', fontSize: 12, textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },

  summaryCard: { backgroundColor: '#1E293B', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  summaryGlow: { position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: '#6366F1', opacity: 0.12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { color: '#64748B', fontSize: 12, marginBottom: 4 },
  summaryAmount: { color: '#F8FAFC', fontSize: 22, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 4 },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRemaining: { color: '#64748B', fontSize: 13 },
  overBudgetBadge: { color: '#F97316', fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: '#1E293B', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  catIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardName: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  overTag: { backgroundColor: '#EF444422', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, color: '#F87171', fontSize: 10, fontWeight: '700' },
  warnTag: { backgroundColor: '#F9731622', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, color: '#FB923C', fontSize: 10, fontWeight: '700' },
  cardPeriod: { color: '#475569', fontSize: 12 },
  cardSpent: { fontSize: 16, fontWeight: '700' },
  cardBudget: { color: '#475569', fontSize: 12, marginTop: 2 },
  barTrack: { height: 6, backgroundColor: '#0F172A', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 3 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardPct: { fontSize: 12, fontWeight: '700' },
  cardRemaining: { color: '#64748B', fontSize: 12 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#6366F1', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
})

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  cancel: { color: '#64748B', fontSize: 16 },
  save: { color: '#6366F1', fontSize: 16, fontWeight: '700' },
  body: { padding: 20 },
  scroll: { flex: 1, padding: 20 },

  catPreview: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, marginBottom: 28 },
  catName: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  catPeriod: { color: '#94A3B8', fontSize: 13, marginTop: 2 },

  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  currency: { color: '#475569', fontSize: 20, marginRight: 4 },
  amountInput: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '600', paddingVertical: 16 },

  periodRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  periodBtn: { flex: 1, padding: 14, backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#6366F133', borderColor: '#6366F1' },
  periodBtnText: { color: '#64748B', fontWeight: '600', fontSize: 14 },

  catChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' },
  catChipText: { color: '#64748B', fontSize: 13, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statBox: { flex: 1, backgroundColor: '#1E293B', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  statLabel: { color: '#64748B', fontSize: 11, marginBottom: 4 },
  statValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },

  deleteBtn: { backgroundColor: '#EF444422', borderWidth: 1, borderColor: '#EF4444', borderRadius: 14, padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
})
