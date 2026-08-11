import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export const QUICK_ADD_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/quick-add`

/**
 * Atajos ya armados, compartidos desde la app Atajos como enlace de iCloud.
 * Cada uno pide el token al importarse (Preguntas de importación), así que el
 * mismo enlace sirve para todos los usuarios.
 * Lista vacía = la sección de descarga no se muestra.
 */
export const SHORTCUT_LINKS: { label: string; hint: string; url: string }[] = [
  {
    label: 'Registrar gasto',
    hint: 'Pregunta monto, descripción y cuenta',
    url: 'https://www.icloud.com/shortcuts/8c291a2614aa4faca2987f8b8d227bf4',
  },
  {
    label: 'Registrar ingreso',
    hint: 'Pregunta monto, descripción y cuenta',
    url: 'https://www.icloud.com/shortcuts/cd26c4f9926e4679b1b11705f46cf81a',
  },
]

/** Token aleatorio de 32 bytes en base64url. */
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function useQuickAddToken() {
  const { session } = useAuthStore()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetchToken()
  }, [session])

  const fetchToken = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('quick_add_tokens')
      .select('token')
      .eq('user_id', session!.user.id)
      .maybeSingle()
    setToken(data?.token ?? null)
    setLoading(false)
  }

  /** Crea el token la primera vez, o lo rota si ya existía. */
  const generate = async () => {
    const value = generateToken()
    const { error } = await supabase.from('quick_add_tokens').upsert(
      { user_id: session!.user.id, token: value, created_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) throw error
    setToken(value)
    return value
  }

  const revoke = async () => {
    const { error } = await supabase
      .from('quick_add_tokens').delete().eq('user_id', session!.user.id)
    if (error) throw error
    setToken(null)
  }

  return { token, loading, generate, revoke, refresh: fetchToken }
}
