import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, Switch, Platform,
} from 'react-native'
import { showAlert } from '../../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { usePlan } from '../../hooks/usePlan'
import { confirm } from '../../lib/confirm'
import { Category, TransactionType } from '../../types'

const CATEGORY_COLORS = [
  '#6366F1', '#EC4899', '#F97316', '#10B981',
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444',
  '#14B8A6', '#84CC16',
]
const CATEGORY_ICONS = ['🍔', '🚗', '🏠', '💊', '🎮', '👗', '📚', '✈️', '🐾', '💡', '🏋️', '🎵', '💼', '🛒', '🎁', '💰', '📱', '🧾']

export default function SettingsScreen() {
  const { user, session, signOut } = useAuthStore()
  const setUser = useAuthStore(s => s.setUser)
  const { isPremium, isAdmin } = usePlan()

  const [categories, setCategories] = useState<Category[]>([])
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [expandedIncome, setExpandedIncome] = useState(false)
  const [expandedExpense, setExpandedExpense] = useState(false)

  useFocusEffect(useCallback(() => { fetchCategories() }, []))

  const fetchCategories = async () => {
    if (!session) return
    const { data } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${session.user.id},is_default.eq.true`)
      .order('is_default', { ascending: false })
      .order('name')
    setCategories((data as Category[]) ?? [])
  }

  const handleSignOut = () => {
    confirm('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', async () => {
      await supabase.auth.signOut()
      signOut()
    })
  }

  const deleteCategory = async (cat: Category) => {
    confirm('Eliminar categoría', `¿Eliminar "${cat.name}"?`, async () => {
      await supabase.from('categories').delete().eq('id', cat.id)
      fetchCategories()
    })
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <Text style={s.screenTitle}>Ajustes</Text>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.full_name ?? '—'}</Text>
            <Text style={s.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={s.editBtn} onPress={() => setShowEditProfile(true)}>
            <Text style={s.editBtnText}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* Section: Cuenta */}
        <Text style={s.sectionTitle}>Cuenta</Text>
        <View style={s.card}>
          <SettingRow
            icon="⭐"
            label="Mi plan"
            value={isPremium ? 'Premium' : 'Gratis'}
            onPress={() => router.push('/upgrade')}
          />
          <SettingRow icon="🔑" label="Cambiar contraseña" onPress={() => setShowChangePassword(true)} />
          <SettingRow icon="⚡" label="Atajo rápido" onPress={() => router.push('/shortcut')} />
        </View>

        {isAdmin && (
          <>
            <Text style={s.sectionTitle}>Administración</Text>
            <View style={s.card}>
              <SettingRow icon="🛡️" label="Usuarios y planes" onPress={() => router.push('/admin')} />
            </View>
          </>
        )}

        {/* Section: Categorías */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Categorías</Text>
          <TouchableOpacity onPress={() => setShowAddCategory(true)}>
            <Text style={s.sectionAction}>+ Nueva</Text>
          </TouchableOpacity>
        </View>

        {incomeCategories.length > 0 && (
          <>
            <TouchableOpacity style={s.accordionHeader} onPress={() => setExpandedIncome(v => !v)} activeOpacity={0.7}>
              <Text style={s.catType}>Ingresos</Text>
              <View style={s.accordionRight}>
                <Text style={s.accordionCount}>{incomeCategories.length}</Text>
                <Text style={s.accordionChevron}>{expandedIncome ? '▾' : '▸'}</Text>
              </View>
            </TouchableOpacity>
            {expandedIncome && (
              <View style={s.card}>
                {incomeCategories.map((cat, i) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    last={i === incomeCategories.length - 1}
                    onDelete={cat.is_default ? undefined : () => deleteCategory(cat)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {expenseCategories.length > 0 && (
          <>
            <TouchableOpacity style={s.accordionHeader} onPress={() => setExpandedExpense(v => !v)} activeOpacity={0.7}>
              <Text style={s.catType}>Gastos</Text>
              <View style={s.accordionRight}>
                <Text style={s.accordionCount}>{expenseCategories.length}</Text>
                <Text style={s.accordionChevron}>{expandedExpense ? '▾' : '▸'}</Text>
              </View>
            </TouchableOpacity>
            {expandedExpense && (
              <View style={s.card}>
                {expenseCategories.map((cat, i) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    last={i === expenseCategories.length - 1}
                    onDelete={cat.is_default ? undefined : () => deleteCategory(cat)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Section: Sobre la app */}
        <Text style={s.sectionTitle}>Sobre la app</Text>
        <View style={s.card}>
          <View style={s.rowContainer}>
            <Text style={s.rowIcon}>📱</Text>
            <Text style={s.rowLabel}>CuadrAPP</Text>
            <Text style={s.rowValue}>v1.0.0</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>🚪 Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <EditProfileModal
        visible={showEditProfile}
        currentName={user?.full_name ?? ''}
        onClose={() => setShowEditProfile(false)}
        onSave={async (name) => {
          if (!session) return
          await supabase.from('profiles').update({ full_name: name }).eq('id', session.user.id)
          setUser({ ...user!, full_name: name })
          setShowEditProfile(false)
        }}
      />

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <AddCategoryModal
        visible={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={async (data) => {
          if (!session) return
          await supabase.from('categories').insert({ ...data, user_id: session.user.id, is_default: false })
          fetchCategories()
          setShowAddCategory(false)
        }}
      />
    </SafeAreaView>
  )
}

function SettingRow({ icon, label, onPress, value }: { icon: string; label: string; onPress?: () => void; value?: string }) {
  return (
    <TouchableOpacity style={s.rowContainer} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={s.rowIcon}>{icon}</Text>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : <Text style={s.rowChevron}>›</Text>}
    </TouchableOpacity>
  )
}

function CategoryRow({ cat, last, onDelete }: { cat: Category; last: boolean; onDelete?: () => void }) {
  return (
    <View style={[s.catRow, !last && s.catRowBorder]}>
      <View style={[s.catDot, { backgroundColor: cat.color + '33', borderColor: cat.color }]}>
        <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
      </View>
      <Text style={s.catName}>{cat.name}</Text>
      {cat.is_default
        ? <Text style={s.defaultBadge}>predeterminada</Text>
        : <TouchableOpacity onPress={onDelete}><Text style={s.catDelete}>✕</Text></TouchableOpacity>
      }
    </View>
  )
}

function EditProfileModal({ visible, currentName, onClose, onSave }: {
  visible: boolean
  currentName: string
  onClose: () => void
  onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    if (!name.trim()) return
    setSaving(true)
    try { await onSave(name.trim()) } catch (e: any) { showAlert('Error', e.message) } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={m.title}>Editar perfil</Text>
          <TouchableOpacity onPress={handle} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
        <View style={m.body}>
          <Text style={m.label}>Nombre completo</Text>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor="#64748B"
            autoFocus
          />
        </View>
      </View>
    </Modal>
  )
}

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm2, setConfirm2] = useState('')
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    if (!next.trim() || next !== confirm2) { showAlert('Error', 'Las contraseñas no coinciden'); return }
    if (next.length < 6) { showAlert('Error', 'Mínimo 6 caracteres'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error
      showAlert('Listo', 'Contraseña actualizada')
      setCurrent(''); setNext(''); setConfirm2('')
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
          <Text style={m.title}>Cambiar contraseña</Text>
          <TouchableOpacity onPress={handle} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
        <View style={m.body}>
          <Text style={m.label}>Nueva contraseña</Text>
          <TextInput style={m.input} value={next} onChangeText={setNext} secureTextEntry placeholderTextColor="#64748B" placeholder="Mínimo 6 caracteres" />
          <Text style={m.label}>Confirmar contraseña</Text>
          <TextInput style={m.input} value={confirm2} onChangeText={setConfirm2} secureTextEntry placeholderTextColor="#64748B" placeholder="Repite la contraseña" />
        </View>
      </View>
    </Modal>
  )
}

function AddCategoryModal({ visible, onClose, onSave }: {
  visible: boolean
  onClose: () => void
  onSave: (data: { name: string; icon: string; color: string; type: TransactionType }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [icon, setIcon] = useState(CATEGORY_ICONS[0])
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    if (!name.trim()) { showAlert('Error', 'Ingresa un nombre'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), icon, color, type })
      setName(''); setType('expense'); setIcon(CATEGORY_ICONS[0]); setColor(CATEGORY_COLORS[0])
    } catch (e: any) { showAlert('Error', e.message) } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.handle} />
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={m.title}>Nueva categoría</Text>
          <TouchableOpacity onPress={handle} disabled={saving}>
            <Text style={m.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={m.scroll}>
          {/* Preview */}
          <View style={[m.preview, { backgroundColor: color + '22', borderColor: color + '44' }]}>
            <Text style={{ fontSize: 36 }}>{icon}</Text>
            <Text style={m.previewName}>{name || 'Nueva categoría'}</Text>
          </View>

          <Text style={m.label}>Nombre</Text>
          <TextInput style={m.input} value={name} onChangeText={setName} placeholderTextColor="#64748B" placeholder="Ej: Mascotas, Gym..." />

          <Text style={m.label}>Tipo</Text>
          <View style={m.typeRow}>
            {(['expense', 'income'] as TransactionType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[m.typeBtn, type === t && { backgroundColor: color + '33', borderColor: color }]}
                onPress={() => setType(t)}
              >
                <Text style={[m.typeBtnText, type === t && { color: '#F8FAFC' }]}>
                  {t === 'expense' ? '📤 Gasto' : '📥 Ingreso'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Color</Text>
          <View style={m.colorRow}>
            {CATEGORY_COLORS.map(c => (
              <TouchableOpacity key={c} style={[m.colorDot, { backgroundColor: c }, color === c && m.colorSelected]} onPress={() => setColor(c)} />
            ))}
          </View>

          <Text style={m.label}>Ícono</Text>
          <View style={m.iconGrid}>
            {CATEGORY_ICONS.map(ic => (
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
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 20 },

  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 20, padding: 16, marginBottom: 28, gap: 14, borderWidth: 1, borderColor: '#334155' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  profileEmail: { color: '#64748B', fontSize: 13, marginTop: 2 },
  editBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  editBtnText: { color: '#6366F1', fontSize: 13, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  sectionAction: { color: '#6366F1', fontSize: 13, fontWeight: '700' },

  card: { backgroundColor: '#1E293B', borderRadius: 18, borderWidth: 1, borderColor: '#334155', marginBottom: 12, overflow: 'hidden' },
  rowContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  rowLabel: { flex: 1, color: '#F8FAFC', fontSize: 15 },
  rowValue: { color: '#64748B', fontSize: 14 },
  rowChevron: { color: '#475569', fontSize: 22 },

  catType: { color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, marginTop: 4 },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accordionCount: { color: '#64748B', fontSize: 12, fontWeight: '700', backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  accordionChevron: { color: '#6366F1', fontSize: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  catDot: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  catName: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '500' },
  defaultBadge: { color: '#475569', fontSize: 11, fontWeight: '600' },
  catDelete: { color: '#EF4444', fontSize: 18, paddingHorizontal: 4 },

  signOutBtn: { backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF444444', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 12 },
  signOutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
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

  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, color: '#F8FAFC', fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },

  preview: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 28 },
  previewName: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },

  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  typeBtn: { flex: 1, padding: 14, backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  typeBtnText: { color: '#64748B', fontWeight: '600', fontSize: 14 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorSelected: { borderWidth: 3, borderColor: '#F8FAFC' },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 40 },
  iconItem: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
})
