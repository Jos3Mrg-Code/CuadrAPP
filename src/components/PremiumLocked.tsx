import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

/** Pantalla de bloqueo compartida. `denied` la usa el panel de admin. */
export function PremiumLocked({ feature, denied }: { feature: string; denied?: boolean }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.box}>
        <Text style={s.icon}>{denied ? '⛔' : '🔒'}</Text>
        <Text style={s.title}>{denied ? 'Acceso denegado' : `${feature} es Premium`}</Text>
        <Text style={s.sub}>
          {denied
            ? 'Esta sección es solo para administradores.'
            : 'Actualiza tu plan para desbloquear esta función. Tus datos actuales siguen intactos.'}
        </Text>

        {!denied && (
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/upgrade')}>
            <Text style={s.primaryBtnText}>Ver planes</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.secondaryBtn} onPress={() => router.back()}>
          <Text style={s.secondaryBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 56, marginBottom: 18 },
  title: { color: '#F8FAFC', fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  sub: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  primaryBtn: { backgroundColor: '#6366F1', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  secondaryBtnText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
})
