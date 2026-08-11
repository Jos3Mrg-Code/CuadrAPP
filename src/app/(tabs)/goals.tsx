import { useState, useCallback, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, ScrollView, Alert, RefreshControl } from 'react-native'
import { showAlert } from '../../lib/alert'
import { confirm } from '../../lib/confirm'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, router } from 'expo-router'
import { useGoals } from '../../hooks/useGoals'
import { usePlan } from '../../hooks/usePlan'
import { FREE_LIMITS } from '../../lib/plan'
import { SavingsGoal } from '../../types'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444',
  '#14B8A6', '#84CC16',
]

const ICONS = ['🎯', '🏠', '✈️', '🚗', '📱', '💻', '🎓', '💍', '🏖️', '🐶', '🏋️', '🎸', '💰', '🌍', '👶']

export default function GoalsScreen() {
  const { goals, accounts, loading, totalSaved, totalTarget, completed, addGoal, addContribution, deleteGoal, refresh } = useGoals()
  const { isPremium } = usePlan()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const atLimit = !isPremium && goals.length >= FREE_LIMITS.goals

  useFocusEffect(useCallback(() => { refresh() }, []))

  const handleDelete = (goal: SavingsGoal) => {
    confirm('Eliminar meta', `¿Eliminar "${goal.name}"?`, () => deleteGoal(goal.id))
  }

  const globalPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Metas de ahorro</Text>
        <TouchableOpacity
          style={[s.addBtn, atLimit && s.addBtnLocked]}
          onPress={() => (atLimit ? router.push('/upgrade') : setShowAdd(true))}
        >
          <Text style={s.addBtnText}>{atLimit ? '🔒 Límite' : '+ Nueva'}</Text>
        </TouchableOpacity>
      </View>

      {atLimit && (
        <TouchableOpacity style={s.limitBanner} onPress={() => router.push('/upgrade')}>
          <Text style={s.limitText}>
            Usaste {goals.length}/{FREE_LIMITS.goals} metas del plan gratis · Hazte Premium
          </Text>
        </TouchableOpacity>
      )}

      {/* Resumen global */}
      {goals.length > 0 && (
        <View style={s.summaryCard}>
          <View style={s.summaryGlow} />
          <View style={s.summaryRow}>
            <View>
              <Text style={s.summaryLabel}>Total ahorrado</Text>
              <Text style={s.summaryAmount}>{fmt(totalSaved)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.summaryLabel}>Objetivo total</Text>
              <Text style={s.summaryTarget}>{fmt(totalTarget)}</Text>
            </View>
          </View>
          <View style={s.globalBar}>
            <View style={[s.globalFill, { width: `${Math.min(globalPct, 100)}%` as any }]} />
          </View>
          <View style={s.summaryStats}>
            <Text style={s.statText}>{globalPct.toFixed(1)}% completado</Text>
            <Text style={s.statText}>{completed} de {goals.length} meta{goals.length !== 1 ? 's' : ''} lograda{completed !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={goals}
        keyExtractor={g => g.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🎯</Text>
              <Text style={s.emptyTitle}>Sin metas aún</Text>
              <Text style={s.emptySub}>Define tus objetivos financieros y haz seguimiento de tu progreso</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
                <Text style={s.emptyBtnText}>+ Crear primera meta</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item: goal }) => {
          const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
          const remaining = goal.target_amount - goal.current_amount
          const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000) : null

          return (
            <TouchableOpacity
              style={[s.goalCard, goal.is_completed && s.goalCardDone]}
              onPress={() => setSelectedGoal(goal)}
              onLongPress={() => handleDelete(goal)}
              activeOpacity={0.85}
            >
              {goal.is_completed && (
                <View style={s.completedBadge}>
                  <Text style={s.completedText}>✓ Completada</Text>
                </View>
              )}

              <View style={s.goalTop}>
                <View style={[s.goalIcon, { backgroundColor: goal.color + '22' }]}>
                  <Text style={{ fontSize: 28 }}>{goal.icon}</Text>
                </View>
                <View style={s.goalInfo}>
                  <Text style={s.goalName}>{goal.name}</Text>
                  {daysLeft !== null && !goal.is_completed && (
                    <Text style={[s.goalDeadline, daysLeft < 0 && { color: '#F87171' }]}>
                      {daysLeft < 0 ? `Venció hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? 'Vence hoy' : `${daysLeft} días restantes`}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.goalPct, { color: goal.color }]}>{pct.toFixed(0)}%</Text>
                </View>
              </View>

              {/* Barra de progreso */}
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: goal.color }]} />
              </View>

              <View style={s.goalAmounts}>
                <Text style={s.goalSaved}>{fmt(goal.current_amount)} ahorrado</Text>
                <Text style={s.goalRemaining}>{goal.is_completed ? '🎉 Meta lograda' : `Faltan ${fmt(remaining)}`}</Text>
              </View>

              {!goal.is_completed && (
                <TouchableOpacity
                  style={[s.contributeBtn, { backgroundColor: goal.color + '22', borderColor: goal.color + '44' }]}
                  onPress={() => setSelectedGoal(goal)}
                >
                  <Text style={[s.contributeBtnText, { color: goal.color }]}>+ Agregar ahorro</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )
        }}
      />

      <AddGoalModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={addGoal} />
      <GoalDetailModal
        goal={selectedGoal}
        accounts={accounts}
        onClose={() => setSelectedGoal(null)}
        onContribute={addContribution}
        onDelete={(g) => { setSelectedGoal(null); confirm('Eliminar meta', `¿Eliminar "${g.name}"?`, () => deleteGoal(g.id)) }}
      />
    </SafeAreaView>
  )
}

function AddGoalModal({ visible, onClose, onSave }: {
  visible: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !target) { showAlert('Error', 'Completa nombre y objetivo'); return }
    const num = parseFloat(target.replace(',', '.'))
    if (isNaN(num) || num <= 0) { showAlert('Error', 'Monto inválido'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), target_amount: num, deadline: deadline || undefined, color, icon })
      setName(''); setTarget(''); setDeadline(''); setColor(COLORS[0]); setIcon(ICONS[0])
      onClose()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={m.title}>Nueva meta</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Crear'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          {/* Preview */}
          <View style={[m.preview, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={{ fontSize: 44 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={m.previewName}>{name || 'Mi meta'}</Text>
              <Text style={m.previewAmount}>{fmt(parseFloat(target || '0'))}</Text>
            </View>
            <View style={[m.previewPill, { backgroundColor: color + '33' }]}>
              <Text style={[m.previewPillText, { color }]}>0%</Text>
            </View>
          </View>

          <Text style={m.label}>Nombre</Text>
          <TextInput style={m.input} placeholder="Ej: Viaje a Europa, Carro nuevo..." placeholderTextColor="#64748B" value={name} onChangeText={setName} />

          <Text style={m.label}>Monto objetivo</Text>
          <View style={m.amountRow}>
            <Text style={m.currency}>$</Text>
            <TextInput style={m.amountInput} placeholder="0" placeholderTextColor="#64748B" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
          </View>

          <Text style={m.label}>Fecha límite (opcional)</Text>
          <TextInput style={m.input} placeholder="YYYY-MM-DD" placeholderTextColor="#64748B" value={deadline} onChangeText={setDeadline} />

          <Text style={m.label}>Color</Text>
          <View style={m.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity key={c} style={[m.colorDot, { backgroundColor: c }, color === c && m.colorSelected]} onPress={() => setColor(c)} />
            ))}
          </View>

          <Text style={m.label}>Ícono</Text>
          <View style={m.iconGrid}>
            {ICONS.map(ic => (
              <TouchableOpacity key={ic} style={[m.iconItem, icon === ic && { backgroundColor: color + '33', borderColor: color }]} onPress={() => setIcon(ic)}>
                <Text style={{ fontSize: 24 }}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

function GoalDetailModal({ goal, accounts, onClose, onContribute, onDelete }: {
  goal: SavingsGoal | null
  accounts: any[]
  onClose: () => void
  onContribute: (goal: SavingsGoal, amount: number, accountId: string) => Promise<void>
  onDelete: (goal: SavingsGoal) => void
}) {
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (goal) { setAmount(''); setAccountId(accounts[0]?.id ?? '') }
  }, [goal?.id])

  if (!goal) return null
  const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
  const remaining = goal.target_amount - goal.current_amount

  const handleContribute = async () => {
    const num = parseFloat(amount.replace(',', '.'))
    if (isNaN(num) || num <= 0) { showAlert('Error', 'Ingresa un monto válido'); return }
    if (!accountId) { showAlert('Error', 'Selecciona una cuenta'); return }
    if (num > remaining) { showAlert('Error', `El máximo que puedes agregar es ${fmt(remaining)}`); return }
    setSaving(true)
    try {
      await onContribute(goal, num, accountId)
      setAmount('')
      onClose()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={!!goal} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cerrar</Text></TouchableOpacity>
          <Text style={m.title}>Detalle de meta</Text>
          <TouchableOpacity onPress={() => onDelete(goal)}><Text style={m.deleteText}>Eliminar</Text></TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[m.hero, { backgroundColor: goal.color + '15' }]}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>{goal.icon}</Text>
            <Text style={m.heroName}>{goal.name}</Text>
            {goal.is_completed ? (
              <Text style={m.heroCompleted}>🎉 ¡Meta lograda!</Text>
            ) : (
              <Text style={m.heroSub}>Faltan {fmt(remaining)}</Text>
            )}
          </View>

          {/* Progreso */}
          <View style={m.progressBox}>
            <View style={m.progressHeader}>
              <Text style={m.progressSaved}>{fmt(goal.current_amount)}</Text>
              <Text style={[m.progressPct, { color: goal.color }]}>{pct.toFixed(1)}%</Text>
              <Text style={m.progressTarget}>{fmt(goal.target_amount)}</Text>
            </View>
            <View style={m.progressBg}>
              <View style={[m.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: goal.color }]} />
            </View>
            <View style={m.progressLabels}>
              <Text style={m.progressLabel}>Ahorrado</Text>
              <Text style={m.progressLabel}>Objetivo</Text>
            </View>
          </View>

          {/* Fecha límite */}
          {goal.deadline && (
            <View style={m.deadlineBox}>
              <Text style={m.deadlineIcon}>📅</Text>
              <Text style={m.deadlineText}>
                Fecha límite: {new Date(goal.deadline + 'T12:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          )}

          {/* Agregar ahorro */}
          {!goal.is_completed && (
            <View style={m.contributeBox}>
              <Text style={m.contributeTitle}>Agregar ahorro</Text>

              <Text style={m.label}>Descontar de cuenta</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {accounts.map(acc => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[m.chip, accountId === acc.id && { backgroundColor: acc.color + '44', borderColor: acc.color }]}
                    onPress={() => setAccountId(acc.id)}
                  >
                    <Text style={m.chipIcon}>{acc.icon}</Text>
                    <View>
                      <Text style={[m.chipName, accountId === acc.id && { color: '#F8FAFC' }]}>{acc.name}</Text>
                      <Text style={m.chipBalance}>{fmt(acc.balance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={m.label}>Monto</Text>
              <View style={m.amountRow}>
                <Text style={m.currency}>$</Text>
                <TextInput
                  style={m.amountInput}
                  placeholder="0"
                  placeholderTextColor="#64748B"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[m.contributeBtn, { backgroundColor: goal.color }]}
                onPress={handleContribute}
                disabled={saving}
              >
                <Text style={m.contributeBtnText}>{saving ? 'Guardando...' : '+ Agregar al ahorro'}</Text>
              </TouchableOpacity>
            </View>
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

  summaryCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#1E293B', borderRadius: 24, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  summaryGlow: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: '#6366F1', opacity: 0.12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { color: '#64748B', fontSize: 12, marginBottom: 4 },
  summaryAmount: { color: '#F8FAFC', fontSize: 26, fontWeight: '800' },
  summaryTarget: { color: '#94A3B8', fontSize: 18, fontWeight: '600' },
  globalBar: { height: 8, backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  globalFill: { height: 8, backgroundColor: '#6366F1', borderRadius: 4 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { color: '#64748B', fontSize: 12 },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  goalCard: { backgroundColor: '#1E293B', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  goalCardDone: { borderColor: '#10B98133', backgroundColor: '#10B98108' },
  completedBadge: { backgroundColor: '#10B98122', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 },
  completedText: { color: '#34D399', fontSize: 12, fontWeight: '700' },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  goalIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  goalInfo: { flex: 1 },
  goalName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  goalDeadline: { color: '#64748B', fontSize: 12, marginTop: 3 },
  goalPct: { fontSize: 22, fontWeight: '800' },
  progressBg: { height: 8, backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 8, borderRadius: 4 },
  goalAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  goalSaved: { color: '#94A3B8', fontSize: 13 },
  goalRemaining: { color: '#64748B', fontSize: 13 },
  contributeBtn: { borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1 },
  contributeBtnText: { fontSize: 14, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
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
  deleteText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1, padding: 20 },

  preview: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 28 },
  previewName: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  previewAmount: { color: '#94A3B8', fontSize: 14, marginTop: 2 },
  previewPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  previewPillText: { fontWeight: '700', fontSize: 14 },

  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, color: '#F8FAFC', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  currency: { color: '#475569', fontSize: 20, marginRight: 4 },
  amountInput: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '600', paddingVertical: 16 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorSelected: { borderWidth: 3, borderColor: '#F8FAFC' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 40 },
  iconItem: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155' },

  hero: { alignItems: 'center', borderRadius: 20, padding: 32, marginBottom: 20 },
  heroName: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  heroCompleted: { color: '#34D399', fontSize: 16, fontWeight: '600' },
  heroSub: { color: '#94A3B8', fontSize: 15 },

  progressBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressSaved: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  progressPct: { fontSize: 22, fontWeight: '800' },
  progressTarget: { color: '#94A3B8', fontSize: 16 },
  progressBg: { height: 10, backgroundColor: '#0F172A', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 10, borderRadius: 5 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: '#475569', fontSize: 11 },

  deadlineBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  deadlineIcon: { fontSize: 18 },
  deadlineText: { color: '#94A3B8', fontSize: 14 },

  contributeBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', marginBottom: 40 },
  contributeTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  contributeBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  contributeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F172A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, borderWidth: 1, borderColor: '#334155' },
  chipIcon: { fontSize: 20 },
  chipName: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  chipBalance: { color: '#475569', fontSize: 11, marginTop: 2 },
})
