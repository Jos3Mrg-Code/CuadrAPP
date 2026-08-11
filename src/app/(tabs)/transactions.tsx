import { useState, useMemo, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, ScrollView, Alert, RefreshControl } from 'react-native'
import { showAlert } from '../../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useTransactions } from '../../hooks/useTransactions'
import { confirm } from '../../lib/confirm'
import { Transaction, Category, Account } from '../../types'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function today() {
  return new Date().toISOString().split('T')[0]
}

type Filter = 'all' | 'income' | 'expense'

export default function TransactionsScreen() {
  const { transactions, categories, accounts, loading, addTransaction, editTransaction, deleteTransaction, fetchLogs, refresh } = useTransactions()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  useFocusEffect(useCallback(() => { refresh() }, []))

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filter !== 'all' && tx.type !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        const desc = tx.description?.toLowerCase() ?? ''
        const cat = (tx.category as any)?.name?.toLowerCase() ?? ''
        if (!desc.includes(q) && !cat.includes(q)) return false
      }
      return true
    })
  }, [transactions, filter, search])

  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    filtered.forEach(tx => {
      const key = tx.date
      if (!map[key]) map[key] = []
      map[key].push(tx)
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const handleDelete = (tx: Transaction) => {
    confirm('Eliminar', '¿Eliminar esta transacción?', () => {
      setSelectedTx(null)
      deleteTransaction(tx)
    })
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Movimientos</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { refresh(); setShowModal(true) }}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar transacción..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'income', 'expense'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={grouped}
        keyExtractor={([date]) => date}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyText}>No hay transacciones</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => { refresh(); setShowModal(true) }}>
              <Text style={styles.emptyBtnText}>+ Agregar la primera</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: [date, txs] }) => (
          <View style={styles.group}>
            <Text style={styles.groupDate}>{formatDate(date)}</Text>
            {txs.map(tx => (
              <TouchableOpacity
                key={tx.id}
                style={styles.txRow}
                onPress={() => setSelectedTx(tx)}
                onLongPress={() => handleDelete(tx)}
              >
                <View style={[styles.txIcon, { backgroundColor: ((tx.category as any)?.color ?? '#6366F1') + '22' }]}>
                  <Text style={{ fontSize: 20 }}>{(tx.category as any)?.icon ?? '💸'}</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {tx.description || (tx.category as any)?.name || 'Transacción'}
                  </Text>
                  <Text style={styles.txCat}>{(tx.category as any)?.name}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'income' ? '#34D399' : '#F87171' }]}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      <AddTransactionModal
        visible={showModal}
        categories={categories}
        accounts={accounts}
        onClose={() => setShowModal(false)}
        onSave={addTransaction}
      />

      <TransactionDetailModal
        tx={selectedTx}
        categories={categories}
        accounts={accounts}
        onClose={() => setSelectedTx(null)}
        onDelete={(tx) => handleDelete(tx)}
        onEdit={editTransaction}
        fetchLogs={fetchLogs}
      />
    </SafeAreaView>
  )
}

function AddTransactionModal({ visible, categories, accounts, onClose, onSave }: {
  visible: boolean
  categories: Category[]
  accounts: Account[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  const filteredCats = categories.filter(c => c.type === type)

  const handleSave = async () => {
    if (!amount || !categoryId || !accountId) {
      showAlert('Error', 'Completa monto, categoría y cuenta')
      return
    }
    const numAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) {
      showAlert('Error', 'Monto inválido')
      return
    }
    setSaving(true)
    try {
      await onSave({ type, amount: numAmount, description, category_id: categoryId, account_id: accountId, date })
      setAmount(''); setDescription(''); setCategoryId(''); setAccountId(''); setDate(today())
      onClose()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose}><Text style={modal.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={modal.title}>Nueva transacción</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={modal.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={modal.scroll} showsVerticalScrollIndicator={false}>
          {/* Tipo */}
          <View style={modal.typeRow}>
            <TouchableOpacity
              style={[modal.typeBtn, type === 'expense' && modal.typeBtnExpense]}
              onPress={() => { setType('expense'); setCategoryId('') }}
            >
              <Text style={[modal.typeText, type === 'expense' && { color: '#F87171' }]}>↓ Gasto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.typeBtn, type === 'income' && modal.typeBtnIncome]}
              onPress={() => { setType('income'); setCategoryId('') }}
            >
              <Text style={[modal.typeText, type === 'income' && { color: '#34D399' }]}>↑ Ingreso</Text>
            </TouchableOpacity>
          </View>

          {/* Monto */}
          <View style={modal.amountWrap}>
            <Text style={modal.currencySymbol}>$</Text>
            <TextInput
              style={modal.amountInput}
              placeholder="0.00"
              placeholderTextColor="#334155"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          {/* Descripción */}
          <TextInput
            style={modal.input}
            placeholder="Descripción (opcional)"
            placeholderTextColor="#64748B"
            value={description}
            onChangeText={setDescription}
          />

          {/* Fecha */}
          <TextInput
            style={modal.input}
            placeholder="Fecha (YYYY-MM-DD)"
            placeholderTextColor="#64748B"
            value={date}
            onChangeText={setDate}
          />

          {/* Cuenta */}
          <Text style={modal.label}>Cuenta</Text>
          {accounts.length === 0 ? (
            <Text style={modal.noData}>Primero crea una cuenta en la pestaña Cuentas</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.chipScroll}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[modal.chip, accountId === acc.id && { backgroundColor: acc.color + '44', borderColor: acc.color }]}
                  onPress={() => setAccountId(acc.id)}
                >
                  <Text style={modal.chipIcon}>{acc.icon}</Text>
                  <Text style={[modal.chipText, accountId === acc.id && { color: '#F8FAFC' }]}>{acc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Categoría */}
          <Text style={modal.label}>Categoría</Text>
          <View style={modal.catGrid}>
            {filteredCats.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[modal.catItem, categoryId === cat.id && { backgroundColor: cat.color + '33', borderColor: cat.color }]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                <Text style={[modal.catText, categoryId === cat.id && { color: '#F8FAFC' }]} numberOfLines={1}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

function TransactionDetailModal({ tx, categories, accounts, onClose, onDelete, onEdit, fetchLogs }: {
  tx: Transaction | null
  categories: Category[]
  accounts: Account[]
  onClose: () => void
  onDelete: (tx: Transaction) => void
  onEdit: (original: Transaction, updated: any) => Promise<void>
  fetchLogs: (id: string) => Promise<any[]>
}) {
  const [editing, setEditing] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tx) return
    setEditing(false)
    setShowLogs(false)
    setType(tx.type)
    setAmount(tx.amount.toString())
    setDescription(tx.description ?? '')
    setCategoryId(tx.category_id)
    setAccountId(tx.account_id)
    setDate(tx.date)
  }, [tx?.id])

  const loadLogs = async () => {
    if (!tx) return
    const data = await fetchLogs(tx.id)
    setLogs(data)
    setShowLogs(true)
  }

  const handleSave = async () => {
    if (!tx) return
    const numAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) { showAlert('Error', 'Monto inválido'); return }
    if (!categoryId || !accountId) { showAlert('Error', 'Selecciona categoría y cuenta'); return }
    setSaving(true)
    try {
      await onEdit(tx, { type, amount: numAmount, description, category_id: categoryId, account_id: accountId, date })
      setEditing(false)
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!tx) return null
  const cat = tx.category as any
  const acc = tx.account as any
  const isIncome = tx.type === 'income'
  const color = isIncome ? '#34D399' : '#F87171'
  const filteredCats = categories.filter(c => c.type === type)

  return (
    <Modal visible={!!tx} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <TouchableOpacity onPress={() => editing ? setEditing(false) : onClose()}>
            <Text style={detail.close}>{editing ? 'Cancelar' : 'Cerrar'}</Text>
          </TouchableOpacity>
          <Text style={detail.title}>{editing ? 'Editar' : 'Detalle'}</Text>
          {editing ? (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={detail.save}>{saving ? '...' : 'Guardar'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={detail.editBtn}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {!editing ? (
            <>
              {/* Hero vista */}
              <View style={detail.hero}>
                <View style={[detail.heroIcon, { backgroundColor: (cat?.color ?? '#6366F1') + '22' }]}>
                  <Text style={{ fontSize: 44 }}>{cat?.icon ?? '💸'}</Text>
                </View>
                <Text style={[detail.heroAmount, { color }]}>
                  {isIncome ? '+' : '-'}{fmt(tx.amount)}
                </Text>
                <Text style={detail.heroDesc}>{tx.description || cat?.name || 'Transacción'}</Text>
                <View style={[detail.typePill, { backgroundColor: color + '22' }]}>
                  <Text style={[detail.typePillText, { color }]}>{isIncome ? '↑ Ingreso' : '↓ Gasto'}</Text>
                </View>
              </View>

              <View style={detail.infoBox}>
                <DetailRow icon="📅" label="Fecha" value={new Date(tx.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
                <DetailRow icon="🕐" label="Registrado" value={new Date(tx.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} />
                <DetailRow icon={acc?.icon ?? '🏦'} label="Cuenta" value={acc?.name ?? '—'} />
                <DetailRow icon={cat?.icon ?? '💸'} label="Categoría" value={cat?.name ?? '—'} last />
              </View>

              {/* Acciones */}
              <View style={detail.actions}>
                <TouchableOpacity style={detail.logBtn} onPress={loadLogs}>
                  <Text style={detail.logBtnText}>📋 Ver historial de cambios</Text>
                </TouchableOpacity>
                <TouchableOpacity style={detail.deleteBtn} onPress={() => onDelete(tx)}>
                  <Text style={detail.deleteBtnText}>🗑 Eliminar transacción</Text>
                </TouchableOpacity>
              </View>

              {/* Trazabilidad */}
              {showLogs && (
                <View style={detail.logsBox}>
                  <Text style={detail.logsTitle}>Historial</Text>
                  {logs.length === 0 ? (
                    <Text style={detail.logsEmpty}>Sin registros de cambios</Text>
                  ) : (
                    logs.map(log => (
                      <View key={log.id} style={detail.logRow}>
                        <Text style={detail.logAction}>{logLabel(log.action)}</Text>
                        <Text style={detail.logDate}>{new Date(log.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                        {log.changes && Object.entries(log.changes).map(([field, val]: any) => (
                          <Text key={field} style={detail.logChange}>• {fieldLabel(field)}: {String(val.from)} → {String(val.to)}</Text>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          ) : (
            /* Modo edición */
            <View style={{ padding: 20 }}>
              <View style={modal.typeRow}>
                <TouchableOpacity style={[modal.typeBtn, type === 'expense' && modal.typeBtnExpense]} onPress={() => { setType('expense'); setCategoryId('') }}>
                  <Text style={[modal.typeText, type === 'expense' && { color: '#F87171' }]}>↓ Gasto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[modal.typeBtn, type === 'income' && modal.typeBtnIncome]} onPress={() => { setType('income'); setCategoryId('') }}>
                  <Text style={[modal.typeText, type === 'income' && { color: '#34D399' }]}>↑ Ingreso</Text>
                </TouchableOpacity>
              </View>

              <View style={modal.amountWrap}>
                <Text style={modal.currencySymbol}>$</Text>
                <TextInput style={modal.amountInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#334155" />
              </View>

              <TextInput style={modal.input} placeholder="Descripción" placeholderTextColor="#64748B" value={description} onChangeText={setDescription} />
              <TextInput style={modal.input} placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor="#64748B" value={date} onChangeText={setDate} />

              <Text style={modal.label}>Cuenta</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {accounts.map(acc => (
                  <TouchableOpacity key={acc.id} style={[modal.chip, accountId === acc.id && { backgroundColor: acc.color + '44', borderColor: acc.color }]} onPress={() => setAccountId(acc.id)}>
                    <Text style={modal.chipIcon}>{acc.icon}</Text>
                    <Text style={[modal.chipText, accountId === acc.id && { color: '#F8FAFC' }]}>{acc.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={modal.label}>Categoría</Text>
              <View style={modal.catGrid}>
                {filteredCats.map(cat => (
                  <TouchableOpacity key={cat.id} style={[modal.catItem, categoryId === cat.id && { backgroundColor: cat.color + '33', borderColor: cat.color }]} onPress={() => setCategoryId(cat.id)}>
                    <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                    <Text style={[modal.catText, categoryId === cat.id && { color: '#F8FAFC' }]} numberOfLines={1}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

function logLabel(action: string) {
  return action === 'created' ? '✅ Creado' : action === 'edited' ? '✏️ Editado' : '🗑 Eliminado'
}

function fieldLabel(field: string) {
  const map: Record<string, string> = { amount: 'Monto', type: 'Tipo', account_id: 'Cuenta', category_id: 'Categoría', description: 'Descripción', date: 'Fecha' }
  return map[field] ?? field
}

function DetailRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[detail.row, !last && detail.rowBorder]}>
      <Text style={detail.rowIcon}>{icon}</Text>
      <View style={detail.rowInfo}>
        <Text style={detail.rowLabel}>{label}</Text>
        <Text style={detail.rowValue}>{value}</Text>
      </View>
    </View>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 15, paddingVertical: 12 },
  filters: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  filterActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  group: { marginBottom: 20 },
  groupDate: { color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'capitalize' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', borderRadius: 16, padding: 14, marginBottom: 8 },
  txIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { color: '#F8FAFC', fontSize: 15, fontWeight: '500' },
  txCat: { color: '#64748B', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#64748B', fontSize: 16, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#6366F1', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
})

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  cancel: { color: '#64748B', fontSize: 16 },
  save: { color: '#6366F1', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 20 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#1E293B', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  typeBtnExpense: { backgroundColor: '#EF444411', borderColor: '#EF444433' },
  typeBtnIncome: { backgroundColor: '#10B98111', borderColor: '#10B98133' },
  typeText: { color: '#64748B', fontSize: 16, fontWeight: '700' },
  amountWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  currencySymbol: { color: '#475569', fontSize: 40, fontWeight: '300', marginRight: 4 },
  amountInput: { color: '#F8FAFC', fontSize: 56, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  input: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, color: '#F8FAFC', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  label: { color: '#94A3B8', fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  noData: { color: '#64748B', fontSize: 14, marginBottom: 16, fontStyle: 'italic' },
  chipScroll: { marginBottom: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  chipIcon: { fontSize: 16 },
  chipText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 40 },
  catItem: { width: '30%', alignItems: 'center', padding: 12, backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  catText: { color: '#64748B', fontSize: 11, marginTop: 6, textAlign: 'center' },
})

const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  close: { color: '#64748B', fontSize: 16 },
  delete: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  heroIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroAmount: { fontSize: 42, fontWeight: '800', marginBottom: 8 },
  heroDesc: { color: '#94A3B8', fontSize: 17, marginBottom: 14, textAlign: 'center' },
  typePill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  typePillText: { fontSize: 14, fontWeight: '700' },
  infoBox: { marginHorizontal: 20, backgroundColor: '#1E293B', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  rowIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { color: '#64748B', fontSize: 12, marginBottom: 2 },
  rowValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '500', textTransform: 'capitalize' },
  save: { color: '#6366F1', fontSize: 16, fontWeight: '700' },
  editBtn: { color: '#6366F1', fontSize: 16, fontWeight: '600' },
  actions: { marginHorizontal: 20, marginTop: 20, gap: 10 },
  logBtn: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  logBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#EF444411', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#EF444433' },
  deleteBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  logsBox: { margin: 20, backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  logsTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 14 },
  logsEmpty: { color: '#64748B', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  logRow: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  logAction: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  logDate: { color: '#64748B', fontSize: 12, marginBottom: 6 },
  logChange: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
})
