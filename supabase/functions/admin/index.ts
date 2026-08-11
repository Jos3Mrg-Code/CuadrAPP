// Supabase Edge Function: admin
// Panel de administración: listar usuarios y asignar planes a mano.
// Deploy CON verificación de JWT: npx supabase functions deploy admin
//
// OJO: la verificación del gateway NO alcanza como control de acceso. La anon
// key también es un JWT firmado por el proyecto y está publicada en el bundle
// web, así que pasa el gateway. La autoridad real la dan getUser() + la
// bandera is_admin verificada aquí contra la base de datos.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  // apikey va incluido porque supabase-js lo manda automáticamente; sin él,
  // el preflight falla con un "Failed to fetch" difícil de diagnosticar.
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PAGES = 25
const PER_PAGE = 200

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'No autorizado' }, 401)

  // 1) Identidad: cliente anon con el JWT del que llama. getUser() valida
  //    firma, expiración y revocación contra GoTrue. La anon key falla aquí.
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await caller.auth.getUser()
  if (userError || !user) return json({ error: 'Sesión inválida' }, 401)

  // 2) Autorización: SIEMPRE contra user.id del JWT verificado, nunca del body.
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: me, error: meError } = await svc
    .from('user_plans').select('is_admin').eq('user_id', user.id).maybeSingle()
  if (meError) return json({ error: 'No se pudo verificar el rol' }, 500) // falla cerrado
  if (me?.is_admin !== true) return json({ error: 'Acceso denegado' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400)
  }
  const action = String(body?.action ?? '')

  // -------------------------------------------------------------- list_users
  if (action === 'list_users') {
    const authUsers: any[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: PER_PAGE })
      if (error) return json({ error: error.message }, 500)
      authUsers.push(...data.users)
      if (data.users.length < PER_PAGE) break
    }

    const [profilesRes, plansRes, statsRes] = await Promise.all([
      svc.from('profiles').select('id, full_name, currency'),
      svc.from('user_plans').select('user_id, plan, expires_at, is_admin, note, updated_at'),
      svc.rpc('admin_user_stats'),
    ])
    if (profilesRes.error) return json({ error: profilesRes.error.message }, 500)
    if (plansRes.error) return json({ error: plansRes.error.message }, 500)
    if (statsRes.error) return json({ error: statsRes.error.message }, 500)

    const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]))
    const plans = new Map((plansRes.data ?? []).map((p: any) => [p.user_id, p]))
    const stats = new Map((statsRes.data ?? []).map((s: any) => [s.user_id, s]))

    const users = authUsers.map((u) => {
      const plan = plans.get(u.id)
      const st = stats.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '',
        full_name: profiles.get(u.id)?.full_name ?? u.user_metadata?.full_name ?? 'Usuario',
        provider: u.app_metadata?.provider ?? 'email',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        plan: plan?.plan ?? 'free',            // sin fila = gratis
        expires_at: plan?.expires_at ?? null,
        is_admin: plan?.is_admin ?? false,
        note: plan?.note ?? null,
        plan_updated_at: plan?.updated_at ?? null,
        tx_count: Number(st?.tx_count ?? 0),
        last_tx: st?.last_tx ?? null,
      }
    }).sort((a, b) => b.created_at.localeCompare(a.created_at))

    // NUNCA hacer console.log(users): los logs de la función persisten datos personales.
    return json({ users, total: users.length }, 200)
  }

  // ---------------------------------------------------------------- set_plan
  if (action === 'set_plan') {
    const userId = String(body?.user_id ?? '')
    if (!UUID_RE.test(userId)) return json({ error: 'user_id inválido' }, 400)

    const plan = String(body?.plan ?? '')
    if (plan !== 'free' && plan !== 'premium') return json({ error: 'plan inválido' }, 400)

    let expiresAt: string | null = null
    if (body?.expires_at) {
      const d = new Date(String(body.expires_at))
      if (Number.isNaN(d.getTime())) return json({ error: 'Fecha inválida' }, 400)
      expiresAt = d.toISOString()
    }

    const note = body?.note == null ? null : String(body.note).slice(0, 500)

    // is_admin NO se incluye a propósito. Aunque alguien lo agregara, los
    // grants por columna harían que Postgres rechace la escritura (42501).
    const row = {
      plan,
      expires_at: expiresAt,
      note,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    // Update-then-insert en vez de upsert: el ON CONFLICT DO UPDATE de PostgREST
    // intenta escribir también user_id, y service_role no tiene privilegio de
    // UPDATE sobre esa columna (a propósito). Esto evita ampliar los grants.
    const { data: updated, error: upErr } = await svc
      .from('user_plans').update(row).eq('user_id', userId).select('user_id')
    if (upErr) return json({ error: upErr.message }, 400)

    if (!updated || updated.length === 0) {
      const { error: insErr } = await svc
        .from('user_plans').insert({ user_id: userId, ...row })
      if (insErr) {
        // 23503 = FK: el user_id no existe en auth.users
        const msg = insErr.code === '23503' ? 'Ese usuario no existe' : insErr.message
        return json({ error: msg }, 400)
      }
    }
    return json({ ok: true }, 200)
  }

  return json({ error: 'Acción desconocida' }, 400)
})
