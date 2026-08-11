import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { showAlert } from '../lib/alert'
import { confirm } from '../lib/confirm'
import { useQuickAddToken, QUICK_ADD_URL, SHORTCUT_LINKS } from '../hooks/useQuickAddToken'

function copy(text: string) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
    return true
  }
  return false
}

export default function ShortcutScreen() {
  const { token, loading, generate, revoke } = useQuickAddToken()
  const [busy, setBusy] = useState(false)

  const bodyExample = `{
  "token": "${token ?? 'TU_TOKEN'}",
  "type": "gasto",
  "amount": "50000",
  "description": "Almuerzo",
  "category": "Alimentación"
}`

  const handleGenerate = async () => {
    setBusy(true)
    try {
      await generate()
    } catch (e: any) {
      showAlert('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = () => {
    confirm('Revocar token', 'Los atajos que lo usen dejarán de funcionar. ¿Continuar?', async () => {
      try {
        await revoke()
      } catch (e: any) {
        showAlert('Error', e.message)
      }
    })
  }

  const copyAndTell = (value: string, what: string) => {
    showAlert(copy(value) ? 'Copiado' : 'Copia manualmente', copy(value) ? `${what} copiado al portapapeles` : value)
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Atajo rápido</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.intro}>
          Registra un gasto o un ingreso desde tu celular sin abrir la app, usando la app Atajos
          de iPhone (o cualquier app que pueda hacer una petición HTTP).
        </Text>

        {loading ? (
          <ActivityIndicator color="#6366F1" style={{ marginTop: 30 }} />
        ) : !token ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🔑</Text>
            <Text style={s.emptyTitle}>Aún no tienes token</Text>
            <Text style={s.emptySub}>
              Genera uno para conectar tus atajos. Solo permite crear movimientos en tu cuenta:
              no sirve para leer ni borrar nada.
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={handleGenerate} disabled={busy}>
              <Text style={s.primaryBtnText}>{busy ? 'Generando...' : 'Generar token'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.sectionTitle}>1. Tu token</Text>
            <TouchableOpacity style={s.codeBox} onPress={() => copyAndTell(token, 'Token')}>
              <Text style={s.code} selectable>{token}</Text>
              <Text style={s.copyHint}>Toca para copiar</Text>
            </TouchableOpacity>
            <Text style={s.warn}>
              Trátalo como una contraseña. Si lo pierdes o lo compartes, revócalo abajo y genera otro.
            </Text>

            <Text style={s.sectionTitle}>2. La dirección</Text>
            <TouchableOpacity style={s.codeBox} onPress={() => copyAndTell(QUICK_ADD_URL, 'URL')}>
              <Text style={s.code} selectable>{QUICK_ADD_URL}</Text>
              <Text style={s.copyHint}>Toca para copiar</Text>
            </TouchableOpacity>

            {SHORTCUT_LINKS.length > 0 && (
              <>
                <Text style={s.sectionTitle}>3. Descarga el atajo listo</Text>
                <View style={s.downloadBox}>
                  <Text style={s.downloadIntro}>
                    Ábrelos desde el iPhone. Al tocar, tu token se copia solo: cuando iOS lo pida
                    al importar, basta con pegar.
                  </Text>
                  {SHORTCUT_LINKS.map(link => (
                    <TouchableOpacity
                      key={link.url}
                      style={s.downloadBtn}
                      onPress={() => {
                        copy(token)
                        Linking.openURL(link.url)
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.downloadLabel}>{link.label}</Text>
                        <Text style={s.downloadHint}>{link.hint}</Text>
                      </View>
                      <Text style={s.downloadArrow}>↓</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.tip}>
                  Si prefieres armarlo tú, o no usas iPhone, sigue los pasos de abajo.
                </Text>
              </>
            )}

            <Text style={s.sectionTitle}>
              {SHORTCUT_LINKS.length > 0 ? '4. O ármalo a mano' : '3. Arma el atajo en iPhone'}
            </Text>
            <View style={s.stepsBox}>
              <Text style={s.step}>1. Abre <Text style={s.bold}>Atajos</Text> → <Text style={s.bold}>+</Text> para crear uno nuevo.</Text>
              <Text style={s.step}>2. Busca la acción <Text style={s.bold}>"Solicitar entrada"</Text> (si no aparece, escribe solo <Text style={s.bold}>entrada</Text> en el buscador). Ponle tipo Número y la pregunta "¿Cuánto?".</Text>
              <Text style={s.step}>3. Añade <Text style={s.bold}>"Obtener contenido de URL"</Text> y pega la dirección de arriba.</Text>
              <Text style={s.step}>4. Toca la flecha para desplegar sus opciones: método <Text style={s.bold}>POST</Text>, y en <Text style={s.bold}>"Solicitar cuerpo"</Text> elige <Text style={s.bold}>JSON</Text>. Agrega los campos del ejemplo; en <Text style={s.bold}>amount</Text> pon la variable "Entrada proporcionada".</Text>
              <Text style={s.step}>5. Añade <Text style={s.bold}>"Mostrar notificación"</Text> con la variable "Contenido de URL". La respuesta ya viene lista para leerse, así que no necesitas extraer nada.</Text>
              <Text style={s.step}>6. Ponle nombre e ícono. Desde el menú del atajo puedes <Text style={s.bold}>añadirlo a la pantalla de inicio</Text>, a un widget, al botón de acción o a "tocar atrás".</Text>
            </View>

            <Text style={s.sectionTitle}>
              {SHORTCUT_LINKS.length > 0 ? '5' : '4'}. Cuerpo de la petición
            </Text>
            <TouchableOpacity style={s.codeBox} onPress={() => copyAndTell(bodyExample, 'Ejemplo')}>
              <Text style={s.code} selectable>{bodyExample}</Text>
              <Text style={s.copyHint}>Toca para copiar</Text>
            </TouchableOpacity>

            <View style={s.fieldsBox}>
              <Text style={s.fieldsTitle}>Campos</Text>
              <Text style={s.field}><Text style={s.bold}>token</Text> — obligatorio.</Text>
              <Text style={s.field}><Text style={s.bold}>amount</Text> — obligatorio. Acepta 50000, 50.000 o $50.000.</Text>
              <Text style={s.field}><Text style={s.bold}>type</Text> — "gasto" o "ingreso". Si lo omites, se asume gasto.</Text>
              <Text style={s.field}><Text style={s.bold}>description</Text> — opcional.</Text>
              <Text style={s.field}><Text style={s.bold}>category</Text> — opcional, por nombre. Si no coincide, te devuelve la lista de las disponibles.</Text>
              <Text style={s.field}><Text style={s.bold}>account</Text> — opcional si tienes una sola cuenta; obligatorio si tienes varias.</Text>
            </View>

            <Text style={s.sectionTitle}>Cuentas automáticas</Text>
            <View style={s.stepsBox}>
              <Text style={s.step}>
                Para que el atajo muestre tus cuentas reales sin escribirlas a mano, añade
                al principio otra acción <Text style={s.bold}>"Obtener contenido de URL"</Text> a
                esta misma dirección, con método <Text style={s.bold}>POST</Text> y cuerpo JSON de
                solo dos campos: <Text style={s.bold}>token</Text> y <Text style={s.bold}>action</Text> con
                el valor <Text style={s.bold}>accounts</Text>.
              </Text>
              <Text style={s.step}>
                Eso devuelve la lista de tus cuentas activas. Conéctala
                a <Text style={s.bold}>"Seleccionar de la lista"</Text> y el resultado al
                campo <Text style={s.bold}>account</Text>, en lugar de la acción "Lista".
              </Text>
              <Text style={s.step}>
                Así, cuando crees o desactives una cuenta en Cuadrapp, el atajo se actualiza solo.
              </Text>
            </View>

            <Text style={s.tip}>
              Truco: crea dos atajos, uno con "type": "gasto" y otro con "ingreso", y así no tienes
              que elegir nada al usarlos.
            </Text>

            <TouchableOpacity style={s.dangerBtn} onPress={handleRevoke}>
              <Text style={s.dangerBtnText}>Revocar token</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={handleGenerate} disabled={busy}>
              <Text style={s.secondaryBtnText}>{busy ? 'Generando...' : 'Generar uno nuevo (invalida el actual)'}</Text>
            </TouchableOpacity>
          </>
        )}

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
  intro: { color: '#94A3B8', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 8 },

  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 24, marginBottom: 10 },

  codeBox: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155' },
  code: { color: '#A5B4FC', fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, lineHeight: 18 },
  copyHint: { color: '#475569', fontSize: 11, marginTop: 8 },
  warn: { color: '#F97316', fontSize: 12, lineHeight: 18, marginTop: 10 },

  downloadBox: { backgroundColor: '#6366F112', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#6366F144', gap: 10 },
  downloadIntro: { color: '#A5B4FC', fontSize: 12, lineHeight: 18, marginBottom: 2 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  downloadLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  downloadHint: { color: '#64748B', fontSize: 11, marginTop: 2 },
  downloadArrow: { color: '#6366F1', fontSize: 20, fontWeight: '800' },

  stepsBox: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155', gap: 10 },
  step: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  bold: { fontWeight: '800', color: '#F8FAFC' },

  fieldsBox: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155', marginTop: 12, gap: 8 },
  fieldsTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  field: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },

  tip: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 16 },

  emptyBox: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  primaryBtn: { backgroundColor: '#6366F1', borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  dangerBtn: { backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF444444', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 26 },
  dangerBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
})
