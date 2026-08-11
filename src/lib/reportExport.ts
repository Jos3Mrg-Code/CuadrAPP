import { Platform } from 'react-native'
import { ReportData } from '../hooks/useReports'

const money = (n: number) => '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Escapa un campo CSV: comillas dobles + envuelto si contiene ; " o saltos de línea
function csvField(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

// Monto con coma decimal, sin separador de miles (parseable por Excel es-CO)
function csvAmount(n: number): string {
  return String(n).replace('.', ',')
}

export function buildTransactionsCsv(data: ReportData): string {
  const BOM = '﻿'
  const header = 'Fecha;Descripción;Categoría;Cuenta;Tipo;Monto'
  const rows = data.transactions.map(tx => {
    const cat = (tx.category as any)?.name ?? ''
    const acc = (tx.account as any)?.name ?? ''
    const signed = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
    return [
      tx.date,
      csvField(tx.description || ''),
      csvField(cat),
      csvField(acc),
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      csvAmount(signed),
    ].join(';')
  })
  return BOM + [header, ...rows].join('\r\n')
}

export function downloadFile(filename: string, content: string, mime: string) {
  if (Platform.OS !== 'web') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function buildReportHtml(data: ReportData): string {
  const generatedAt = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })

  const catRows = (items: typeof data.expenseByCategory) =>
    items.map(c => `
      <tr>
        <td>${c.category.icon} ${c.category.name}</td>
        <td class="num">${c.count}</td>
        <td class="num">${money(c.amount)}</td>
      </tr>`).join('')

  const accountRows = data.accounts.map(a => `
    <tr>
      <td>${a.icon} ${a.name}</td>
      <td class="num ${a.balance < 0 ? 'neg' : ''}">${money(a.balance)}</td>
    </tr>`).join('')

  const debtRows = data.debts.map(d => {
    const pct = d.total_amount > 0 ? Math.round(((d.total_amount - d.remaining_amount) / d.total_amount) * 100) : 0
    return `
    <tr>
      <td>${d.icon} ${d.name}${d.is_paid ? ' ✓' : ''}</td>
      <td class="num">${money(d.remaining_amount)}</td>
      <td class="num">${money(d.total_amount)}</td>
      <td class="num">${pct}% pagado</td>
    </tr>`
  }).join('')

  const goalRows = data.goals.map(g => {
    const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0
    return `
    <tr>
      <td>${g.icon} ${g.name}${g.is_completed ? ' 🎉' : ''}</td>
      <td class="num">${money(g.current_amount)}</td>
      <td class="num">${money(g.target_amount)}</td>
      <td class="num">${pct}%</td>
    </tr>`
  }).join('')

  const txRows = data.transactions.map(tx => {
    const cat = (tx.category as any)
    const acc = (tx.account as any)
    const isIncome = tx.type === 'income'
    return `
    <tr>
      <td>${tx.date}</td>
      <td>${tx.description || cat?.name || '—'}</td>
      <td>${cat ? `${cat.icon} ${cat.name}` : '—'}</td>
      <td>${acc?.name ?? '—'}</td>
      <td class="num ${isIncome ? 'pos' : 'neg'}">${isIncome ? '+' : '-'}${money(Number(tx.amount))}</td>
    </tr>`
  }).join('')

  const emptyRow = (cols: number) => `<tr><td colspan="${cols}" class="empty">Sin datos en este período</td></tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>CuadrAPP — Reporte financiero</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1e293b; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; border-bottom: 2px solid #6366F1; padding-bottom: 4px; }
  .sub { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .totals { display: flex; gap: 16px; margin: 16px 0; }
  .total-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; }
  .total-card .label { color: #64748b; font-size: 12px; }
  .total-card .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f1f5f9; padding: 7px 10px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
  .num { text-align: right; white-space: nowrap; }
  .pos { color: #059669; }
  .neg { color: #dc2626; }
  .empty { color: #94a3b8; text-align: center; padding: 14px; }
  @media print { body { margin: 12mm; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <h1>CuadrAPP — Reporte financiero</h1>
  <div class="sub">Período: ${fmtDate(data.start)} — ${fmtDate(data.end)} · Generado: ${generatedAt}</div>

  <div class="totals">
    <div class="total-card"><div class="label">Ingresos</div><div class="value pos">${money(data.totalIncome)}</div></div>
    <div class="total-card"><div class="label">Gastos</div><div class="value neg">${money(data.totalExpense)}</div></div>
    <div class="total-card"><div class="label">Balance neto</div><div class="value ${data.netBalance >= 0 ? 'pos' : 'neg'}">${money(data.netBalance)}</div></div>
  </div>

  <h2>Gastos por categoría</h2>
  <table>
    <tr><th>Categoría</th><th class="num">Movs.</th><th class="num">Total</th></tr>
    ${data.expenseByCategory.length ? catRows(data.expenseByCategory) : emptyRow(3)}
  </table>

  <h2>Ingresos por categoría</h2>
  <table>
    <tr><th>Categoría</th><th class="num">Movs.</th><th class="num">Total</th></tr>
    ${data.incomeByCategory.length ? catRows(data.incomeByCategory) : emptyRow(3)}
  </table>

  <h2>Estado de cuentas</h2>
  <table>
    <tr><th>Cuenta</th><th class="num">Balance actual</th></tr>
    ${data.accounts.length ? accountRows : emptyRow(2)}
  </table>

  <h2>Deudas</h2>
  <table>
    <tr><th>Deuda</th><th class="num">Restante</th><th class="num">Total</th><th class="num">Avance</th></tr>
    ${data.debts.length ? debtRows : emptyRow(4)}
  </table>

  <h2>Metas de ahorro</h2>
  <table>
    <tr><th>Meta</th><th class="num">Ahorrado</th><th class="num">Objetivo</th><th class="num">Avance</th></tr>
    ${data.goals.length ? goalRows : emptyRow(4)}
  </table>

  <h2>Movimientos del período (${data.transactions.length})</h2>
  <table>
    <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Cuenta</th><th class="num">Monto</th></tr>
    ${data.transactions.length ? txRows : emptyRow(5)}
  </table>
</body>
</html>`
}

export function printReport(html: string) {
  if (Platform.OS !== 'web') return
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.onload = () => w.print()
  // Fallback por si onload ya disparó antes de asignarse
  setTimeout(() => { try { w.print() } catch (_) {} }, 700)
}
