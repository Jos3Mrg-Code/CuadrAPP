import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const icons: Record<string, string> = {
  index: '🏠',
  transactions: '💳',
  accounts: '🏦',
  goals: '🎯',
  budgets: '📊',
  settings: '⚙️',
}

const labels: Record<string, string> = {
  index: 'Inicio',
  transactions: 'Movimientos',
  accounts: 'Cuentas',
  goals: 'Metas',
  budgets: 'Presupuestos',
  settings: 'Ajustes',
}

export default function TabsLayout() {
  // En iPhone la barra debe crecer hacia el indicador de inicio: si no, queda
  // una franja muerta debajo y las etiquetas se pegan al borde.
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1E293B',
          borderTopColor: '#334155',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabel: ({ color }) => (
          <Text style={{ color, fontSize: 11, marginBottom: 4 }}>{labels[route.name]}</Text>
        ),
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 22 }}>{icons[route.name]}</Text>
        ),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="accounts" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="budgets" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
