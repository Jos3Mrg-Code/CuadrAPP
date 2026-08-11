import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { User, UserPlan } from '../types'

interface AuthState {
  session: Session | null
  user: User | null
  /** null = todavía no cargado. Nunca significa "gratis". */
  plan: UserPlan | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setUser: (user: User | null) => void
  setPlan: (plan: UserPlan | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  plan: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setPlan: (plan) => set({ plan }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ session: null, user: null, plan: null }),
}))
