import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { ChatMessage } from '../types'

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/finance-chat`

export function useAssistant() {
  const { session } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!session) return
    fetchMessages()
  }, [session])

  const fetchMessages = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', session!.user.id)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) ?? [])
    if (!silent) setLoading(false)
  }

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || sending || !session) return

    setSending(true)
    setStreaming('')

    // Mostrar el mensaje del usuario de inmediato; el servidor lo persiste al final
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      user_id: session.user.id,
      role: 'user',
      content: clean,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const { data: { session: fresh } } = await supabase.auth.getSession()
      const token = fresh?.access_token
      if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: clean }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any))
        throw new Error(body?.error ?? `Error ${res.status}`)
      }
      if (!res.body) throw new Error('El asistente no devolvió respuesta')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setStreaming(acc)
      }

      // El servidor ya guardó ambos mensajes: recargamos para tener los IDs reales
      await fetchMessages(true)
      setStreaming('')
    } catch (e: any) {
      // Quitar el optimista para que el usuario pueda reintentar sin duplicados
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setStreaming('')
      throw e
    } finally {
      setSending(false)
    }
  }

  const clear = async () => {
    if (!session) return
    const { error } = await supabase.from('chat_messages').delete().eq('user_id', session.user.id)
    if (error) throw error
    setMessages([])
    setStreaming('')
  }

  return { messages, streaming, loading, sending, send, clear, refresh: fetchMessages }
}
