import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useStats, StatsPeriod, MonthlyData, CategoryStat } from '../hooks/useStats'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${Math.round(n)}`
}

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  '1m': 'Este mes',
  '3m': '3 meses',
  '6m': '6 meses',
  '1y': 'Este año',
}

export default function StatsScreen() {
  const { data, loading, period, changePeriod, refresh } = useStats()

  useEffect(() => { refresh() }, [])

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Estadísticas</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Period selector */}
      <View style={s.periodRow}>
        {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[s.periodBtn, period === p && s.periodBtnActive]}
            onPress={() => changePeriod(p)}
          >
            <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading || !data ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.loadingText}>Calculando...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Summary cards */}
          <View style={s.summaryGrid}>
            <SummaryCard label="Ingresos" value={fmt(data.totalIncome)} color="#34D399" icon="📥" />
            <SummaryCard label="Gastos" value={fmt(data.totalExpense)} color="#F87171" icon="📤" />
            <SummaryCard
              label="Balance neto"
              value={fmt(data.netBalance)}
              color={data.netBalance >= 0 ? '#34D399' : '#F87171'}
              icon={data.netBalance >= 0 ? '📈' : '📉'}
            />
            <SummaryCard label="Gasto diario prom." value={fmt(data.avgDailyExpense)} color="#A78BFA" icon="📅" />
          </View>

          {/* Monthly bar chart */}
          {data.monthlyData.length > 1 && (
            <>
              <Text style={s.sectionTitle}>Tendencia mensual</Text>
              <View style={s.chartCard}>
                <BarChart data={data.monthlyData} />
                <View style={s.chartLegend}>
                  <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#34D399' }]} /><Text style={s.legendText}>Ingresos</Text></View>
                  <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#F87171' }]} /><Text style={s.legendText}>Gastos</Text></View>
                </View>
              </View>
            </>
          )}

          {/* Expense categories */}
          {data.topExpenseCategories.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Gastos por categoría</Text>
              <View style={s.catCard}>
                {data.topExpenseCategories.map((cs, i) => (
                  <CategoryBar key={i} stat={cs} last={i === data.topExpenseCategories.length - 1} />
                ))}
              </View>
            </>
          )}

          {/* Income categories */}
          {data.topIncomeCategories.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Ingresos por categoría</Text>
              <View style={s.catCard}>
                {data.topIncomeCategories.map((cs, i) => (
                  <CategoryBar key={i} stat={cs} last={i === data.topIncomeCategories.length - 1} />
                ))}
              </View>
            </>
          )}

          {/* Biggest transactions */}
          {data.biggestTransactions.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Mayores movimientos</Text>
              <View style={s.txCard}>
                {data.biggestTransactions.map((t, i) => (
                  <View key={t.id} style={[s.txRow, i < data.biggestTransactions.length - 1 && s.txRowBorder]}>
                    <Text style={{ fontSize: 22 }}>{t.category?.icon ?? '💸'}</Text>
                    <View style={s.txInfo}>
                      <Text style={s.txDesc} numberOfLines={1}>{t.description || t.category?.name || '—'}</Text>
                      <Text style={s.txDate}>{new Date(t.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · {t.account?.name}</Text>
                    </View>
                    <Text style={[s.txAmount, { color: t.type === 'income' ? '#34D399' : '#F87171' }]}>
                      {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {data.totalIncome === 0 && data.totalExpense === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📊</Text>
              <Text style={s.emptyText}>Sin movimientos en este período</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[s.summaryCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={{ fontSize: 18, marginBottom: 6 }}>{icon}</Text>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  )
}

function BarChart({ data }: { data: MonthlyData[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  const BAR_H = 120

  return (
    <View style={s.chartContainer}>
      {data.map((d, i) => {
        const incH = Math.round((d.income / maxVal) * BAR_H)
        const expH = Math.round((d.expense / maxVal) * BAR_H)
        return (
          <View key={i} style={s.barGroup}>
            <View style={s.barPair}>
              <View style={{ height: BAR_H, justifyContent: 'flex-end', marginRight: 2 }}>
                {incH > 0 && (
                  <View style={{ width: 10, height: incH, backgroundColor: '#34D399', borderRadius: 3 }} />
                )}
              </View>
              <View style={{ height: BAR_H, justifyContent: 'flex-end', marginLeft: 2 }}>
                {expH > 0 && (
                  <View style={{ width: 10, height: expH, backgroundColor: '#F87171', borderRadius: 3 }} />
                )}
              </View>
            </View>
            <Text style={s.barLabel}>{d.label}</Text>
            {(d.income > 0 || d.expense > 0) && (
              <Text style={s.barValue}>{fmtShort(Math.max(d.income, d.expense))}</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

function CategoryBar({ stat, last }: { stat: CategoryStat; last: boolean }) {
  return (
    <View style={[s.catRow, !last && s.catRowBorder]}>
      <View style={[s.catIcon, { backgroundColor: stat.category.color + '22' }]}>
        <Text style={{ fontSize: 18 }}>{stat.category.icon}</Text>
      </View>
      <View style={s.catInfo}>
        <View style={s.catTopRow}>
          <Text style={s.catName}>{stat.category.name}</Text>
          <Text style={s.catAmount}>{fmt(stat.amount)}</Text>
        </View>
        <View style={s.catBarTrack}>
          <View style={[s.catBarFill, { width: `${stat.percentage}%` as any, backgroundColor: stat.category.color }]} />
        </View>
        <Text style={s.catPct}>{Math.round(stat.percentage)}% · {stat.count} movimiento{stat.count !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 70 },
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },

  periodRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16, marginTop: 4 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1E293B', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  periodBtnActive: { backgroundColor: '#6366F133', borderColor: '#6366F1' },
  periodBtnText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  periodBtnTextActive: { color: '#A5B4FC' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },

  scroll: { paddingHorizontal: 20 },
  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  summaryCard: { width: '48%', backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  summaryValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { color: '#64748B', fontSize: 11 },

  chartCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#334155' },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 8 },
  barGroup: { alignItems: 'center', flex: 1 },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  barLabel: { color: '#64748B', fontSize: 10, textAlign: 'center' },
  barValue: { color: '#475569', fontSize: 9, textAlign: 'center', marginTop: 2 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#64748B', fontSize: 12 },

  catCard: { backgroundColor: '#1E293B', borderRadius: 18, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  catIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  catInfo: { flex: 1 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  catAmount: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  catBarTrack: { height: 4, backgroundColor: '#0F172A', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  catBarFill: { height: '100%', borderRadius: 2 },
  catPct: { color: '#475569', fontSize: 11 },

  txCard: { backgroundColor: '#1E293B', borderRadius: 18, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  txInfo: { flex: 1 },
  txDesc: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  txDate: { color: '#64748B', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#64748B', fontSize: 15 },
})
