import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { showAlert } from '../lib/alert'
import { confirm } from '../lib/confirm'
import { useAssistant } from '../hooks/useAssistant'
import { ChatMessage } from '../types'

const SUGGESTIONS = [
  '¿En qué gasté más este mes?',
  '¿Cómo voy con mis presupuestos?',
  '¿Cuánto me falta para mis metas?',
  'Dame 3 consejos para ahorrar según mis gastos',
]

export default function AssistantScreen() {
  const { messages, streaming, loading, sending, send, clear } = useAssistant()
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: true })

  useEffect(() => {
    if (messages.length || streaming) setTimeout(scrollToEnd, 50)
  }, [messages.length, streaming])

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || sending) return
    setInput('')
    try {
      await send(value)
    } catch (e: any) {
      setInput(value)
      showAlert('Error', e.message)
    }
  }

  const handleClear = () => {
    if (!messages.length) return
    confirm('Limpiar conversación', '¿Borrar todo el historial del asistente?', async () => {
      try {
        await clear()
      } catch (e: any) {
        showAlert('Error', e.message)
      }
    })
  }

  const isEmpty = !loading && messages.length === 0 && !streaming

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Asistente</Text>
        <TouchableOpacity onPress={handleClear} disabled={!messages.length}>
          <Text style={[s.clearText, !messages.length && { color: '#334155' }]}>Limpiar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : isEmpty ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🤖</Text>
            <Text style={s.emptyTitle}>Pregúntame sobre tus finanzas</Text>
            <Text style={s.emptySub}>
              Analizo tus movimientos, cuentas, presupuestos, metas y deudas reales para responderte.
            </Text>
            {SUGGESTIONS.map(sug => (
              <TouchableOpacity key={sug} style={s.suggestion} onPress={() => handleSend(sug)}>
                <Text style={s.suggestionText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
            renderItem={({ item }) => <Bubble message={item.content} isUser={item.role === 'user'} />}
            ListFooterComponent={
              sending ? (
                streaming ? (
                  <Bubble message={streaming} isUser={false} />
                ) : (
                  <View style={[s.bubble, s.bubbleAssistant, s.thinkingBubble]}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={s.thinkingText}>Analizando tus finanzas...</Text>
                  </View>
                )
              ) : null
            }
          />
        )}

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Escribe tu pregunta..."
            placeholderTextColor="#64748B"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            editable={!sending}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || sending}
          >
            <Text style={s.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Bubble({ message, isUser }: { message: string; isUser: boolean }) {
  return (
    <View style={[s.bubbleRow, isUser && { justifyContent: 'flex-end' }]}>
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAssistant]}>
        <Text style={[s.bubbleText, isUser && { color: '#fff' }]}>{message}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn: {},
  backText: { color: '#6366F1', fontSize: 17, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },
  clearText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  emptyIcon: { fontSize: 52, textAlign: 'center', marginBottom: 14 },
  emptyTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptySub: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 26 },
  suggestion: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  suggestionText: { color: '#CBD5E1', fontSize: 14 },

  list: { padding: 16, paddingBottom: 24 },
  bubbleRow: { flexDirection: 'row', marginBottom: 12 },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleUser: { backgroundColor: '#6366F1', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#E2E8F0', fontSize: 15, lineHeight: 21 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  thinkingText: { color: '#64748B', fontSize: 14 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1E293B', backgroundColor: '#0F172A' },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, color: '#F8FAFC', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#334155' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
})
