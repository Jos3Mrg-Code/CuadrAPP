import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, ScrollView, Alert, RefreshControl } from 'react-native'
import { showAlert } from '../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { confirm } from '../lib/confirm'
import { useDebts } from '../hooks/useDebts'
import { Debt, DebtType, Account } from '../types'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444',
  '#14B8A6', '#84CC16',
]

const ICONS = ['🧾', '💳', '🏠', '🚗', '🎓', '🏦', '📄', '💰']

const DEBT_TYPES: { value: DebtType; label: string; icon: string }[] = [
  { value: 'loan', label: 'Préstamo', icon: '🏦' },
  { value: 'credit_card', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'personal', label: 'Deuda personal', icon: '🤝' },
  { value: 'mortgage', label: 'Hipoteca', icon: '🏠' },
  { value: 'other', label: 'Otro', icon: '📄' },
]

function debtTypeLabel(type: DebtType) {
  return DEBT_TYPES.find(t => t.value === type)?.label ?? type
}

export default function DebtsScreen() {
  const { debts, accounts, loading, totalDebt, totalRemaining, activeCount, paidOffCount, addDebt, addPayment, markAsPaid, deleteDebt, refresh } = useDebts()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)

  useEffect(() => { refresh() }, [])

  const handleDelete = (debt: Debt) => {
    confirm('Eliminar deuda', `¿Eliminar "${debt.name}"?`, () => deleteDebt(debt.id))
  }

  const paidPct = totalDebt > 0 ? ((totalDebt - totalRemaining) / totalDebt) * 100 : 0

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Deudas</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {debts.length > 0 && (
        <View style={s.summaryCard}>
          <View style={s.summaryGlow} />
          <View style={s.summaryRow}>
            <View>
              <Text style={s.summaryLabel}>Total adeudado</Text>
              <Text style={s.summaryAmount}>{fmt(totalRemaining)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.summaryLabel}>Deuda original</Text>
              <Text style={s.summaryTarget}>{fmt(totalDebt)}</Text>
            </View>
          </View>
          <View style={s.globalBar}>
            <View style={[s.globalFill, { width: `${Math.min(paidPct, 100)}%` as any }]} />
          </View>
          <View style={s.summaryStats}>
            <Text style={s.statText}>{paidPct.toFixed(1)}% pagado</Text>
            <Text style={s.statText}>{activeCount} activa{activeCount !== 1 ? 's' : ''} · {paidOffCount} pagada{paidOffCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={debts}
        keyExtractor={d => d.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🧾</Text>
              <Text style={s.emptyTitle}>Sin deudas registradas</Text>
              <Text style={s.emptySub}>Registra tus préstamos, tarjetas u otras deudas para hacerles seguimiento</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
                <Text style={s.emptyBtnText}>+ Registrar primera deuda</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item: debt }) => {
          const pct = debt.total_amount > 0 ? ((debt.total_amount - debt.remaining_amount) / debt.total_amount) * 100 : 0
          const daysLeft = debt.due_date ? Math.ceil((new Date(debt.due_date).getTime() - Date.now()) / 86400000) : null

          return (
            <TouchableOpacity
              style={[s.debtCard, debt.is_paid && s.debtCardDone]}
              onPress={() => setSelectedDebt(debt)}
              onLongPress={() => handleDelete(debt)}
              activeOpacity={0.85}
            >
              {debt.is_paid && (
                <View style={s.completedBadge}>
                  <Text style={s.completedText}>✓ Pagada</Text>
                </View>
              )}

              <View style={s.debtTop}>
                <View style={[s.debtIcon, { backgroundColor: debt.color + '22' }]}>
                  <Text style={{ fontSize: 28 }}>{debt.icon}</Text>
                </View>
                <View style={s.debtInfo}>
                  <Text style={s.debtName}>{debt.name}</Text>
                  <Text style={s.debtType}>{debtTypeLabel(debt.debt_type)}</Text>
                  {daysLeft !== null && !debt.is_paid && (
                    <Text style={[s.debtDue, daysLeft < 0 && { color: '#F87171' }]}>
                      {daysLeft < 0 ? `Venció hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? 'Vence hoy' : `${daysLeft} días para vencer`}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.debtPct, { color: debt.color }]}>{pct.toFixed(0)}%</Text>
                </View>
              </View>

              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: debt.color }]} />
              </View>

              <View style={s.debtAmounts}>
                <Text style={s.debtRemaining}>{debt.is_paid ? '🎉 Deuda saldada' : `Faltan ${fmt(debt.remaining_amount)}`}</Text>
                <Text style={s.debtOriginal}>de {fmt(debt.total_amount)}</Text>
              </View>

              {!debt.is_paid && (
                <TouchableOpacity
                  style={[s.contributeBtn, { backgroundColor: debt.color + '22', borderColor: debt.color + '44' }]}
                  onPress={() => setSelectedDebt(debt)}
                >
                  <Text style={[s.contributeBtnText, { color: debt.color }]}>+ Registrar pago</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )
        }}
      />

      <AddDebtModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={addDebt} />
      <DebtDetailModal
        debt={selectedDebt}
        accounts={accounts}
        onClose={() => setSelectedDebt(null)}
        onPay={addPayment}
        onMarkAsPaid={markAsPaid}
        onDelete={(d) => { setSelectedDebt(null); confirm('Eliminar deuda', `¿Eliminar "${d.name}"?`, () => deleteDebt(d.id)) }}
      />
    </SafeAreaView>
  )
}

function AddDebtModal({ visible, onClose, onSave }: {
  visible: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [debtType, setDebtType] = useState<DebtType>('loan')
  const [total, setTotal] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !total) { showAlert('Error', 'Completa nombre y monto total'); return }
    const num = parseFloat(total.replace(',', '.'))
    if (isNaN(num) || num <= 0) { showAlert('Error', 'Monto inválido'); return }
    let rate: number | undefined
    if (interestRate) {
      rate = parseFloat(interestRate.replace(',', '.'))
      if (isNaN(rate) || rate < 0) { showAlert('Error', 'Tasa de interés inválida'); return }
    }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), debt_type: debtType, total_amount: num, interest_rate: rate, due_date: dueDate || undefined, color, icon })
      setName(''); setDebtType('loan'); setTotal(''); setInterestRate(''); setDueDate(''); setColor(COLORS[0]); setIcon(ICONS[0])
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
          <Text style={m.title}>Nueva deuda</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Crear'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          <View style={[m.preview, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={{ fontSize: 44 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={m.previewName}>{name || 'Mi deuda'}</Text>
              <Text style={m.previewAmount}>{fmt(parseFloat(total || '0'))}</Text>
            </View>
            <View style={[m.previewPill, { backgroundColor: color + '33' }]}>
              <Text style={[m.previewPillText, { color }]}>0%</Text>
            </View>
          </View>

          <Text style={m.label}>Nombre</Text>
          <TextInput style={m.input} placeholder="Ej: Tarjeta Visa, Préstamo carro..." placeholderTextColor="#64748B" value={name} onChangeText={setName} />

          <Text style={m.label}>Tipo de deuda</Text>
          <View style={m.typeGrid}>
            {DEBT_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[m.typeItem, debtType === t.value && { backgroundColor: color + '33', borderColor: color }]}
                onPress={() => setDebtType(t.value)}
              >
                <Text style={{ fontSize: 18 }}>{t.icon}</Text>
                <Text style={[m.typeText, debtType === t.value && { color: '#F8FAFC' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Monto total</Text>
          <View style={m.amountRow}>
            <Text style={m.currency}>$</Text>
            <TextInput style={m.amountInput} placeholder="0" placeholderTextColor="#64748B" value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
          </View>

          <Text style={m.label}>Tasa de interés % (opcional)</Text>
          <View style={m.amountRow}>
            <TextInput style={m.amountInput} placeholder="0" placeholderTextColor="#64748B" value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" />
            <Text style={m.currency}>%</Text>
          </View>

          <Text style={m.label}>Fecha de vencimiento (opcional)</Text>
          <TextInput style={m.input} placeholder="YYYY-MM-DD" placeholderTextColor="#64748B" value={dueDate} onChangeText={setDueDate} />

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

function DebtDetailModal({ debt, accounts, onClose, onPay, onMarkAsPaid, onDelete }: {
  debt: Debt | null
  accounts: Account[]
  onClose: () => void
  onPay: (debt: Debt, amount: number, accountId: string) => Promise<void>
  onMarkAsPaid: (id: string) => Promise<void>
  onDelete: (debt: Debt) => void
}) {
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (debt) { setAmount(''); setAccountId(accounts[0]?.id ?? '') }
  }, [debt?.id])

  if (!debt) return null
  const pct = debt.total_amount > 0 ? ((debt.total_amount - debt.remaining_amount) / debt.total_amount) * 100 : 0

  const handlePay = async () => {
    const num = parseFloat(amount.replace(',', '.'))
    if (isNaN(num) || num <= 0) { showAlert('Error', 'Ingresa un monto válido'); return }
    if (!accountId) { showAlert('Error', 'Selecciona una cuenta'); return }
    if (num > debt.remaining_amount) { showAlert('Error', `El máximo que puedes pagar es ${fmt(debt.remaining_amount)}`); return }
    setSaving(true)
    try {
      await onPay(debt, num, accountId)
      setAmount('')
      onClose()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAsPaid = () => {
    confirm('Marcar como pagada', `¿Marcar "${debt.name}" como pagada sin registrar un pago desde una cuenta?`, async () => {
      try {
        await onMarkAsPaid(debt.id)
        onClose()
      } catch (e: any) {
        showAlert('Error', e.message)
      }
    })
  }

  return (
    <Modal visible={!!debt} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cerrar</Text></TouchableOpacity>
          <Text style={m.title}>Detalle de deuda</Text>
          <TouchableOpacity onPress={() => onDelete(debt)}><Text style={m.deleteText}>Eliminar</Text></TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          <View style={[m.hero, { backgroundColor: debt.color + '15' }]}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>{debt.icon}</Text>
            <Text style={m.heroName}>{debt.name}</Text>
            <Text style={m.heroType}>{debtTypeLabel(debt.debt_type)}</Text>
            {debt.is_paid ? (
              <Text style={m.heroCompleted}>🎉 Deuda saldada</Text>
            ) : (
              <Text style={m.heroSub}>Faltan {fmt(debt.remaining_amount)}</Text>
            )}
          </View>

          <View style={m.progressBox}>
            <View style={m.progressHeader}>
              <Text style={m.progressSaved}>{fmt(debt.remaining_amount)}</Text>
              <Text style={[m.progressPct, { color: debt.color }]}>{pct.toFixed(1)}%</Text>
              <Text style={m.progressTarget}>{fmt(debt.total_amount)}</Text>
            </View>
            <View style={m.progressBg}>
              <View style={[m.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: debt.color }]} />
            </View>
            <View style={m.progressLabels}>
              <Text style={m.progressLabel}>Restante</Text>
              <Text style={m.progressLabel}>Total</Text>
            </View>
          </View>

          {debt.interest_rate != null && (
            <View style={m.deadlineBox}>
              <Text style={m.deadlineIcon}>📈</Text>
              <Text style={m.deadlineText}>Tasa de interés: {debt.interest_rate}%</Text>
            </View>
          )}

          {debt.due_date && (
            <View style={m.deadlineBox}>
              <Text style={m.deadlineIcon}>📅</Text>
              <Text style={m.deadlineText}>
                Vence: {new Date(debt.due_date + 'T12:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          )}

          {!debt.is_paid && (
            <View style={m.contributeBox}>
              <Text style={m.contributeTitle}>Registrar pago</Text>

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
                style={[m.contributeBtn, { backgroundColor: debt.color }]}
                onPress={handlePay}
                disabled={saving}
              >
                <Text style={m.contributeBtnText}>{saving ? 'Guardando...' : '+ Registrar pago'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={m.paidBtn} onPress={handleMarkAsPaid}>
                <Text style={m.paidBtnText}>Marcar como pagada</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backBtn: {},
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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

  debtCard: { backgroundColor: '#1E293B', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  debtCardDone: { borderColor: '#10B98133', backgroundColor: '#10B98108' },
  completedBadge: { backgroundColor: '#10B98122', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 },
  completedText: { color: '#34D399', fontSize: 12, fontWeight: '700' },
  debtTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  debtIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  debtInfo: { flex: 1 },
  debtName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  debtType: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  debtDue: { color: '#64748B', fontSize: 12, marginTop: 3 },
  debtPct: { fontSize: 22, fontWeight: '800' },
  progressBg: { height: 8, backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 8, borderRadius: 4 },
  debtAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  debtRemaining: { color: '#94A3B8', fontSize: 13 },
  debtOriginal: { color: '#64748B', fontSize: 13 },
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' },
  typeText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  hero: { alignItems: 'center', borderRadius: 20, padding: 32, marginBottom: 20 },
  heroName: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  heroType: { color: '#64748B', fontSize: 13, marginBottom: 8 },
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
  paidBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12, backgroundColor: '#10B98122', borderWidth: 1, borderColor: '#10B98144' },
  paidBtnText: { color: '#34D399', fontSize: 15, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F172A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, borderWidth: 1, borderColor: '#334155' },
  chipIcon: { fontSize: 20 },
  chipName: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  chipBalance: { color: '#475569', fontSize: 11, marginTop: 2 },
})
