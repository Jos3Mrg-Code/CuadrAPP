import { useEffect } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { registerServiceWorker } from '../lib/webPush'

function AuthGuard() {
  const { session, isLoading } = useAuthStore()
  const segments = useSegments()

  useEffect(() => {
    if (isLoading) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/(auth)/login')
    if (session && inAuth) router.replace('/(tabs)')
  }, [session, isLoading, segments])

  return null
}

export default function RootLayout() {
  const { setSession, setLoading, setUser, setPlan, isLoading } = useAuthStore()

  const loadProfile = async (userId: string) => {
    const [profileRes, planRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      // Columnas explícitas: el cliente no tiene privilegio sobre `note`
      supabase.from('user_plans')
        .select('user_id, plan, expires_at, is_admin')
        .eq('user_id', userId).maybeSingle(),
    ])
    if (profileRes.data) setUser(profileRes.data)
    // Sin fila = gratis. Se sintetiza para que `null` signifique solo "cargando".
    setPlan((planRes.data as any) ?? {
      user_id: userId, plan: 'free', expires_at: null, is_admin: false,
    })
  }

  useEffect(() => {
    registerServiceWorker()

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        if (session) loadProfile(session.user.id)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="stats" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="debts" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="calendar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reports" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="assistant" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="achievements" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="upgrade" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="shortcut" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  )
}
