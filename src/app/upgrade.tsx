import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { usePlan } from '../hooks/usePlan'
import { PREMIUM_FEATURES, formatPlanDate } from '../lib/plan'

const CONTACT_EMAIL = 'joseramirezgarcia325@gmail.com'

export default function UpgradeScreen() {
  const { isPremium, expiresAt, plan } = usePlan()

  const writeEmail = () => {
    const subject = encodeURIComponent('Quiero Premium en CuadrAPP')
    const body = encodeURIComponent(
      'Hola, me gustaría activar el plan Premium en CuadrAPP.\n\nMi correo registrado es: '
    )
    Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {})
  }

  const expired = !isPremium && plan?.plan === 'premium' && !!expiresAt

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Planes</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.hero}>⭐</Text>
        <Text style={s.heroTitle}>CuadrAPP Premium</Text>
        <Text style={s.heroSub}>Todo lo que ya usas, sin límites.</Text>

        {/* Estado actual */}
        <View style={[s.statusCard, isPremium && s.statusCardActive]}>
          <Text style={s.statusLabel}>Tu plan actual</Text>
          <Text style={[s.statusValue, isPremium && { color: '#34D399' }]}>
            {isPremium ? 'Premium' : 'Gratis'}
          </Text>
          {isPremium && (
            <Text style={s.statusSub}>
              {expiresAt ? `Vence el ${formatPlanDate(expiresAt)}` : 'Sin vencimiento'}
            </Text>
          )}
          {expired && (
            <Text style={[s.statusSub, { color: '#F87171' }]}>
              Tu Premium venció el {formatPlanDate(expiresAt)}
            </Text>
          )}
        </View>

        {/* Qué incluye */}
        <Text style={s.sectionTitle}>Qué incluye Premium</Text>
        {PREMIUM_FEATURES.map(f => (
          <View key={f.title} style={s.featureRow}>
            <Text style={s.featureIcon}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureBody}>{f.body}</Text>
            </View>
          </View>
        ))}

        {/* Gratis siempre */}
        <Text style={s.sectionTitle}>Gratis siempre</Text>
        <View style={s.freeCard}>
          <Text style={s.freeText}>
            Movimientos ilimitados, dashboard, estadísticas, reportes en PDF y CSV, deudas,
            notificaciones y logros. Eso no se toca.
          </Text>
        </View>

        {/* Cómo activar */}
        <View style={s.contactCard}>
          <Text style={s.contactTitle}>🛠 Todavía no tenemos pagos en línea</Text>
          <Text style={s.contactBody}>
            Estoy tramitando la pasarela de pagos para Colombia. Mientras tanto activo el plan
            Premium a mano, uno por uno.
          </Text>
          <Text style={s.contactBody}>
            Escríbeme desde el correo con el que te registraste y te lo activo:
          </Text>
          <Text selectable style={s.contactEmail}>{CONTACT_EMAIL}</Text>
          <TouchableOpacity style={s.contactBtn} onPress={writeEmail}>
            <Text style={s.contactBtnText}>Escribir al correo</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.fineprint}>
          No se te cobra nada, ni ahora ni automáticamente después. Cuando habilite los pagos te
          aviso antes de cualquier cobro.
        </Text>
        <Text style={s.fineprint}>
          Si tu Premium vence no pierdes nada: tus cuentas, metas y presupuestos siguen ahí y los
          puedes seguir usando y editando. Lo único es que no podrás crear nuevos por encima del
          límite del plan gratis.
        </Text>

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
  hero: { fontSize: 52, textAlign: 'center', marginTop: 10 },
  heroTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  heroSub: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 22 },

  statusCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#334155', marginBottom: 8 },
  statusCardActive: { borderColor: '#10B98144', backgroundColor: '#10B98110' },
  statusLabel: { color: '#64748B', fontSize: 12 },
  statusValue: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', marginTop: 4 },
  statusSub: { color: '#94A3B8', fontSize: 13, marginTop: 4 },

  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 24, marginBottom: 12 },

  featureRow: { flexDirection: 'row', gap: 14, backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  featureIcon: { fontSize: 26 },
  featureTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  featureBody: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 4 },

  freeCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  freeText: { color: '#94A3B8', fontSize: 13, lineHeight: 20 },

  contactCard: { backgroundColor: '#6366F112', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#6366F144', marginTop: 24 },
  contactTitle: { color: '#A5B4FC', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  contactBody: { color: '#94A3B8', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  contactEmail: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  contactBtn: { backgroundColor: '#6366F1', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 6 },
  contactBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  fineprint: { color: '#475569', fontSize: 12, lineHeight: 18, marginTop: 16 },
})
