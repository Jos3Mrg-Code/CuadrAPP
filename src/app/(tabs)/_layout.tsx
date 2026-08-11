import { Tabs } from 'expo-router'
import { Text } from 'react-native'

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
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1E293B', borderTopColor: '#334155', height: 60 },
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
