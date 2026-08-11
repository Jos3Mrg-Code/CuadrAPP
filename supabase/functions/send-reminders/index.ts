// Supabase Edge Function: send-reminders (RF-013)
// Invocada por cron diario. Deploy: npx supabase functions deploy send-reminders --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')! // secreto dedicado para invocar esta función
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')! // mailto:...

// Conversión: claves raw base64url (npx web-push) -> JWK (lo que espera @negrel/webpush)
function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
function bytesToB64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function buildAppServer(): Promise<webpush.ApplicationServer> {
  const pub = b64urlToBytes(VAPID_PUBLIC_KEY) // 65 bytes: 0x04 || x(32) || y(32)
  const x = bytesToB64url(pub.slice(1, 33))
  const y = bytesToB64url(pub.slice(33, 65))
  const vapidKeys = await webpush.importVapidKeys({
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d: VAPID_PRIVATE_KEY, ext: true },
  }, { extractable: false })
  return webpush.ApplicationServer.new({ contactInformation: VAPID_SUBJECT, vapidKeys })
}

type Payment = { id: string; user_id: string; name: string; amount: number; next_date: string }

const money = (n: number) => '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })

function paymentLine(p: Payment, today: string): string {
  const days = Math.round((Date.parse(today) - Date.parse(p.next_date)) / 86400000)
  if (days <= 0) return `"${p.name}" (${money(p.amount)}) vence hoy`
  if (days === 1) return `"${p.name}" (${money(p.amount)}) venció ayer`
  return `"${p.name}" (${money(p.amount)}) venció hace ${days} días`
}

function buildPayload(payments: Payment[], today: string) {
  const overdue = payments.some((p) => p.next_date < today)
  if (payments.length === 1) {
    return {
      title: overdue ? '📅 Pago vencido' : '💸 Pago próximo',
      body: paymentLine(payments[0], today),
      url: '/calendar',
    }
  }
  const lines = payments.slice(0, 3).map((p) => paymentLine(p, today))
  const extra = payments.length > 3 ? ` y ${payments.length - 3} más` : ''
  return {
    title: `📅 Tienes ${payments.length} pagos pendientes`,
    body: lines.join(' · ') + extra,
    url: '/calendar',
  }
}

Deno.serve(async (req) => {
  // Protección: secreto dedicado (la función se despliega con --no-verify-jwt)
  if (req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // "Hoy" en zona horaria de Bogotá (en-CA => YYYY-MM-DD)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

  const { data: payments, error } = await supabase
    .from('scheduled_payments')
    .select('id, user_id, name, amount, next_date')
    .eq('is_active', true)
    .lte('next_date', today)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!payments?.length) return Response.json({ sent: 0, users: 0 })

  const byUser = new Map<string, Payment[]>()
  for (const p of payments as Payment[]) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, [])
    byUser.get(p.user_id)!.push(p)
  }

  // El calendario es premium: no notificar a quien ya no puede abrirlo
  const nowIso = new Date().toISOString()
  const { data: premiumRows } = await supabase
    .from('user_plans')
    .select('user_id')
    .eq('plan', 'premium')
    .in('user_id', [...byUser.keys()])
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  const premiumIds = new Set((premiumRows ?? []).map((r: any) => r.user_id))
  for (const uid of [...byUser.keys()]) {
    if (!premiumIds.has(uid)) byUser.delete(uid)
  }
  if (byUser.size === 0) return Response.json({ sent: 0, users: 0 })

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', [...byUser.keys()])
  if (subsError) return Response.json({ error: subsError.message }, { status: 500 })
  if (!subs?.length) return Response.json({ sent: 0, users: byUser.size })

  const appServer = await buildAppServer()
  const stale: string[] = []
  let sent = 0

  for (const sub of subs) {
    const payload = buildPayload(byUser.get(sub.user_id)!, today)
    try {
      const subscriber = appServer.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      })
      await subscriber.pushTextMessage(JSON.stringify(payload), { ttl: 86400 })
      sent++
    } catch (err) {
      if (err instanceof webpush.PushMessageError && (err.isGone() || err.response.status === 404)) {
        stale.push(sub.endpoint) // suscripción expirada: limpiar
      } else {
        console.error('push failed for', sub.endpoint, String(err))
      }
    }
  }

  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale)
  }

  return Response.json({ sent, users: byUser.size, removed: stale.length })
})
