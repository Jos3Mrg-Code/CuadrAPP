// Supabase Edge Function: finance-chat (RF-015)
// Asistente financiero con Claude. La llama el navegador con el JWT del usuario,
// así que se despliega CON verificación de JWT: npx supabase functions deploy finance-chat
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 2000
const HISTORY_LIMIT = 20      // mensajes previos enviados como contexto
const DAILY_MESSAGE_CAP = 50  // tope de mensajes por usuario cada 24h

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const money = (n: number) => '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Instrucciones estables: van primero para poder activar prompt caching si el
// contexto crece por encima del prefijo mínimo cacheable.
const INSTRUCTIONS = `Eres el asistente financiero de CuadrAPP, una app de finanzas personales.

Cómo respondes:
- Siempre en español, con tono cercano y directo. Tuteas al usuario.
- Montos en pesos colombianos con formato $1.234.567 (sin decimales).
- Breve y concreto: ve al grano, sin preámbulos ni repetir la pregunta.
- Texto plano, SIN markdown: nada de **negritas**, ## títulos, tablas ni bloques de código.
  Para listas usa guiones simples al inicio de la línea.
- Cuando cites cifras, usa EXCLUSIVAMENTE los datos del contexto financiero que viene abajo.
- Si el contexto no tiene la información para responder, dilo con claridad y sugiere qué
  registrar en la app para poder responder la próxima vez. NUNCA inventes cifras ni transacciones.
- Puedes hacer cálculos con esos datos (sumas, promedios, proyecciones simples) y explicarlos.
- Si el usuario no tiene datos suficientes (app recién creada), invítalo a registrar movimientos.

Límites importantes:
- Solo puedes CONSULTAR y ANALIZAR. No puedes crear, editar ni borrar nada. Si el usuario
  pide una acción (registrar un gasto, crear una meta), explícale en qué pantalla de la app hacerlo.
- No eres un asesor financiero licenciado. Puedes dar educación financiera general y observaciones
  sobre los hábitos del usuario, pero NO des recomendaciones personalizadas de inversión
  (qué acción/cripto comprar, cómo invertir sus ahorros). Ahí aclara tu límite y sugiere consultar
  a un profesional certificado.`

type Snapshot = { text: string; hasData: boolean }

async function buildSnapshot(supabase: any, userId: string): Promise<Snapshot> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now)

  const [accRes, txRes, budgetRes, goalRes, debtRes, payRes] = await Promise.all([
    supabase.from('accounts').select('name, type, balance').eq('user_id', userId).eq('is_active', true),
    supabase.from('transactions').select('amount, type, description, date, category:categories(name)')
      .eq('user_id', userId).gte('date', monthStart).order('date', { ascending: false }),
    supabase.from('budgets').select('amount, period, category:categories(name)').eq('user_id', userId),
    supabase.from('savings_goals').select('name, target_amount, current_amount, deadline')
      .eq('user_id', userId).eq('is_completed', false),
    supabase.from('debts').select('name, debt_type, total_amount, remaining_amount, due_date')
      .eq('user_id', userId).eq('is_paid', false),
    supabase.from('scheduled_payments').select('name, amount, frequency, next_date')
      .eq('user_id', userId).eq('is_active', true),
  ])

  const accounts = accRes.data ?? []
  const txs = txRes.data ?? []
  const budgets = budgetRes.data ?? []
  const goals = goalRes.data ?? []
  const debts = debtRes.data ?? []
  const payments = payRes.data ?? []

  const income = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expense = txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0)

  // Gasto por categoría del mes
  const byCat: Record<string, number> = {}
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const name = t.category?.name ?? 'Sin categoría'
    byCat[name] = (byCat[name] ?? 0) + Number(t.amount)
  }
  const catLines = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => `  - ${name}: ${money(amount)}`)

  const parts: string[] = []
  parts.push(`FECHA DE HOY: ${today} (zona horaria America/Bogota)`)
  parts.push(`\nBALANCE TOTAL: ${money(totalBalance)}`)
  parts.push(`\nCUENTAS (${accounts.length}):`)
  parts.push(accounts.length
    ? accounts.map((a: any) => `  - ${a.name} (${a.type}): ${money(a.balance)}`).join('\n')
    : '  (ninguna registrada)')

  parts.push(`\nMES ACTUAL (desde ${monthStart}): ingresos ${money(income)} · gastos ${money(expense)} · neto ${money(income - expense)}`)
  parts.push(`\nGASTO POR CATEGORÍA ESTE MES:`)
  parts.push(catLines.length ? catLines.join('\n') : '  (sin gastos registrados este mes)')

  parts.push(`\nMOVIMIENTOS DEL MES (${txs.length}, más recientes primero, máx 40):`)
  parts.push(txs.length
    ? txs.slice(0, 40).map((t: any) =>
        `  - ${t.date} ${t.type === 'income' ? '+' : '-'}${money(Number(t.amount))} ${t.category?.name ?? 'Sin categoría'}${t.description ? ` (${t.description})` : ''}`
      ).join('\n')
    : '  (ninguno)')

  parts.push(`\nPRESUPUESTOS (${budgets.length}):`)
  parts.push(budgets.length
    ? budgets.map((b: any) => {
        const spent = byCat[b.category?.name ?? ''] ?? 0
        const pct = Number(b.amount) > 0 ? Math.round((spent / Number(b.amount)) * 100) : 0
        return `  - ${b.category?.name ?? '?'} (${b.period === 'monthly' ? 'mensual' : 'semanal'}): límite ${money(Number(b.amount))}, gastado este mes ${money(spent)} (${pct}%)`
      }).join('\n')
    : '  (ninguno)')

  parts.push(`\nMETAS DE AHORRO ACTIVAS (${goals.length}):`)
  parts.push(goals.length
    ? goals.map((g: any) =>
        `  - ${g.name}: ${money(Number(g.current_amount))} de ${money(Number(g.target_amount))}${g.deadline ? `, fecha límite ${g.deadline}` : ''}`
      ).join('\n')
    : '  (ninguna)')

  parts.push(`\nDEUDAS ACTIVAS (${debts.length}):`)
  parts.push(debts.length
    ? debts.map((d: any) =>
        `  - ${d.name} (${d.debt_type}): falta ${money(Number(d.remaining_amount))} de ${money(Number(d.total_amount))}${d.due_date ? `, vence ${d.due_date}` : ''}`
      ).join('\n')
    : '  (ninguna)')

  parts.push(`\nPAGOS PROGRAMADOS (${payments.length}):`)
  parts.push(payments.length
    ? payments.map((p: any) => `  - ${p.name}: ${money(Number(p.amount))}, ${p.frequency}, próximo ${p.next_date}`).join('\n')
    : '  (ninguno)')

  const hasData = accounts.length > 0 || txs.length > 0
  return { text: parts.join('\n'), hasData }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'No autorizado' }, 401)

  // Cliente con el JWT del usuario: RLS aplica, cada quien solo ve lo suyo
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: 'Sesión inválida' }, 401)

  // El asistente es premium: es la función que cuesta dinero real por llamada,
  // así que la verificación va del lado del servidor, no de la UI.
  const { data: planRow } = await supabase
    .from('user_plans')
    .select('plan, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()
  const isPremium = planRow?.plan === 'premium' &&
    (!planRow.expires_at || new Date(planRow.expires_at).getTime() > Date.now())
  if (!isPremium) {
    return json({ error: 'El asistente es parte del plan Premium.' }, 403)
  }

  let message = ''
  try {
    const body = await req.json()
    message = String(body?.message ?? '').trim()
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400)
  }
  if (!message) return json({ error: 'Mensaje vacío' }, 400)
  if (message.length > 2000) return json({ error: 'El mensaje es demasiado largo' }, 400)

  // Tope diario por usuario
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', since)
  if ((count ?? 0) >= DAILY_MESSAGE_CAP) {
    return json({ error: 'Alcanzaste el límite de mensajes por hoy. Intenta mañana.' }, 429)
  }

  const [snapshot, historyRes] = await Promise.all([
    buildSnapshot(supabase, user.id),
    supabase.from('chat_messages').select('role, content')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
  ])

  const history = ((historyRes.data ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse()
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ]

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let full = ''
      try {
        const claude = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          // Instrucciones estables primero, datos volátiles al final
          system: `${INSTRUCTIONS}\n\n=== CONTEXTO FINANCIERO DEL USUARIO ===\n${snapshot.text}`,
          messages,
        })

        for await (const event of claude) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        const finalMessage = await claude.finalMessage()
        if (finalMessage.stop_reason === 'refusal') {
          const note = '\n\n⚠️ No puedo ayudarte con eso.'
          full += note
          controller.enqueue(encoder.encode(note))
        }

        if (full.trim()) {
          await supabase.from('chat_messages').insert([
            { user_id: user.id, role: 'user', content: message },
            { user_id: user.id, role: 'assistant', content: full },
          ])
        }
      } catch (err) {
        console.error('finance-chat error:', String(err))
        controller.enqueue(encoder.encode('\n\n⚠️ Hubo un error consultando al asistente. Intenta de nuevo.'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
})
