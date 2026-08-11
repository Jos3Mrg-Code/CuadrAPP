import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { showAlert } from '../lib/alert'
import { usePlan } from '../hooks/usePlan'
import { useAdminUsers } from '../hooks/useAdminUsers'
import { PremiumLocked } from '../components/PremiumLocked'
import { formatPlanDate, daysLeft } from '../lib/plan'
import { AdminUserRow, PlanTier } from '../types'

function shortDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminScreen() {
  const { isAdmin, loading: planLoading, plan } = usePlan()
  const { users, loading, error, premiumCount, freeCount, setPlan, refresh } = useAdminUsers()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AdminUserRow | null>(null)

  if (!planLoading && !isAdmin) return <PremiumLocked feature="" denied />

  const q = query.trim().toLowerCase()
  const filtered = q
    ? users.filter(u => u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q))
    : users

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Usuarios</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={s.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Text style={s.summaryValue}>{users.length}</Text>
          <Text style={s.summaryLabel}>Total</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={[s.summaryValue, { color: '#34D399' }]}>{premiumCount}</Text>
          <Text style={s.summaryLabel}>Premium</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={[s.summaryValue, { color: '#94A3B8' }]}>{freeCount}</Text>
          <Text style={s.summaryLabel}>Gratis</Text>
        </View>
      </View>

      <TextInput
        style={s.search}
        placeholder="Buscar por correo o nombre"
        placeholderTextColor="#64748B"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {loading ? (
        <View style={s.loadingBox}><ActivityIndicator size="large" color="#6366F1" /></View>
      ) : error ? (
        <View style={s.loadingBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
          ListEmptyComponent={<Text style={s.empty}>Sin resultados</Text>}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              isSelf={item.id === plan?.user_id}
              onPress={() => setSelected(item)}
            />
          )}
        />
      )}

      <PlanModal
        user={selected}
        onClose={() => setSelected(null)}
        onSave={async (userId, planTier, expiresAt, note) => {
          try {
            await setPlan(userId, planTier, expiresAt, note)
            setSelected(null)
            showAlert('Listo', 'Plan actualizado')
          } catch (e: any) {
            showAlert('Error', e.message)
          }
        }}
      />
    </SafeAreaView>
  )
}

function UserCard({ user, isSelf, onPress }: { user: AdminUserRow; isSelf: boolean; onPress: () => void }) {
  const initials = user.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const left = user.plan === 'premium' && user.expires_at ? daysLeft(user.expires_at) : null
  const expired = left !== null && left < 0

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={s.avatar}><Text style={s.avatarText}>{initials || '?'}</Text></View>
      <View style={s.cardInfo}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardName} numberOfLines={1}>
            {user.full_name}{isSelf ? ' · Tú' : ''}
          </Text>
          {user.is_admin && <Text style={s.adminBadge}>🛡️</Text>}
        </View>
        <Text style={s.cardEmail} numberOfLines={1}>{user.email}</Text>
        {user.plan === 'premium' && user.expires_at && (
          <Text style={[s.cardExpiry, expired ? { color: '#F87171' } : left !== null && left <= 7 ? { color: '#F97316' } : null]}>
            {expired ? `Venció el ${formatPlanDate(user.expires_at)}` : `Vence el ${formatPlanDate(user.expires_at)}`}
          </Text>
        )}
        <Text style={s.cardMeta}>
          Registrado {shortDate(user.created_at)} · {user.tx_count} movimiento{user.tx_count !== 1 ? 's' : ''}
          {user.last_tx ? ` · último ${shortDate(user.last_tx)}` : ''}
        </Text>
      </View>
      <View style={[s.planPill, user.plan === 'premium' ? s.planPillPremium : s.planPillFree]}>
        <Text style={[s.planPillText, user.plan === 'premium' && { color: '#34D399' }]}>
          {user.plan === 'premium' ? 'PREMIUM' : 'GRATIS'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const PRESETS = [
  { label: 'Sin vencimiento', months: null },
  { label: '1 mes', months: 1 },
  { label: '3 meses', months: 3 },
  { label: '1 año', months: 12 },
]

function PlanModal({ user, onClose, onSave }: {
  user: AdminUserRow | null
  onClose: () => void
  onSave: (userId: string, plan: PlanTier, expiresAt: string | null, note: string | null) => Promise<void>
}) {
  const [tier, setTier] = useState<PlanTier>('free')
  const [expiry, setExpiry] = useState<string>('')   // YYYY-MM-DD, vacío = sin vencimiento
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setTier(user.plan)
    setExpiry(user.expires_at ? user.expires_at.slice(0, 10) : '')
    setNote(user.note ?? '')
  }, [user?.id])

  if (!user) return null

  const applyPreset = (months: number | null) => {
    if (months === null) { setExpiry(''); return }
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    setExpiry(d.toISOString().slice(0, 10))
  }

  const handleSave = async () => {
    if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || isNaN(Date.parse(expiry)))) {
      showAlert('Error', 'Fecha inválida (usa formato YYYY-MM-DD)')
      return
    }
    setSaving(true)
    try {
      await onSave(
        user.id,
        tier,
        tier === 'premium' && expiry ? `${expiry}T23:59:59Z` : null,
        note.trim() || null,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={!!user} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={m.title}>Cambiar plan</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          <View style={m.userBox}>
            <Text style={m.userName}>{user.full_name}</Text>
            <Text style={m.userEmail} selectable>{user.email}</Text>
          </View>

          <Text style={m.label}>Plan</Text>
          <View style={m.segment}>
            {(['free', 'premium'] as PlanTier[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[m.segmentBtn, tier === t && m.segmentBtnActive]}
                onPress={() => setTier(t)}
              >
                <Text style={[m.segmentText, tier === t && m.segmentTextActive]}>
                  {t === 'free' ? 'Gratis' : 'Premium'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tier === 'premium' && (
            <>
              <Text style={m.label}>Vencimiento</Text>
              <View style={m.presetRow}>
                {PRESETS.map(p => (
                  <TouchableOpacity key={p.label} style={m.preset} onPress={() => applyPreset(p.months)}>
                    <Text style={m.presetText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={m.input}
                placeholder="YYYY-MM-DD (vacío = sin vencimiento)"
                placeholderTextColor="#64748B"
                value={expiry}
                onChangeText={setExpiry}
              />
            </>
          )}

          <Text style={m.label}>Nota interna</Text>
          <TextInput
            style={m.input}
            placeholder="Ej: pagó por Nequi el 26/07"
            placeholderTextColor="#64748B"
            value={note}
            onChangeText={setNote}
            maxLength={500}
          />

          <Text style={m.hint}>
            El rol de administrador no se cambia desde aquí: solo se puede modificar directamente
            en la base de datos.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 70 },
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },
  refreshText: { color: '#6366F1', fontSize: 20, width: 70, textAlign: 'right' },

  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  summaryValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: '#64748B', fontSize: 11, marginTop: 2 },

  search: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, color: '#F8FAFC', fontSize: 14, borderWidth: 1, borderColor: '#334155' },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 40 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  adminBadge: { fontSize: 12 },
  cardEmail: { color: '#64748B', fontSize: 12, marginTop: 2 },
  cardExpiry: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  cardMeta: { color: '#475569', fontSize: 11, marginTop: 3 },
  planPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  planPillPremium: { backgroundColor: '#10B98122', borderColor: '#10B98155' },
  planPillFree: { backgroundColor: '#33415566', borderColor: '#334155' },
  planPillText: { color: '#94A3B8', fontSize: 9, fontWeight: '800' },
})

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  cancel: { color: '#64748B', fontSize: 16 },
  save: { color: '#6366F1', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 20 },

  userBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 24 },
  userName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  userEmail: { color: '#64748B', fontSize: 13, marginTop: 3 },

  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  segment: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  segmentBtn: { flex: 1, paddingVertical: 13, backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#6366F133', borderColor: '#6366F1' },
  segmentText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  segmentTextActive: { color: '#A5B4FC' },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  preset: { backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  presetText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  input: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, color: '#F8FAFC', fontSize: 15, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  hint: { color: '#475569', fontSize: 12, lineHeight: 18, marginBottom: 40 },
})
