import { useCallback } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { useDashboard } from '../../hooks/useDashboard'
import { useAuthStore } from '../../store/authStore'
import { useAlerts } from '../../hooks/useAlerts'
import { useAchievements } from '../../hooks/useAchievements'
import { usePlan } from '../../hooks/usePlan'
import { Transaction } from '../../types'


const CURRENCY = '$'

function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const { totalBalance, monthIncome, monthExpense, recentTransactions, categoryExpenses, loading, refresh } = useDashboard()
  const { badgeCount, refresh: refreshAlerts } = useAlerts()
  const { levelInfo, stats: gameStats, newlyUnlocked, refresh: refreshAchievements } = useAchievements()
  const { isPremium, loading: planLoading, daysLeft: planDaysLeft } = usePlan()

  useFocusEffect(useCallback(() => { refresh(); refreshAlerts(); refreshAchievements() }, []))

  const firstName = user?.full_name?.split(' ')[0] ?? 'Usuario'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {firstName} 👋</Text>
            <Text style={styles.headerSub}>Aquí está tu resumen</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')}>
            <Text style={styles.bellIcon}>🔔</Text>
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Aviso de vencimiento del plan */}
        {planDaysLeft !== null && planDaysLeft <= 7 && (
          <TouchableOpacity style={styles.expiryBanner} onPress={() => router.push('/upgrade')}>
            <Text style={{ fontSize: 18 }}>⏳</Text>
            <Text style={styles.expiryText}>
              Tu Premium vence {planDaysLeft <= 0 ? 'hoy' : `en ${planDaysLeft} día${planDaysLeft !== 1 ? 's' : ''}`} · Toca para renovar
            </Text>
          </TouchableOpacity>
        )}

        {/* Balance total */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} />
          <Text style={styles.balanceLabel}>Balance total</Text>
          <Text style={styles.balanceAmount}>{fmt(totalBalance)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balancePill}>
              <Text style={styles.pillDot}>↑</Text>
              <Text style={styles.pillText}>{fmt(monthIncome)} este mes</Text>
            </View>
            <View style={[styles.balancePill, styles.pillRed]}>
              <Text style={[styles.pillDot, { color: '#F87171' }]}>↓</Text>
              <Text style={[styles.pillText, { color: '#F87171' }]}>{fmt(monthExpense)} este mes</Text>
            </View>
          </View>
        </View>

        {/* Ingresos vs Gastos */}
        <View style={styles.row}>
          <View style={[styles.miniCard, styles.incomeCard]}>
            <View style={styles.miniIconWrap}>
              <Text style={styles.miniIcon}>↑</Text>
            </View>
            <Text style={styles.miniLabel}>Ingresos</Text>
            <Text style={styles.miniAmount}>{fmt(monthIncome)}</Text>
            <Text style={styles.miniSub}>este mes</Text>
          </View>
          <View style={[styles.miniCard, styles.expenseCard]}>
            <View style={[styles.miniIconWrap, styles.miniIconRed]}>
              <Text style={styles.miniIcon}>↓</Text>
            </View>
            <Text style={styles.miniLabel}>Gastos</Text>
            <Text style={[styles.miniAmount, { color: '#F87171' }]}>{fmt(monthExpense)}</Text>
            <Text style={styles.miniSub}>este mes</Text>
          </View>
        </View>

        {/* Gastos por categoría */}
        {categoryExpenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por categoría</Text>
            {categoryExpenses.map((cat, i) => {
              const pct = monthExpense > 0 ? (cat.value / monthExpense) * 100 : 0
              return (
                <View key={i} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color }]}>
                    <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                  </View>
                  <View style={styles.catInfo}>
                    <View style={styles.catHeader}>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catAmount}>{fmt(cat.value)}</Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Gamificación */}
        <TouchableOpacity style={styles.statsBtn} onPress={() => router.push('/achievements')}>
          <Text style={styles.statsBtnIcon}>{levelInfo.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.statsBtnText}>Nivel {levelInfo.level} · {levelInfo.name}</Text>
            <Text style={styles.levelSub}>
              🔥 {gameStats?.currentStreak ?? 0} día{(gameStats?.currentStreak ?? 0) !== 1 ? 's' : ''} · {levelInfo.xp.toLocaleString('es-CO')} XP
            </Text>
          </View>
          {newlyUnlocked.length > 0 && (
            <View style={styles.newPill}>
              <Text style={styles.newPillText}>{newlyUnlocked.length} nuevo{newlyUnlocked.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
          <Text style={styles.statsBtnArrow}>›</Text>
        </TouchableOpacity>

        {/* Estadísticas */}
        <TouchableOpacity style={styles.statsBtn} onPress={() => router.push('/stats')}>
          <Text style={styles.statsBtnIcon}>📊</Text>
          <Text style={styles.statsBtnText}>Ver estadísticas detalladas</Text>
          <Text style={styles.statsBtnArrow}>›</Text>
        </TouchableOpacity>

        {/* Deudas */}
        <TouchableOpacity style={styles.statsBtn} onPress={() => router.push('/debts')}>
          <Text style={styles.statsBtnIcon}>🧾</Text>
          <Text style={styles.statsBtnText}>Gestionar deudas</Text>
          <Text style={styles.statsBtnArrow}>›</Text>
        </TouchableOpacity>

        {/* Calendario (premium) */}
        <TouchableOpacity
          style={styles.statsBtn}
          onPress={() => router.push(isPremium ? '/calendar' : '/upgrade')}
        >
          <Text style={styles.statsBtnIcon}>📅</Text>
          <Text style={styles.statsBtnText}>Calendario financiero</Text>
          {/* !planLoading evita que la píldora parpadee en usuarios premium */}
          {!planLoading && !isPremium && (
            <View style={styles.proPill}><Text style={styles.proPillText}>PRO</Text></View>
          )}
          <Text style={styles.statsBtnArrow}>›</Text>
        </TouchableOpacity>

        {/* Reportes */}
        <TouchableOpacity style={styles.statsBtn} onPress={() => router.push('/reports')}>
          <Text style={styles.statsBtnIcon}>📄</Text>
          <Text style={styles.statsBtnText}>Reportes</Text>
          <Text style={styles.statsBtnArrow}>›</Text>
        </TouchableOpacity>

        {/* Asistente IA (RF-015) — oculto hasta configurar créditos de la API de Anthropic.
            Para activarlo: descomentar este bloque, correr supabase/chat_messages.sql,
            cargar el secreto ANTHROPIC_API_KEY y desplegar la función finance-chat.
        <TouchableOpacity style={styles.statsBtn} onPress={() => router.push('/assistant')}>
          <Text style={styles.statsBtnIcon}>🤖</Text>
          <Text style={styles.statsBtnText}>Asistente financiero</Text>
          <Text style={styles.statsBtnArrow}>›</Text>
        </TouchableOpacity>
        */}

        {/* Transacciones recientes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recientes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.seeAll}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#6366F1" style={{ marginTop: 20 }} />
          ) : recentTransactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>Aún no hay transacciones</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push('/(tabs)/transactions')}
              >
                <Text style={styles.addBtnText}>+ Agregar transacción</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentTransactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === 'income'
  const cat = tx.category as any
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: cat?.color ? cat.color + '22' : '#6366F122' }]}>
        <Text style={{ fontSize: 20 }}>{cat?.icon ?? '💸'}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDesc} numberOfLines={1}>{tx.description || cat?.name || 'Transacción'}</Text>
        <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? '#34D399' : '#F87171' }]}>
        {isIncome ? '+' : '-'}{fmt(tx.amount)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
  headerSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  bellIcon: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Balance card
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#6366F1', opacity: 0.15,
  },
  balanceLabel: { color: '#94A3B8', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#F8FAFC', fontSize: 38, fontWeight: '800', marginBottom: 16 },
  balanceRow: { flexDirection: 'row', gap: 10 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#10B98122', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillRed: { backgroundColor: '#EF444422' },
  pillDot: { color: '#34D399', fontSize: 14, fontWeight: '700' },
  pillText: { color: '#34D399', fontSize: 12, fontWeight: '600' },

  // Mini cards
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  miniCard: { flex: 1, borderRadius: 20, padding: 18, borderWidth: 1 },
  incomeCard: { backgroundColor: '#10B98111', borderColor: '#10B98133' },
  expenseCard: { backgroundColor: '#EF444411', borderColor: '#EF444433' },
  miniIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B98133', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  miniIconRed: { backgroundColor: '#EF444433' },
  miniIcon: { color: '#34D399', fontSize: 18, fontWeight: '800' },
  miniLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
  miniAmount: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  miniSub: { color: '#475569', fontSize: 11, marginTop: 2 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', marginBottom: 16 },
  seeAll: { color: '#6366F1', fontSize: 13, fontWeight: '600' },

  // Category rows
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  catDot: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  catInfo: { flex: 1 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { color: '#CBD5E1', fontSize: 14 },
  catAmount: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  progressBg: { height: 5, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },

  // Transactions
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  txIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { color: '#F8FAFC', fontSize: 15, fontWeight: '500' },
  txDate: { color: '#64748B', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },

  // Stats button
  statsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#334155', gap: 10 },
  statsBtnIcon: { fontSize: 20 },
  statsBtnText: { flex: 1, color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  statsBtnArrow: { color: '#475569', fontSize: 22 },
  levelSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
  proPill: { backgroundColor: '#F9731622', borderWidth: 1, borderColor: '#F9731655', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  proPillText: { color: '#F97316', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  expiryBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9731618', borderWidth: 1, borderColor: '#F9731644', borderRadius: 14, padding: 14, marginBottom: 16 },
  expiryText: { flex: 1, color: '#F97316', fontSize: 13, fontWeight: '600' },
  newPill: { backgroundColor: '#10B98122', borderWidth: 1, borderColor: '#10B98144', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  newPillText: { color: '#34D399', fontSize: 10, fontWeight: '800' },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#64748B', fontSize: 15, marginBottom: 16 },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '600' },
})
