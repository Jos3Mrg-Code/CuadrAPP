import { Platform } from 'react-native'
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type WebPushStatus =
  | 'unsupported' | 'denied' | 'default'
  | 'granted-subscribed' | 'granted-unsubscribed'

/** Registra el service worker al abrir la app (requisito para instalar la PWA). */
export function registerServiceWorker() {
  if (Platform.OS !== 'web') return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

/** iPhone/iPad en Safari sin instalar: ahí Apple no expone la API de push. */
export function isIosNotInstalled(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document)
  if (!isIos) return false
  const installed =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return !installed
}

export function isSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
    typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function getStatus(): Promise<WebPushStatus> {
  if (!isSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub ? 'granted-subscribed' : 'granted-unsubscribed'
}

/** Pide permiso, suscribe al push service y guarda la suscripción en Supabase. */
export async function subscribe(userId: string): Promise<boolean> {
  if (!isSupported()) return false
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await getRegistration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }

  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' },
  )
  return !error
}

/** Cancela la suscripción del navegador y borra la fila en Supabase. */
export async function unsubscribe(): Promise<void> {
  if (!isSupported()) return
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
