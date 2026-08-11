import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, ScrollView, Alert, RefreshControl } from 'react-native'
import { showAlert } from '../../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { router } from 'expo-router'
import { useAccounts } from '../../hooks/useAccounts'
import { usePlan } from '../../hooks/usePlan'
import { FREE_LIMITS } from '../../lib/plan'
import { confirm } from '../../lib/confirm'
import { Account, AccountType } from '../../types'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash',       label: 'Efectivo',    icon: '💵' },
  { value: 'bank',       label: 'Banco',       icon: '🏦' },
  { value: 'credit',     label: 'Crédito',     icon: '💳' },
  { value: 'savings',    label: 'Ahorros',     icon: '🐷' },
  { value: 'investment', label: 'Inversión',   icon: '📈' },
]

const COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444',
  '#14B8A6', '#84CC16',
]

const ICONS = ['💵', '🏦', '💳', '🐷', '📈', '💰', '🪙', '💎', '🏧', '💼']

export default function AccountsScreen() {
  const { accounts, loading, totalBalance, addAccount, editAccount, deleteAccount, refresh } = useAccounts()
  const { isPremium } = usePlan()
  const [showModal, setShowModal] = useState(false)
  const atLimit = !isPremium && accounts.length >= FREE_LIMITS.accounts
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  useFocusEffect(useCallback(() => { refresh() }, []))

  const handleDelete = (id: string, name: string) => {
    confirm('Archivar cuenta', `¿Archivar la cuenta "${name}"?`, () => deleteAccount(id))
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Cuentas</Text>
        <TouchableOpacity
          style={[styles.addBtn, atLimit && styles.addBtnLocked]}
          onPress={() => (atLimit ? router.push('/upgrade') : setShowModal(true))}
        >
          <Text style={styles.addBtnText}>{atLimit ? '🔒 Límite' : '+ Nueva'}</Text>
        </TouchableOpacity>
      </View>

      {atLimit && (
        <TouchableOpacity style={styles.limitBanner} onPress={() => router.push('/upgrade')}>
          <Text style={styles.limitText}>
            Usaste {accounts.length}/{FREE_LIMITS.accounts} cuentas del plan gratis · Hazte Premium
          </Text>
        </TouchableOpacity>
      )}

      {/* Total balance */}
      <View style={styles.totalCard}>
        <View style={styles.totalGlow} />
        <Text style={styles.totalLabel}>Balance total</Text>
        <Text style={styles.totalAmount}>{fmt(totalBalance)}</Text>
        <Text style={styles.totalSub}>{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} activa{accounts.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Lista de cuentas */}
      <FlatList
        data={accounts}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏦</Text>
              <Text style={styles.emptyText}>No tienes cuentas aún</Text>
              <Text style={styles.emptySub}>Agrega tu primera cuenta para empezar a registrar movimientos</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyBtnText}>+ Crear cuenta</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item: acc }) => {
          const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type)
          return (
            <TouchableOpacity
              style={[styles.accountCard, { borderLeftColor: acc.color, borderLeftWidth: 4 }]}
              onPress={() => setEditingAccount(acc)}
              onLongPress={() => handleDelete(acc.id, acc.name)}
              activeOpacity={0.8}
            >
              <View style={[styles.accountIcon, { backgroundColor: acc.color + '22' }]}>
                <Text style={{ fontSize: 26 }}>{acc.icon}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{acc.name}</Text>
                <View style={styles.accountTypePill}>
                  <Text style={styles.accountTypeText}>{typeInfo?.label ?? acc.type}</Text>
                </View>
              </View>
              <View style={styles.accountRight}>
                <Text style={[styles.accountBalance, { color: acc.balance < 0 ? '#F87171' : '#F8FAFC' }]}>
                  {fmt(acc.balance)}
                </Text>
                <Text style={styles.accountBalanceLabel}>toca para editar</Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <AddAccountModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={addAccount}
      />
      <EditAccountModal
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={editAccount}
        onDelete={(id, name) => { setEditingAccount(null); handleDelete(id, name) }}
      />
    </SafeAreaView>
  )
}

function EditAccountModal({ account, onClose, onSave, onDelete }: {
  account: Account | null
  onClose: () => void
  onSave: (id: string, data: any) => Promise<void>
  onDelete: (id: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (account) {
      setName(account.name)
      setBalance(account.balance.toString())
      setColor(account.color)
      setIcon(account.icon)
    }
  }, [account])

  if (!account) return null

  const handleSave = async () => {
    const num = parseFloat(balance.replace(',', '.'))
    if (!name.trim() || isNaN(num)) { showAlert('Error', 'Datos inválidos'); return }
    setSaving(true)
    try {
      await onSave(account.id, { name: name.trim(), balance: num, color, icon })
      onClose()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={!!account} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose}><Text style={modal.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={modal.title}>Editar cuenta</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={modal.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={modal.scroll} showsVerticalScrollIndicator={false}>
          <View style={[modal.preview, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={{ fontSize: 40 }}>{icon}</Text>
            <View>
              <Text style={modal.previewName}>{name}</Text>
              <Text style={modal.previewBalance}>{fmt(parseFloat(balance || '0'))}</Text>
            </View>
          </View>

          <Text style={modal.label}>Nombre</Text>
          <TextInput style={modal.input} value={name} onChangeText={setName} placeholderTextColor="#64748B" />

          <Text style={modal.label}>Saldo actual</Text>
          <View style={modal.amountRow}>
            <Text style={modal.currency}>$</Text>
            <TextInput style={modal.amountInput} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholderTextColor="#64748B" />
          </View>

          <Text style={modal.label}>Color</Text>
          <View style={modal.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity key={c} style={[modal.colorDot, { backgroundColor: c }, color === c && modal.colorSelected]} onPress={() => setColor(c)} />
            ))}
          </View>

          <Text style={modal.label}>Ícono</Text>
          <View style={modal.iconGrid}>
            {ICONS.map(ic => (
              <TouchableOpacity key={ic} style={[modal.iconItem, icon === ic && { backgroundColor: color + '33', borderColor: color }]} onPress={() => setIcon(ic)}>
                <Text style={{ fontSize: 26 }}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={modal.deleteBtn} onPress={() => onDelete(account.id, account.name)}>
            <Text style={modal.deleteBtnText}>🗑 Archivar cuenta</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

function AddAccountModal({ visible, onClose, onSave }: {
  visible: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Error', 'Ingresa un nombre para la cuenta'); return }
    const numBalance = parseFloat(balance.replace(',', '.') || '0')
    setSaving(true)
    try {
      await onSave({ name: name.trim(), type, balance: numBalance, color, icon })
      setName(''); setType('bank'); setBalance(''); setColor(COLORS[0]); setIcon(ICONS[0])
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
          <Text style={modal.title}>Nueva cuenta</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={modal.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={modal.scroll} showsVerticalScrollIndicator={false}>
          {/* Preview */}
          <View style={[modal.preview, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={{ fontSize: 40 }}>{icon}</Text>
            <View>
              <Text style={modal.previewName}>{name || 'Mi cuenta'}</Text>
              <Text style={modal.previewBalance}>{fmt(parseFloat(balance || '0'))}</Text>
            </View>
          </View>

          {/* Nombre */}
          <Text style={modal.label}>Nombre de la cuenta</Text>
          <TextInput
            style={modal.input}
            placeholder="Ej: Bancolombia, Efectivo..."
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
          />

          {/* Saldo inicial */}
          <Text style={modal.label}>Saldo inicial</Text>
          <View style={modal.amountRow}>
            <Text style={modal.currency}>$</Text>
            <TextInput
              style={modal.amountInput}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Tipo */}
          <Text style={modal.label}>Tipo de cuenta</Text>
          <View style={modal.typeGrid}>
            {ACCOUNT_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[modal.typeItem, type === t.value && { backgroundColor: color + '33', borderColor: color }]}
                onPress={() => setType(t.value)}
              >
                <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                <Text style={[modal.typeText, type === t.value && { color: '#F8FAFC' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color */}
          <Text style={modal.label}>Color</Text>
          <View style={modal.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[modal.colorDot, { backgroundColor: c }, color === c && modal.colorSelected]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          {/* Ícono */}
          <Text style={modal.label}>Ícono</Text>
          <View style={modal.iconGrid}>
            {ICONS.map(ic => (
              <TouchableOpacity
                key={ic}
                style={[modal.iconItem, icon === ic && { backgroundColor: color + '33', borderColor: color }]}
                onPress={() => setIcon(ic)}
              >
                <Text style={{ fontSize: 26 }}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnLocked: { backgroundColor: '#334155' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  limitBanner: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#F9731618', borderWidth: 1, borderColor: '#F9731644', borderRadius: 14, padding: 12 },
  limitText: { color: '#F97316', fontSize: 12, textAlign: 'center' },

  totalCard: {
    marginHorizontal: 20, marginBottom: 24, backgroundColor: '#1E293B',
    borderRadius: 24, padding: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: '#334155',
  },
  totalGlow: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: '#6366F1', opacity: 0.15 },
  totalLabel: { color: '#94A3B8', fontSize: 13, marginBottom: 6 },
  totalAmount: { color: '#F8FAFC', fontSize: 34, fontWeight: '800', marginBottom: 4 },
  totalSub: { color: '#475569', fontSize: 13 },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1E293B', borderRadius: 18, padding: 16,
    marginBottom: 12,
  },
  accountIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  accountInfo: { flex: 1 },
  accountName: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  accountTypePill: { backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  accountTypeText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  accountRight: { alignItems: 'flex-end' },
  accountBalance: { fontSize: 18, fontWeight: '800' },
  accountBalanceLabel: { color: '#475569', fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
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

  preview: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 28 },
  previewName: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  previewBalance: { color: '#94A3B8', fontSize: 14, marginTop: 2 },

  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, color: '#F8FAFC', fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  currency: { color: '#475569', fontSize: 20, marginRight: 4 },
  amountInput: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '600', paddingVertical: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  typeItem: { width: '18%', alignItems: 'center', padding: 10, backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  typeText: { color: '#64748B', fontSize: 10, marginTop: 4, textAlign: 'center' },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorSelected: { borderWidth: 3, borderColor: '#F8FAFC' },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  iconItem: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155' },

  deleteBtn: { backgroundColor: '#EF444422', borderWidth: 1, borderColor: '#EF4444', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 40, marginTop: 8 },
  deleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
})
