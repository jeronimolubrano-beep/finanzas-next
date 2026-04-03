import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    // ── Fetch financial context ──────────────────────────────────────────────
    const supabase = await createClient()

    const { data: transactions } = await supabase
      .from('transactions')
      .select('date, description, amount, type, status, currency, categories(name), businesses(name)')
      .order('date', { ascending: false })
      .limit(150)

    const { data: settings } = await supabase.from('settings').select('*')
    const sMap: Record<string, string> = {}
    for (const s of settings ?? []) sMap[s.key] = s.value ?? ''

    const { data: categories } = await supabase.from('categories').select('name, type')
    const { data: businesses } = await supabase.from('businesses').select('name')

    // ── Build summaries ─────────────────────────────────────────────────────
    type Tx = {
      date: string
      description: string
      amount: number | string
      type: string
      status: string
      currency: string | null
      categories: { name: string } | null
      businesses: { name: string } | null
    }
    const txs = (transactions ?? []) as Tx[]
    const totalIncome  = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const pendingCount = txs.filter(t => t.status === 'devengado').length
    const paidCount    = txs.filter(t => t.status === 'percibido').length

    // Monthly
    const monthly: Record<string, { income: number; expense: number }> = {}
    for (const t of txs) {
      const m = t.date.slice(0, 7)
      if (!monthly[m]) monthly[m] = { income: 0, expense: 0 }
      if (t.type === 'income') monthly[m].income += Number(t.amount)
      else monthly[m].expense += Number(t.amount)
    }

    // By category
    const byCat: Record<string, { income: number; expense: number }> = {}
    for (const t of txs) {
      const name = t.categories?.name ?? 'Sin categoría'
      if (!byCat[name]) byCat[name] = { income: 0, expense: 0 }
      if (t.type === 'income') byCat[name].income += Number(t.amount)
      else byCat[name].expense += Number(t.amount)
    }

    // By business
    const byBiz: Record<string, { income: number; expense: number }> = {}
    for (const t of txs) {
      const name = t.businesses?.name ?? 'Sin empresa'
      if (!byBiz[name]) byBiz[name] = { income: 0, expense: 0 }
      if (t.type === 'income') byBiz[name].income += Number(t.amount)
      else byBiz[name].expense += Number(t.amount)
    }

    const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

    const dataCtx = `
DATOS FINANCIEROS (últimas ${txs.length} transacciones):

Resumen:
- Total ingresos: ${fmt(totalIncome)}
- Total gastos: ${fmt(totalExpense)}
- Resultado neto: ${fmt(totalIncome - totalExpense)}
- Pendientes: ${pendingCount} | Pagadas/cobradas: ${paidCount}
- TC: ${sMap.current_rate || 'no configurado'} ARS/USD (${sMap.rate_type || '-'})

Por mes:
${Object.entries(monthly).sort().reverse().map(([m, d]) =>
  `  ${m}: Ing ${fmt(d.income)} | Gast ${fmt(d.expense)} | Neto ${fmt(d.income - d.expense)}`
).join('\n')}

Por categoría (top):
${Object.entries(byCat).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).slice(0, 10).map(([name, d]) =>
  `  ${name}: Ing ${fmt(d.income)} | Gast ${fmt(d.expense)}`
).join('\n')}

Por empresa:
${Object.entries(byBiz).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).map(([name, d]) =>
  `  ${name}: Ing ${fmt(d.income)} | Gast ${fmt(d.expense)}`
).join('\n')}

Categorías: ${(categories ?? []).map(c => `${c.name} (${c.type})`).join(', ')}
Empresas: ${(businesses ?? []).map(b => b.name).join(', ')}

Últimas 15 transacciones:
${txs.slice(0, 15).map(t =>
  `  ${t.date} | ${t.description} | ${fmt(Number(t.amount))} ${t.currency ?? 'ARS'} | ${t.type} | ${t.status} | ${t.categories?.name ?? '-'} | ${t.businesses?.name ?? '-'}`
).join('\n')}
`

    const systemPrompt = `Sos un asistente financiero inteligente para "Grupo Lubrano", un sistema de gestión financiera familiar argentino.

Tu trabajo:
1. Responder preguntas sobre datos financieros (KPIs, transacciones, gastos, ingresos, tendencias)
2. Ayudar a entender y usar la app
3. Dar análisis y recomendaciones financieras basadas en datos reales

REGLAS:
- Respondé SIEMPRE en español argentino (vos, tenés, etc.)
- Sé conciso: 2-5 oraciones, salvo que pidan más detalle
- Usá números formateados ($X.XXX)
- Si no tenés datos suficientes, decilo honestamente
- NO inventes datos
- Podés usar emojis moderadamente (📊 💰 📈 📉 ⚠️)

FUNCIONALIDADES DE LA APP:
- Dashboard: KPIs del mes actual
- Transacciones: ver todas, agregar manual, OCR (foto de ticket), importar CSV/PDF, pagos pendientes
- Reportes: Flujo de Caja (solo percibido/efectivo real), Estado de Resultados (P&L anual por mes)
- Configuración: Categorías, Tipo de Cambio (dólar en vivo vía DolarAPI)
- Filtros: por tipo, mes, empresa, estado, ordenar por fecha/monto, toggle ARS/USD
- Login: con usuario o email

${dataCtx}`

    // ── Call Claude API ─────────────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-3-5-20241022',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages.slice(-10).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return NextResponse.json(
        { error: `Error de API (${response.status}): ${errBody}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')

    return NextResponse.json({
      message: textBlock?.text || 'No se pudo generar una respuesta',
    })
  } catch (error) {
    console.error('AI Chat error:', error)
    return NextResponse.json(
      { error: 'Error: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
