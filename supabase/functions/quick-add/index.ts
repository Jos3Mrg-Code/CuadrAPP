// Supabase Edge Function: quick-add
// Registra un ingreso o gasto desde un atajo del celular, sin abrir la app.
// Deploy SIN verificación de JWT (el atajo solo manda su token personal):
//   npx supabase functions deploy quick-add --no-verify-jwt
//
// La autoridad la da el token de quick_add_tokens, que solo permite CREAR
// movimientos en la cuenta de su dueño.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-quick-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const money = (n: number) => '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })

/**
 * El consumidor es la app Atajos, que muestra el cuerpo crudo en la notificación.
 * Por eso se responde texto plano salvo que el cliente pida JSON explícitamente.
 */
function makeReply(req: Request) {
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json')
  return (body: { message?: string; error?: string; [k: string]: unknown }, status: number) => {
    if (wantsJson) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    return new Response(String(body.message ?? body.error ?? ''), {
      status,
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

/** Acepta "50000", "50.000", "50,5" y "$50.000". */
function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  let s = String(raw ?? '').trim().replace(/[$\s]/g, '')
  if (!s) return null
  // Si hay coma y punto, el último separador manda como decimal
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (lastComma > -1) {
    // Coma sola: decimal si deja 1-2 dígitos, si no es separador de miles
    s = s.length - lastComma <= 3 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot > -1) {
    if (s.length - lastDot > 3) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Minúsculas y sin tildes, para comparar nombres escritos a mano o dictados. */
const norm = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const reply = makeReply(req)
  if (req.method !== 'POST') return reply({ error: 'Método no permitido' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'Cuerpo inválido' }, 400)
  }

  const token = String(req.headers.get('x-quick-token') ?? body?.token ?? '').trim()
  if (!token) return reply({ error: 'Falta el token' }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: tokenRow, error: tokenError } = await supabase
    .from('quick_add_tokens').select('user_id').eq('token', token).maybeSingle()
  if (tokenError) return reply({ error: 'No se pudo validar el token' }, 500)
  if (!tokenRow) return reply({ error: 'Token inválido' }, 401)
  const userId = tokenRow.user_id as string

  // --- Modo lista: el atajo pide las cuentas para armar el selector ---
  // Siempre responde JSON, aunque no lo pidan: Atajos convierte un array JSON
  // en una lista que "Seleccionar de la lista" consume directamente.
  const action = norm(String(body?.action ?? body?.accion ?? ''))
  if (action === 'accounts' || action === 'cuentas') {
    const { data, error } = await supabase
      .from('accounts').select('name')
      .eq('user_id', userId).eq('is_active', true).order('created_at')
    if (error) return reply({ error: error.message }, 500)
    return new Response(JSON.stringify((data ?? []).map((a: any) => a.name)), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // --- Validación de entrada ---
  const amount = parseAmount(body?.amount ?? body?.monto)
  if (amount === null || amount <= 0) return reply({ error: 'Monto inválido' }, 400)
  if (amount > 1e12) return reply({ error: 'Monto demasiado grande' }, 400)

  const rawType = norm(String(body?.type ?? body?.tipo ?? 'expense'))
  const type = ['income', 'ingreso', 'entrada'].includes(rawType) ? 'income' : 'expense'

  const description = String(body?.description ?? body?.descripcion ?? '').trim().slice(0, 200)
  const categoryName = String(body?.category ?? body?.categoria ?? '').trim()
  const accountName = String(body?.account ?? body?.cuenta ?? '').trim()

  // --- Resolver la cuenta ---
  const { data: accounts, error: accError } = await supabase
    .from('accounts').select('id, name, balance')
    .eq('user_id', userId).eq('is_active', true).order('created_at')
  if (accError) return reply({ error: accError.message }, 500)
  if (!accounts?.length) {
    return reply({ error: 'No tienes cuentas activas. Crea una en la app primero.' }, 400)
  }

  let account = accounts[0]
  if (accountName) {
    const match = accounts.find((a: any) => norm(a.name) === norm(accountName))
    if (!match) {
      return reply({
        error: `No encontré la cuenta "${accountName}". Disponibles: ${accounts.map((a: any) => a.name).join(', ')}`,
      }, 400)
    }
    account = match
  } else if (accounts.length > 1) {
    return reply({
      error: `Tienes varias cuentas, indica cuál en el atajo. Disponibles: ${accounts.map((a: any) => a.name).join(', ')}`,
    }, 400)
  }

  // --- Resolver la categoría (opcional) ---
  let categoryId: string | null = null
  if (categoryName) {
    const { data: cats } = await supabase
      .from('categories').select('id, name, type')
      .or(`user_id.eq.${userId},is_default.eq.true`).eq('type', type)
    const match = (cats ?? []).find((c: any) => norm(c.name) === norm(categoryName))
    if (!match) {
      return reply({
        error: `No encontré la categoría "${categoryName}" para ${type === 'income' ? 'ingresos' : 'gastos'}. Disponibles: ${(cats ?? []).map((c: any) => c.name).join(', ')}`,
      }, 400)
    }
    categoryId = match.id
  }

  // --- Insertar el movimiento (mismo flujo que useTransactions.addTransaction) ---
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  const { data: inserted, error: insError } = await supabase.from('transactions').insert({
    user_id: userId,
    account_id: account.id,
    category_id: categoryId,
    amount,
    type,
    description,
    date: today,
  }).select().single()
  if (insError) return reply({ error: insError.message }, 400)

  const delta = type === 'income' ? amount : -amount
  const newBalance = Number(account.balance) + delta
  await supabase.from('accounts').update({ balance: newBalance }).eq('id', account.id)
  await supabase.from('transaction_logs').insert({
    transaction_id: inserted.id,
    user_id: userId,
    action: 'created',
    snapshot: inserted,
    changes: null,
  })

  const label = type === 'income' ? 'Ingreso' : 'Gasto'
  return reply({
    ok: true,
    message: `${label} de ${money(amount)} registrado en ${account.name}. Nuevo saldo: ${money(newBalance)}`,
    balance: newBalance,
  }, 200)
})
