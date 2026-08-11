import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAchievements } from '../hooks/useAchievements'
import { bogotaDay } from '../lib/achievements'
import { AchievementView } from '../types'

function fmtXp(n: number) {
  return n.toLocaleString('es-CO')
}

function fmtDate(iso: string) {
  // unlocked_at es timestamptz. Se convierte primero al día calendario de
  // Bogotá para que la fecha mostrada coincida con la que usa la racha,
  // en vez de depender del huso del navegador.
  return new Date(bogotaDay(iso) + 'T12:00:00')
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AchievementsScreen() {
  const { stats, items, newlyUnlocked, loading, xp, levelInfo, unlockedCount, totalCount, refresh } = useAchievements()

  useEffect(() => { refresh() }, [])

  const unlocked = items
    .filter(i => i.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
  const locked = items
    .filter(i => !i.unlocked)
    .sort((a, b) => a.points - b.points)

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Logros</Text>
        <View style={{ width: 70 }} />
      </View>

      {loading || !stats ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Nivel */}
          <View style={s.levelCard}>
            <View style={s.levelGlow} />
            <View style={s.levelTop}>
              <Text style={s.levelIcon}>{levelInfo.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.levelName}>Nivel {levelInfo.level} · {levelInfo.name}</Text>
                <Text style={s.levelXp}>{fmtXp(xp)} XP</Text>
              </View>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${Math.round(levelInfo.progress * 100)}%` as any }]} />
            </View>
            <Text style={s.levelNext}>
              {levelInfo.nextAt !== null
                ? `Te faltan ${fmtXp(levelInfo.xpToNext)} XP para ${levelInfo.nextName} ${levelInfo.nextIcon}`
                : '¡Nivel máximo alcanzado! 👑'}
            </Text>
          </View>

          {/* Mini stats */}
          <View style={s.miniRow}>
            <View style={s.miniCard}>
              <Text style={s.miniIcon}>🔥</Text>
              <Text style={s.miniValue}>{stats.currentStreak}</Text>
              <Text style={s.miniLabel}>Racha actual</Text>
            </View>
            <View style={s.miniCard}>
              <Text style={s.miniIcon}>🏆</Text>
              <Text style={s.miniValue}>{stats.bestStreak}</Text>
              <Text style={s.miniLabel}>Mejor racha</Text>
            </View>
            <View style={s.miniCard}>
              <Text style={s.miniIcon}>✅</Text>
              <Text style={s.miniValue}>{unlockedCount}/{totalCount}</Text>
              <Text style={s.miniLabel}>Logros</Text>
            </View>
          </View>

          {/* Racha en gracia */}
          {stats.currentStreak > 0 && !stats.streakActiveToday && (
            <View style={s.gracePill}>
              <Text style={s.graceText}>
                Tu racha sigue viva, pero hoy no has registrado nada. Registra un movimiento para no perderla 🔥
              </Text>
            </View>
          )}

          {/* Logros nuevos */}
          {newlyUnlocked.length > 0 && (
            <View style={s.newBanner}>
              <Text style={s.newBannerText}>
                🎊 ¡Desbloqueaste {newlyUnlocked.length} logro{newlyUnlocked.length !== 1 ? 's' : ''} nuevo{newlyUnlocked.length !== 1 ? 's' : ''}!
              </Text>
            </View>
          )}

          {unlocked.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Desbloqueados</Text>
              {unlocked.map(item => <UnlockedCard key={item.code} item={item} />)}
            </>
          )}

          {locked.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Por desbloquear</Text>
              {locked.map(item => <LockedCard key={item.code} item={item} stats={stats} />)}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function UnlockedCard({ item }: { item: AchievementView }) {
  return (
    <View style={s.card}>
      <Text style={s.cardIcon}>{item.icon}</Text>
      <View style={s.cardInfo}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardTitle}>{item.title}</Text>
          {item.isNew && (
            <View style={s.newPill}><Text style={s.newPillText}>NUEVO</Text></View>
          )}
        </View>
        <Text style={s.cardDesc}>{item.description}</Text>
        {item.unlockedAt && (
          <Text style={s.cardDate}>Desbloqueado el {fmtDate(item.unlockedAt)}</Text>
        )}
      </View>
      <Text style={s.cardPoints}>+{item.points}</Text>
    </View>
  )
}

function LockedCard({ item, stats }: { item: AchievementView; stats: NonNullable<ReturnType<typeof useAchievements>['stats']> }) {
  const p = item.progress?.(stats)
  const pct = p && p.target > 0 ? Math.min(100, (p.current / p.target) * 100) : 0

  return (
    <View style={[s.card, s.cardLocked]}>
      <Text style={[s.cardIcon, { opacity: 0.35 }]}>{item.icon}</Text>
      <View style={s.cardInfo}>
        <Text style={s.cardTitleLocked}>{item.title}</Text>
        <Text style={s.cardDesc}>{item.description}</Text>
        {p && (
          <>
            <View style={s.miniBarBg}>
              <View style={[s.miniBarFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={s.cardProgress}>
              {p.target >= 1000 ? `${fmtXp(p.current)} / ${fmtXp(p.target)}` : `${p.current} / ${p.target}`}
            </Text>
          </>
        )}
      </View>
      <Text style={s.cardPointsLocked}>+{item.points}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 70 },
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20 },

  levelCard: { backgroundColor: '#1E293B', borderRadius: 24, padding: 20, marginTop: 8, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  levelGlow: { position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: '#6366F1', opacity: 0.14 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  levelIcon: { fontSize: 44 },
  levelName: { color: '#F8FAFC', fontSize: 19, fontWeight: '800' },
  levelXp: { color: '#94A3B8', fontSize: 14, marginTop: 2 },
  progressBg: { height: 10, backgroundColor: '#0F172A', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 10, backgroundColor: '#6366F1', borderRadius: 5 },
  levelNext: { color: '#64748B', fontSize: 12 },

  miniRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  miniCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  miniIcon: { fontSize: 20, marginBottom: 6 },
  miniValue: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  miniLabel: { color: '#64748B', fontSize: 11, marginTop: 2, textAlign: 'center' },

  gracePill: { backgroundColor: '#F9731615', borderWidth: 1, borderColor: '#F9731644', borderRadius: 14, padding: 14, marginBottom: 14 },
  graceText: { color: '#F97316', fontSize: 13, lineHeight: 19 },

  newBanner: { backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98144', borderRadius: 14, padding: 14, marginBottom: 14 },
  newBannerText: { color: '#34D399', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1E293B', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardLocked: { backgroundColor: '#1E293B80', borderColor: '#334155' },
  cardIcon: { fontSize: 30 },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  cardTitleLocked: { color: '#64748B', fontSize: 15, fontWeight: '700' },
  cardDesc: { color: '#64748B', fontSize: 12, marginTop: 3, lineHeight: 17 },
  cardDate: { color: '#475569', fontSize: 11, marginTop: 5 },
  cardPoints: { color: '#34D399', fontSize: 14, fontWeight: '800' },
  cardPointsLocked: { color: '#475569', fontSize: 14, fontWeight: '800' },
  newPill: { backgroundColor: '#34D399', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  newPillText: { color: '#0F172A', fontSize: 9, fontWeight: '800' },

  miniBarBg: { height: 5, backgroundColor: '#0F172A', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  miniBarFill: { height: 5, backgroundColor: '#6366F1', borderRadius: 3 },
  cardProgress: { color: '#475569', fontSize: 11, marginTop: 4 },
})
