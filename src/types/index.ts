export type AccountType = 'cash' | 'bank' | 'credit' | 'savings' | 'investment'
export type TransactionType = 'income' | 'expense'

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  currency: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  balance: number
  color: string
  icon: string
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string
  color: string
  type: TransactionType
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string
  amount: number
  type: TransactionType
  description: string
  date: string
  created_at: string
  account?: Account
  category?: Category
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  deadline?: string
  color: string
  icon: string
  is_completed: boolean
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  period: 'monthly' | 'weekly'
  created_at: string
  category?: Category
}

// Planes y administración
export type PlanTier = 'free' | 'premium'

/** Fila propia de user_plans. `note` NO se expone al cliente (grant por columna). */
export interface UserPlan {
  user_id: string
  plan: PlanTier
  expires_at: string | null
  is_admin: boolean
}

/** Fila del panel de admin; la arma la Edge Function `admin`. */
export interface AdminUserRow {
  id: string
  email: string
  full_name: string
  provider: string
  created_at: string
  last_sign_in_at: string | null
  plan: PlanTier
  expires_at: string | null
  is_admin: boolean
  note: string | null
  plan_updated_at: string | null
  tx_count: number
  last_tx: string | null
}

// RF-017 — Gamificación
export interface UnlockedAchievement {
  code: string
  unlocked_at: string
}

export interface AchievementStats {
  totalTransactions: number
  activeDays: number
  currentStreak: number
  bestStreak: number
  streakActiveToday: boolean
  accountsCount: number
  goalsCount: number
  goalsCompleted: number
  totalSaved: number
  budgetsCount: number
  budgetRespectedMonths: number
  positiveMonths: number
  debtsCount: number
  debtsPaid: number
}

export interface AchievementDef {
  code: string
  title: string
  description: string
  icon: string
  points: number
  check: (s: AchievementStats) => boolean
  progress?: (s: AchievementStats) => { current: number; target: number }
}

export interface AchievementView extends AchievementDef {
  unlocked: boolean
  unlockedAt: string | null
  isNew: boolean
}

export interface LevelInfo {
  level: number
  name: string
  icon: string
  xp: number
  floor: number
  nextName: string | null
  nextIcon: string | null
  nextAt: number | null
  xpToNext: number
  progress: number
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type PaymentFrequency = 'once' | 'weekly' | 'monthly' | 'yearly'

export interface ScheduledPayment {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: PaymentFrequency
  next_date: string
  category_id?: string
  account_id?: string
  color: string
  icon: string
  is_active: boolean
  created_at: string
  category?: Category
}

export type DebtType = 'loan' | 'credit_card' | 'personal' | 'mortgage' | 'other'

export interface Debt {
  id: string
  user_id: string
  name: string
  debt_type: DebtType
  total_amount: number
  remaining_amount: number
  interest_rate?: number
  due_date?: string
  color: string
  icon: string
  is_paid: boolean
  created_at: string
}
