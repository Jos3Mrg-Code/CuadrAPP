import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { showAlert } from '../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { confirm } from '../lib/confirm'
import { useCalendar, CalendarItem } from '../hooks/useCalendar'
import { usePlan } from '../hooks/usePlan'
import { PremiumLocked } from '../components/PremiumLocked'
import { ScheduledPayment, PaymentFrequency, Category, Account } from '../types'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function today() {
  const n = new Date()
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
}

const COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444',
  '#14B8A6', '#84CC16',
]

const ICONS = ['📅', '🏠', '💡', '📱', '🎬', '🎵', '🚗', '🏋️']

const FREQUENCIES: { value: PaymentFrequency; label: string; icon: string }[] = [
  { value: 'once', label: 'Único', icon: '📌' },
  { value: 'weekly', label: 'Semanal', icon: '🔁' },
  { value: 'monthly', label: 'Mensual', icon: '📆' },
  { value: 'yearly', label: 'Anual', icon: '🗓️' },
]

function freqLabel(f: PaymentFrequency) {
  return FREQUENCIES.find(x => x.value === f)?.label ?? f
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const DOT_COLORS = {
  income: '#34D399',
  expense: '#F87171',
  payment: '#6366F1',
  due: '#F97316',
}

function formatDayTitle(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function CalendarScreen() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(today())
  const [showAdd, setShowAdd] = useState(false)

  const { dayMap, categories, accounts, loading, addScheduledPayment, markOccurrencePaid, deleteScheduledPayment } = useCalendar(cursor.year, cursor.month)
  const { isPremium, loading: planLoading } = usePlan()

  const todayStr = today()

  const changeMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1)
    const year = next.getFullYear()
    const month = next.getMonth()
    setCursor({ year, month })
    const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()
    setSelectedDate(isCurrentMonth ? todayStr : `${year}-${pad(month + 1)}-01`)
  }

  // Grilla: offset lunes-primero + días del mes, en filas de 7
  const weeks = useMemo(() => {
    const offset = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const cells: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cursor])

  const dotsForDay = (day: number): string[] => {
    const dateStr = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`
    const items = dayMap[dateStr] ?? []
    const dots = new Set<string>()
    items.forEach(it => {
      if (it.kind === 'transaction') dots.add(it.tx.type === 'income' ? DOT_COLORS.income : DOT_COLORS.expense)
      else if (it.kind === 'payment') dots.add(DOT_COLORS.payment)
      else dots.add(DOT_COLORS.due)
    })
    return [...dots]
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  const dayItems = dayMap[selectedDate] ?? []

  const handleDeletePayment = (p: ScheduledPayment) => {
    confirm('Eliminar pago', `¿Eliminar "${p.name}" y sus futuras ocurrencias?`, () => {
      deleteScheduledPayment(p.id).catch((e: any) => showAlert('Error', e.message))
    })
  }

  const handleMarkPaid = async (p: ScheduledPayment) => {
    try {
      await markOccurrencePaid(p)
    } catch (e: any) {
      showAlert('Error', e.message)
    }
  }

  // Esto es web: /calendar es una URL que se puede escribir a mano, así que
  // la guarda va en la pantalla, no solo en la tarjeta del dashboard.
  if (!planLoading && !isPremium) return <PremiumLocked feature="El calendario financiero" />

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Calendario</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Pago</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Navegación de mes */}
        <View style={s.monthRow}>
          <TouchableOpacity style={s.monthBtn} onPress={() => changeMonth(-1)}>
            <Text style={s.monthBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
          <TouchableOpacity style={s.monthBtn} onPress={() => changeMonth(1)}>
            <Text style={s.monthBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Grilla */}
        <View style={s.gridCard}>
          <View style={s.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={s.weekdayCell}>
                <Text style={s.weekdayText}>{w}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color="#6366F1" style={{ marginVertical: 40 }} />
          ) : (
            weeks.map((row, ri) => (
              <View key={ri} style={s.weekRow}>
                {row.map((day, ci) => {
                  if (day === null) return <View key={ci} style={s.dayCell} />
                  const dateStr = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDate
                  const dots = dotsForDay(day)
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[s.dayCell, isToday && s.dayCellToday, isSelected && s.dayCellSelected]}
                      onPress={() => setSelectedDate(dateStr)}
                    >
                      <Text style={[s.dayNum, isToday && { color: '#A5B4FC', fontWeight: '800' }]}>{day}</Text>
                      <View style={s.dotsRow}>
                        {dots.slice(0, 4).map((c, di) => (
                          <View key={di} style={[s.dot, { backgroundColor: c }]} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))
          )}
        </View>

        {/* Leyenda */}
        <View style={s.legend}>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: DOT_COLORS.income }]} /><Text style={s.legendText}>Ingreso</Text></View>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: DOT_COLORS.expense }]} /><Text style={s.legendText}>Gasto</Text></View>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: DOT_COLORS.payment }]} /><Text style={s.legendText}>Pago prog.</Text></View>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: DOT_COLORS.due }]} /><Text style={s.legendText}>Vencimiento</Text></View>
        </View>

        {/* Detalle del día */}
        <Text style={s.dayTitle}>{formatDayTitle(selectedDate)}</Text>
        {dayItems.length === 0 ? (
          <View style={s.emptyDay}>
            <Text style={s.emptyDayText}>Sin movimientos este día</Text>
          </View>
        ) : (
          dayItems.map((item, i) => (
            <DayItemRow
              key={i}
              item={item}
              onMarkPaid={handleMarkPaid}
              onDeletePayment={handleDeletePayment}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddScheduledPaymentModal
        visible={showAdd}
        categories={categories}
        accounts={accounts}
        onClose={() => setShowAdd(false)}
        onSave={addScheduledPayment}
      />
    </SafeAreaView>
  )
}

function DayItemRow({ item, onMarkPaid, onDeletePayment }: {
  item: CalendarItem
  onMarkPaid: (p: ScheduledPayment) => void
  onDeletePayment: (p: ScheduledPayment) => void
}) {
  if (item.kind === 'transaction') {
    const tx = item.tx
    const cat = tx.category as any
    const isIncome = tx.type === 'income'
    return (
      <View style={s.itemRow}>
        <View style={[s.itemIcon, { backgroundColor: cat?.color ? cat.color + '22' : '#6366F122' }]}>
          <Text style={{ fontSize: 20 }}>{cat?.icon ?? '💸'}</Text>
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{tx.description || cat?.name || 'Transacción'}</Text>
          <Text style={s.itemSub}>{isIncome ? 'Ingreso' : 'Gasto'}</Text>
        </View>
        <Text style={[s.itemAmount, { color: isIncome ? '#34D399' : '#F87171' }]}>
          {isIncome ? '+' : '-'}{fmt(tx.amount)}
        </Text>
      </View>
    )
  }

  if (item.kind === 'debt_due') {
    const d = item.debt
    return (
      <View style={[s.itemRow, { borderColor: '#F9731644' }]}>
        <View style={[s.itemIcon, { backgroundColor: '#F9731622' }]}>
          <Text style={{ fontSize: 20 }}>{d.icon}</Text>
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{d.name}</Text>
          <Text style={[s.itemSub, { color: '#F97316' }]}>Vence deuda · faltan {fmt(d.remaining_amount)}</Text>
        </View>
      </View>
    )
  }

  if (item.kind === 'goal_deadline') {
    const g = item.goal
    return (
      <View style={[s.itemRow, { borderColor: '#F9731644' }]}>
        <View style={[s.itemIcon, { backgroundColor: '#F9731622' }]}>
          <Text style={{ fontSize: 20 }}>{g.icon}</Text>
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{g.name}</Text>
          <Text style={[s.itemSub, { color: '#F97316' }]}>Vence meta · faltan {fmt(g.target_amount - g.current_amount)}</Text>
        </View>
      </View>
    )
  }

  const p = item.payment
  return (
    <TouchableOpacity style={[s.itemRow, { borderColor: p.color + '44' }]} onLongPress={() => onDeletePayment(p)} activeOpacity={0.85}>
      <View style={[s.itemIcon, { backgroundColor: p.color + '22' }]}>
        <Text style={{ fontSize: 20 }}>{p.icon}</Text>
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
        <Text style={s.itemSub}>{freqLabel(p.frequency)} · {fmt(p.amount)}</Text>
      </View>
      {item.isNext ? (
        <TouchableOpacity style={[s.payBtn, { backgroundColor: p.color }]} onPress={() => onMarkPaid(p)}>
          <Text style={s.payBtnText}>Marcar pagado</Text>
        </TouchableOpacity>
      ) : (
        <Text style={s.projectedText}>Proyectado</Text>
      )}
    </TouchableOpacity>
  )
}

function AddScheduledPaymentModal({ visible, categories, accounts, onClose, onSave }: {
  visible: boolean
  categories: Category[]
  accounts: Account[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<PaymentFrequency>('monthly')
  const [nextDate, setNextDate] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [accountId, setAccountId] = useState<string | undefined>(undefined)
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !amount) { showAlert('Error', 'Completa nombre y monto'); return }
    const num = parseFloat(amount.replace(',', '.'))
    if (isNaN(num) || num <= 0) { showAlert('Error', 'Monto inválido'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate) || isNaN(Date.parse(nextDate))) {
      showAlert('Error', 'Fecha inválida (usa formato YYYY-MM-DD)'); return
    }
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        amount: num,
        frequency,
        next_date: nextDate,
        category_id: categoryId,
        account_id: accountId,
        color,
        icon,
      })
      setName(''); setAmount(''); setFrequency('monthly'); setNextDate('')
      setCategoryId(undefined); setAccountId(undefined); setColor(COLORS[0]); setIcon(ICONS[0])
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
          <Text style={m.title}>Nuevo pago programado</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Crear'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          {/* Preview */}
          <View style={[m.preview, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={{ fontSize: 44 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={m.previewName}>{name || 'Mi pago'}</Text>
              <Text style={m.previewAmount}>{fmt(parseFloat(amount || '0'))} · {freqLabel(frequency)}</Text>
            </View>
          </View>

          <Text style={m.label}>Nombre</Text>
          <TextInput style={m.input} placeholder="Ej: Arriendo, Netflix, Gimnasio..." placeholderTextColor="#64748B" value={name} onChangeText={setName} />

          <Text style={m.label}>Monto</Text>
          <View style={m.amountRow}>
            <Text style={m.currency}>$</Text>
            <TextInput style={m.amountInput} placeholder="0" placeholderTextColor="#64748B" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>

          <Text style={m.label}>Frecuencia</Text>
          <View style={m.typeGrid}>
            {FREQUENCIES.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[m.typeItem, frequency === f.value && { backgroundColor: color + '33', borderColor: color }]}
                onPress={() => setFrequency(f.value)}
              >
                <Text style={{ fontSize: 18 }}>{f.icon}</Text>
                <Text style={[m.typeText, frequency === f.value && { color: '#F8FAFC' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Próxima fecha (YYYY-MM-DD)</Text>
          <TextInput style={m.input} placeholder="YYYY-MM-DD" placeholderTextColor="#64748B" value={nextDate} onChangeText={setNextDate} />

          <Text style={m.label}>Categoría (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <TouchableOpacity
              style={[m.chip, categoryId === undefined && { backgroundColor: '#33415566', borderColor: '#94A3B8' }]}
              onPress={() => setCategoryId(undefined)}
            >
              <Text style={m.chipIcon}>🚫</Text>
              <Text style={[m.chipName, categoryId === undefined && { color: '#F8FAFC' }]}>Sin categoría</Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[m.chip, categoryId === cat.id && { backgroundColor: cat.color + '44', borderColor: cat.color }]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text style={m.chipIcon}>{cat.icon}</Text>
                <Text style={[m.chipName, categoryId === cat.id && { color: '#F8FAFC' }]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={m.label}>Cuenta (opcional — al pagar descuenta de aquí)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <TouchableOpacity
              style={[m.chip, accountId === undefined && { backgroundColor: '#33415566', borderColor: '#94A3B8' }]}
              onPress={() => setAccountId(undefined)}
            >
              <Text style={m.chipIcon}>🔔</Text>
              <Text style={[m.chipName, accountId === undefined && { color: '#F8FAFC' }]}>Sin cuenta — solo recordatorio</Text>
            </TouchableOpacity>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backBtn: {},
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  scroll: { paddingHorizontal: 20 },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  monthBtnText: { color: '#6366F1', fontSize: 22, fontWeight: '700' },
  monthLabel: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },

  gridCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 10, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  weekRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekdayText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', margin: 1, minHeight: 44 },
  dayCellToday: { borderColor: '#6366F1' },
  dayCellSelected: { backgroundColor: '#6366F122' },
  dayNum: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 3, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: '#64748B', fontSize: 11 },

  dayTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  emptyDay: { backgroundColor: '#1E293B', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  emptyDayText: { color: '#64748B', fontSize: 14 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  itemIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  itemSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  payBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  payBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  projectedText: { color: '#475569', fontSize: 12, fontStyle: 'italic' },
})

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  cancel: { color: '#64748B', fontSize: 16 },
  save: { color: '#6366F1', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 20 },

  preview: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 28 },
  previewName: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  previewAmount: { color: '#94A3B8', fontSize: 14, marginTop: 2 },

  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, color: '#F8FAFC', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  currency: { color: '#475569', fontSize: 20, marginRight: 4 },
  amountInput: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '600', paddingVertical: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' },
  typeText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorSelected: { borderWidth: 3, borderColor: '#F8FAFC' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 40 },
  iconItem: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F172A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, borderWidth: 1, borderColor: '#334155' },
  chipIcon: { fontSize: 20 },
  chipName: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  chipBalance: { color: '#475569', fontSize: 11, marginTop: 2 },
})
