import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { showAlert } from '../lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useReports } from '../hooks/useReports'
import { buildTransactionsCsv, downloadFile, buildReportHtml, printReport } from '../lib/reportExport'

const CURRENCY = '$'
function fmt(n: number) {
  return `${CURRENCY}${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
}

type ReportPeriod = '1m' | '3m' | '6m' | '1y' | 'custom'

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  '1m': 'Este mes',
  '3m': '3 meses',
  '6m': '6 meses',
  '1y': 'Este año',
  custom: 'Personalizado',
}

function periodRange(p: Exclude<ReportPeriod, 'custom'>): { start: string; end: string } {
  const now = new Date()
  const end = todayStr()
  if (p === '1m') return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end }
  if (p === '3m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return { start: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, end }
  }
  if (p === '6m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    return { start: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, end }
  }
  return { start: `${now.getFullYear()}-01-01`, end }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function ReportsScreen() {
  const { data, loading, generate } = useReports()
  const [period, setPeriod] = useState<ReportPeriod>('1m')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState(todayStr())

  useEffect(() => {
    const { start, end } = periodRange('1m')
    generate(start, end)
  }, [])

  const changePeriod = (p: ReportPeriod) => {
    setPeriod(p)
    if (p !== 'custom') {
      const { start, end } = periodRange(p)
      generate(start, end)
    }
  }

  const applyCustom = () => {
    if (!DATE_RE.test(customStart) || isNaN(Date.parse(customStart))) {
      showAlert('Error', 'Fecha inicial inválida (usa formato YYYY-MM-DD)'); return
    }
    if (!DATE_RE.test(customEnd) || isNaN(Date.parse(customEnd))) {
      showAlert('Error', 'Fecha final inválida (usa formato YYYY-MM-DD)'); return
    }
    if (customStart > customEnd) {
      showAlert('Error', 'La fecha inicial no puede ser mayor que la final'); return
    }
    generate(customStart, customEnd)
  }

  const handleCsv = () => {
    if (!data) return
    try {
      downloadFile(`cuadrapp-movimientos-${data.start}-a-${data.end}.csv`, buildTransactionsCsv(data), 'text/csv;charset=utf-8')
    } catch (e: any) {
      showAlert('Error', e.message)
    }
  }

  const handlePdf = () => {
    if (!data) return
    try {
      printReport(buildReportHtml(data))
    } catch (e: any) {
      showAlert('Error', e.message)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Reportes</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Selector de período */}
        <Text style={s.sectionTitle}>Período del reporte</Text>
        <View style={s.periodWrap}>
          {(Object.keys(PERIOD_LABELS) as ReportPeriod[]).map(p => (
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

        {period === 'custom' && (
          <View style={s.customBox}>
            <View style={s.customRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.customLabel}>Desde</Text>
                <TextInput style={s.customInput} placeholder="YYYY-MM-DD" placeholderTextColor="#64748B" value={customStart} onChangeText={setCustomStart} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.customLabel}>Hasta</Text>
                <TextInput style={s.customInput} placeholder="YYYY-MM-DD" placeholderTextColor="#64748B" value={customEnd} onChangeText={setCustomEnd} />
              </View>
            </View>
            <TouchableOpacity style={s.applyBtn} onPress={applyCustom}>
              <Text style={s.applyBtnText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Vista previa */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={s.loadingText}>Generando datos...</Text>
          </View>
        ) : data ? (
          <>
            <Text style={s.sectionTitle}>Vista previa</Text>
            <View style={s.summaryGrid}>
              <View style={[s.summaryCard, { borderLeftColor: '#34D399' }]}>
                <Text style={s.summaryValue}>{fmt(data.totalIncome)}</Text>
                <Text style={s.summaryLabel}>Ingresos</Text>
              </View>
              <View style={[s.summaryCard, { borderLeftColor: '#F87171' }]}>
                <Text style={s.summaryValue}>{fmt(data.totalExpense)}</Text>
                <Text style={s.summaryLabel}>Gastos</Text>
              </View>
              <View style={[s.summaryCard, { borderLeftColor: data.netBalance >= 0 ? '#34D399' : '#F87171' }]}>
                <Text style={s.summaryValue}>{fmt(data.netBalance)}</Text>
                <Text style={s.summaryLabel}>Balance neto</Text>
              </View>
              <View style={[s.summaryCard, { borderLeftColor: '#A78BFA' }]}>
                <Text style={s.summaryValue}>{data.transactions.length}</Text>
                <Text style={s.summaryLabel}>Movimientos</Text>
              </View>
            </View>

            <Text style={s.rangeText}>
              {data.start} — {data.end} · {data.accounts.length} cuenta{data.accounts.length !== 1 ? 's' : ''} · {data.debts.length} deuda{data.debts.length !== 1 ? 's' : ''} · {data.goals.length} meta{data.goals.length !== 1 ? 's' : ''}
            </Text>

            {/* Botones de export */}
            <TouchableOpacity style={s.exportBtn} onPress={handleCsv}>
              <Text style={s.exportIcon}>⬇️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.exportTitle}>Descargar CSV (Excel)</Text>
                <Text style={s.exportSub}>Movimientos del período en formato tabla</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[s.exportBtn, s.exportBtnPdf]} onPress={handlePdf}>
              <Text style={s.exportIcon}>🖨️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.exportTitle}>Generar PDF</Text>
                <Text style={s.exportSub}>Reporte completo: resumen, categorías, cuentas, deudas y metas</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 70 },
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },

  scroll: { paddingHorizontal: 20 },
  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },

  periodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1E293B', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  periodBtnActive: { backgroundColor: '#6366F133', borderColor: '#6366F1' },
  periodBtnText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  periodBtnTextActive: { color: '#A5B4FC' },

  customBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#334155', marginTop: 12 },
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  customLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  customInput: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, color: '#F8FAFC', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  applyBtn: { backgroundColor: '#6366F1', borderRadius: 12, padding: 12, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  loadingBox: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { width: '48%', backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155', borderLeftWidth: 3 },
  summaryValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { color: '#64748B', fontSize: 11 },

  rangeText: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 20 },

  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#6366F122', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#6366F144', marginBottom: 12 },
  exportBtnPdf: { backgroundColor: '#10B98115', borderColor: '#10B98133' },
  exportIcon: { fontSize: 26 },
  exportTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  exportSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
})
