import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Switch, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAlerts, AlertSeverity } from '../hooks/useAlerts'
import { requestPermissions, getPermissionStatus, scheduleDailyReminder, cancelAllScheduled } from '../lib/pushNotifications'
import { useAuthStore } from '../store/authStore'
import * as webPush from '../lib/webPush'
import { WebPushStatus } from '../lib/webPush'

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  danger:  '#EF4444',
  warning: '#F97316',
  success: '#10B981',
  info:    '#6366F1',
}

const SEVERITY_BG: Record<AlertSeverity, string> = {
  danger:  '#EF444415',
  warning: '#F9731615',
  success: '#10B98115',
  info:    '#6366F115',
}

export default function NotificationsScreen() {
  const { alerts, loading, refresh } = useAlerts()
  const { session } = useAuthStore()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushHour, setPushHour] = useState(20)
  const [checkingPush, setCheckingPush] = useState(true)
  const [webStatus, setWebStatus] = useState<WebPushStatus>('unsupported')
  const isNative = Platform.OS !== 'web'

  useEffect(() => {
    refresh()
    if (isNative) checkPushStatus()
    else webPush.getStatus().then(setWebStatus).finally(() => setCheckingPush(false))
  }, [])

  const toggleWebPush = async (value: boolean) => {
    if (value) {
      if (!session) return
      const ok = await webPush.subscribe(session.user.id)
      setWebStatus(ok ? 'granted-subscribed' : await webPush.getStatus())
    } else {
      await webPush.unsubscribe()
      setWebStatus('granted-unsubscribed')
    }
  }

  const checkPushStatus = async () => {
    const status = await getPermissionStatus()
    setPushEnabled(status === 'granted')
    setCheckingPush(false)
  }

  const togglePush = async (value: boolean) => {
    if (value) {
      const granted = await requestPermissions()
      if (granted) {
        await scheduleDailyReminder(pushHour, 0)
        setPushEnabled(true)
      }
    } else {
      await cancelAllScheduled()
      setPushEnabled(false)
    }
  }

  const changeHour = async (h: number) => {
    setPushHour(h)
    if (pushEnabled) await scheduleDailyReminder(h, 0)
  }

  const HOURS = [8, 12, 16, 20, 22]

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notificaciones</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Push notifications (native only) */}
        {isNative && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notificaciones push</Text>
            <View style={s.card}>
              <View style={s.pushRow}>
                <Text style={s.pushIcon}>🔔</Text>
                <View style={s.pushInfo}>
                  <Text style={s.pushLabel}>Recordatorio diario</Text>
                  <Text style={s.pushSub}>Revisa tus finanzas cada día</Text>
                </View>
                {checkingPush
                  ? <ActivityIndicator size="small" color="#6366F1" />
                  : <Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ true: '#6366F1' }} />
                }
              </View>

              {pushEnabled && (
                <>
                  <View style={s.divider} />
                  <Text style={s.hourLabel}>Hora del recordatorio</Text>
                  <View style={s.hourRow}>
                    {HOURS.map(h => (
                      <TouchableOpacity
                        key={h}
                        style={[s.hourBtn, pushHour === h && s.hourBtnActive]}
                        onPress={() => changeHour(h)}
                      >
                        <Text style={[s.hourText, pushHour === h && s.hourTextActive]}>
                          {h}:00
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Push notifications (web) */}
        {!isNative && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notificaciones push</Text>
            <View style={s.card}>
              <View style={s.pushRow}>
                <Text style={s.pushIcon}>🔔</Text>
                <View style={s.pushInfo}>
                  <Text style={s.pushLabel}>Recordatorios de pagos</Text>
                  {webStatus === 'unsupported' ? (
                    webPush.isIosNotInstalled() ? (
                      <Text style={[s.pushSub, { color: '#F97316' }]}>
                        En iPhone/iPad: toca Compartir → "Agregar a pantalla de inicio" y abre Cuadrapp desde ahí para activar las notificaciones
                      </Text>
                    ) : (
                      <Text style={s.pushSub}>Tu navegador no soporta notificaciones push</Text>
                    )
                  ) : webStatus === 'denied' ? (
                    <Text style={[s.pushSub, { color: '#EF4444' }]}>Permiso bloqueado. Actívalo en la configuración del navegador</Text>
                  ) : (
                    <Text style={s.pushSub}>Te avisaremos cuando un pago venza, incluso con la app cerrada</Text>
                  )}
                </View>
                {checkingPush ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : webStatus !== 'unsupported' ? (
                  <Switch
                    value={webStatus === 'granted-subscribed'}
                    onValueChange={toggleWebPush}
                    disabled={webStatus === 'denied'}
                    trackColor={{ true: '#6366F1' }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Alerts */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Alertas activas</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={s.refreshBtn}>↻ Actualizar</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color="#6366F1" />
            </View>
          ) : (
            <View style={s.alertsList}>
              {alerts.map((alert, i) => (
                <View
                  key={alert.id}
                  style={[s.alertCard, { backgroundColor: SEVERITY_BG[alert.severity], borderColor: SEVERITY_COLORS[alert.severity] + '44' }]}
                >
                  <Text style={s.alertIcon}>{alert.icon}</Text>
                  <View style={s.alertContent}>
                    <View style={s.alertTitleRow}>
                      <Text style={[s.alertTitle, { color: SEVERITY_COLORS[alert.severity] }]}>{alert.title}</Text>
                      <View style={[s.severityDot, { backgroundColor: SEVERITY_COLORS[alert.severity] }]} />
                    </View>
                    <Text style={s.alertBody}>{alert.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

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

  section: { marginBottom: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  refreshBtn: { color: '#6366F1', fontSize: 13, fontWeight: '600' },

  card: { backgroundColor: '#1E293B', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#334155' },
  pushRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pushIcon: { fontSize: 24 },
  pushInfo: { flex: 1 },
  pushLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  pushSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#0F172A', marginVertical: 14 },
  hourLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  hourRow: { flexDirection: 'row', gap: 8 },
  hourBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  hourBtnActive: { backgroundColor: '#6366F133', borderColor: '#6366F1' },
  hourText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  hourTextActive: { color: '#A5B4FC' },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  alertsList: { gap: 10 },
  alertCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  alertIcon: { fontSize: 26, marginTop: 2 },
  alertContent: { flex: 1 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  severityDot: { width: 7, height: 7, borderRadius: 4 },
  alertBody: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
})
