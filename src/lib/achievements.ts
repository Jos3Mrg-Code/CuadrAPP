import { AchievementDef, AchievementStats, LevelInfo } from '../types'

// ---------- Helpers de fecha ----------
// El formateador se construye una sola vez: iterar cientos de filas creando
// Intl.DateTimeFormat por cada una es costoso.
const BOGOTA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })

/** Día calendario en Bogotá de un timestamptz (o de ahora). → 'YYYY-MM-DD' */
export function bogotaDay(when: string | Date = new Date()): string {
  return BOGOTA_DAY.format(typeof when === 'string' ? new Date(when) : when)
}

/** Suma/resta días a 'YYYY-MM-DD' sin depender del huso local. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + delta * 86400000).toISOString().slice(0, 10)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Meses ya cerrados, del más reciente al más antiguo. */
export function closedMonths(today: string, n: number) {
  const [y, m] = today.split('-').map(Number)
  const out: { key: string; start: string; end: string }[] = []
  for (let i = 1; i <= n; i++) {
    let mm = m - i
    let yy = y
    while (mm <= 0) { mm += 12; yy -= 1 }
    const start = `${yy}-${pad(mm)}-01`
    const nextY = mm === 12 ? yy + 1 : yy
    const nextM = mm === 12 ? 1 : mm + 1
    // Último día del mes: el día anterior al primero del siguiente (28/29/30/31 automático)
    const end = shiftDay(`${nextY}-${pad(nextM)}-01`, -1)
    out.push({ key: `${yy}-${pad(mm)}`, start, end })
  }
  return out
}

/**
 * Racha de días consecutivos con al menos un registro.
 * Gracia: si hoy aún no hay registro, la racha se mide desde ayer; si tampoco
 * hay nada ayer, la racha está rota (0). Nunca suma un día fantasma.
 */
export function computeStreak(createdAts: string[]) {
  const days = new Set(createdAts.map(ts => bogotaDay(ts)))
  const today = bogotaDay()
  const activeToday = days.has(today)

  let cursor = activeToday ? today : shiftDay(today, -1)
  let current = 0
  while (days.has(cursor)) {
    current++
    cursor = shiftDay(cursor, -1)
  }

  // Mejor racha histórica dentro de la ventana consultada
  let best = 0
  let run = 0
  let prev = ''
  for (const d of [...days].sort()) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }

  return { current, best, activeToday, activeDays: days.size }
}

// ---------- Niveles ----------
export const LEVELS = [
  { min: 0, name: 'Novato', icon: '🌱' },
  { min: 150, name: 'Aprendiz', icon: '📘' },
  { min: 500, name: 'Organizado', icon: '🗂️' },
  { min: 900, name: 'Disciplinado', icon: '🎯' },
  { min: 1500, name: 'Experto', icon: '🧠' },
  { min: 2100, name: 'Maestro', icon: '👑' },
]

export function levelFor(xp: number): LevelInfo {
  let i = 0
  for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].min) i = k
  const cur = LEVELS[i]
  const next = LEVELS[i + 1] ?? null
  return {
    level: i + 1,
    name: cur.name,
    icon: cur.icon,
    xp,
    floor: cur.min,
    nextName: next?.name ?? null,
    nextIcon: next?.icon ?? null,
    nextAt: next?.min ?? null,
    xpToNext: next ? next.min - xp : 0,
    progress: next ? Math.min(1, Math.max(0, (xp - cur.min) / (next.min - cur.min))) : 1,
  }
}

// ---------- Catálogo (19 logros, 2600 XP) ----------
const bar = (current: number, target: number) => ({ current: Math.min(current, target), target })

export const ACHIEVEMENTS: AchievementDef[] = [
  // Conteo de movimientos
  {
    code: 'first_transaction', icon: '📝', title: 'Primer paso', points: 25,
    description: 'Registra tu primera transacción',
    check: s => s.totalTransactions >= 1,
    progress: s => bar(s.totalTransactions, 1),
  },
  {
    code: 'ten_transactions', icon: '🧾', title: 'Tomando ritmo', points: 50,
    description: 'Registra 10 transacciones',
    check: s => s.totalTransactions >= 10,
    progress: s => bar(s.totalTransactions, 10),
  },
  {
    code: 'fifty_transactions', icon: '📚', title: 'Constancia', points: 100,
    description: 'Registra 50 transacciones',
    check: s => s.totalTransactions >= 50,
    progress: s => bar(s.totalTransactions, 50),
  },
  {
    code: 'hundred_transactions', icon: '💯', title: 'Centenario', points: 200,
    description: 'Registra 100 transacciones',
    check: s => s.totalTransactions >= 100,
    progress: s => bar(s.totalTransactions, 100),
  },

  // Primeros pasos
  {
    code: 'first_account', icon: '🏦', title: 'Cuenta abierta', points: 25,
    description: 'Crea tu primera cuenta',
    check: s => s.accountsCount >= 1,
    progress: s => bar(s.accountsCount, 1),
  },
  {
    code: 'first_goal', icon: '🎯', title: 'Con un objetivo', points: 25,
    description: 'Crea tu primera meta de ahorro',
    check: s => s.goalsCount >= 1,
    progress: s => bar(s.goalsCount, 1),
  },
  {
    code: 'first_budget', icon: '📊', title: 'Plan en marcha', points: 25,
    description: 'Crea tu primer presupuesto',
    check: s => s.budgetsCount >= 1,
    progress: s => bar(s.budgetsCount, 1),
  },

  // Metas
  {
    code: 'goal_completed', icon: '🏆', title: 'Meta cumplida', points: 100,
    description: 'Completa una meta de ahorro',
    check: s => s.goalsCompleted >= 1,
    progress: s => bar(s.goalsCompleted, 1),
  },
  {
    code: 'three_goals', icon: '🥇', title: 'Coleccionista de metas', points: 200,
    description: 'Completa 3 metas de ahorro',
    check: s => s.goalsCompleted >= 3,
    progress: s => bar(s.goalsCompleted, 3),
  },
  {
    code: 'saver_1m', icon: '💎', title: 'Ahorrador serio', points: 200,
    description: 'Acumula $1.000.000 en tus metas',
    check: s => s.totalSaved >= 1000000,
    progress: s => bar(s.totalSaved, 1000000),
  },

  // Presupuestos
  {
    code: 'budget_respected', icon: '🛡️', title: 'Mes bajo control', points: 200,
    description: 'Cierra un mes sin exceder ningún presupuesto',
    check: s => s.budgetRespectedMonths >= 1,
    progress: s => bar(s.budgetRespectedMonths, 1),
  },
  {
    code: 'budget_respected_3', icon: '🏛️', title: 'Disciplina de hierro', points: 300,
    description: 'Cierra 3 meses seguidos sin exceder ningún presupuesto',
    check: s => s.budgetRespectedMonths >= 3,
    progress: s => bar(s.budgetRespectedMonths, 3),
  },

  // Deudas
  {
    code: 'debt_paid', icon: '🎉', title: 'Deuda liquidada', points: 100,
    description: 'Paga por completo una deuda',
    check: s => s.debtsPaid >= 1,
    progress: s => bar(s.debtsPaid, 1),
  },
  {
    code: 'all_debts_paid', icon: '🕊️', title: 'Libre de deudas', points: 300,
    description: 'Deja todas tus deudas en cero',
    check: s => s.debtsCount >= 1 && s.debtsPaid === s.debtsCount,
  },

  // Hábito
  {
    code: 'positive_month', icon: '📈', title: 'Mes en verde', points: 100,
    description: 'Cierra un mes con más ingresos que gastos',
    check: s => s.positiveMonths >= 1,
    progress: s => bar(s.positiveMonths, 1),
  },
  {
    code: 'streak_3', icon: '✨', title: 'Tres al hilo', points: 50,
    description: 'Registra movimientos 3 días seguidos',
    check: s => s.bestStreak >= 3,
    progress: s => bar(s.bestStreak, 3),
  },
  {
    code: 'streak_7', icon: '🔥', title: 'Semana completa', points: 100,
    description: 'Registra movimientos 7 días seguidos',
    check: s => s.bestStreak >= 7,
    progress: s => bar(s.bestStreak, 7),
  },
  {
    code: 'streak_30', icon: '☄️', title: 'Mes imparable', points: 200,
    description: 'Registra movimientos 30 días seguidos',
    check: s => s.bestStreak >= 30,
    progress: s => bar(s.bestStreak, 30),
  },
  {
    code: 'streak_100', icon: '🌟', title: 'Cien días', points: 300,
    description: 'Registra movimientos 100 días seguidos',
    check: s => s.bestStreak >= 100,
    progress: s => bar(s.bestStreak, 100),
  },
]

// ---------- Agregados de meses cerrados ----------
type MonthRange = { key: string; start: string; end: string }
type MonthTx = { amount: number | string; type: string; category_id: string | null; date: string }
type BudgetRow = { category_id: string; amount: number | string; period: string; created_at: string }

export function countPositiveMonths(months: MonthRange[], txs: MonthTx[]): number {
  return months.filter(mo => {
    const rows = txs.filter(t => t.date >= mo.start && t.date <= mo.end)
    if (rows.length === 0) return false
    const inc = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const exp = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return inc > exp
  }).length
}

/** Meses cerrados CONSECUTIVOS sin exceder ningún presupuesto, hacia atrás. */
export function countRespectedMonths(months: MonthRange[], budgets: BudgetRow[], txs: MonthTx[]): number {
  let count = 0
  for (const mo of months) {
    const applicable = budgets.filter(b =>
      b.period === 'monthly' &&                    // los semanales no se juzgan contra un mes
      b.created_at.slice(0, 10) <= mo.end          // el presupuesto tenía que existir en ese mes
    )
    // Sin presupuestos aplicables NO cuenta: every() sobre arreglo vacío devuelve true
    if (applicable.length === 0) break

    const rows = txs.filter(t => t.date >= mo.start && t.date <= mo.end && t.type === 'expense')
    const ok = applicable.every(b => {
      const spent = rows
        .filter(t => t.category_id === b.category_id)
        .reduce((s, t) => s + Number(t.amount), 0)
      return spent <= Number(b.amount)
    })
    if (!ok) break
    count++
  }
  return count
}
