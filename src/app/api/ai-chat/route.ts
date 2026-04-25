import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { txToARS } from '@/lib/utils'
import { getBurnRate, getRunway } from '@/lib/metrics'
import { getConsolidatedBalanceSheet, calculateBalanceRatios } from '@/app/reports/balance-sheet/actions'
import { getReportFxSettings } from '@/lib/fx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Claude tool definitions ──────────────────────────────────────────────────
const AI_TOOLS = [
  {
    name: 'search_transactions',
    description:
      'Busca transacciones por descripción, categoría, empresa, mes, tipo o estado. ' +
      'Usá esta herramienta cuando el usuario pregunte por un proveedor específico, concepto o período que no esté cubierto en el contexto.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description_contains: { type: 'string', description: 'Texto parcial a buscar en la descripción (case-insensitive)' },
        month: { type: 'string', description: 'Período en formato YYYY-MM' },
        year: { type: 'string', description: 'Año YYYY — busca todos sus meses' },
        category_name: { type: 'string', description: 'Nombre parcial de la categoría' },
        business_name: { type: 'string', description: 'Nombre parcial de la empresa' },
        type: { type: 'string', enum: ['income', 'expense'] },
        status: { type: 'string', enum: ['percibido', 'devengado'] },
        limit: { type: 'number', description: 'Máximo de resultados (default 50, max 200)' },
      },
    },
  },
  {
    name: 'get_cash_flow',
    description:
      'Flujo de caja real (solo efectivo cobrado/pagado — status percibido) de un mes. ' +
      'Retorna saldo apertura, entradas, salidas, flujo neto, saldo cierre y detalle por categoría.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: { type: 'string', description: 'YYYY-MM' },
        business_id: { type: 'number', description: 'ID empresa (omitir = consolidado)' },
      },
      required: ['month'],
    },
  },
  {
    name: 'get_income_statement',
    description:
      'Estado de resultados (P&L) mensual de un año completo: ingresos, gastos y resultado neto por mes y totales anuales.',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'string', description: 'YYYY' },
        business_id: { type: 'number', description: 'ID empresa (omitir = consolidado)' },
      },
      required: ['year'],
    },
  },
  {
    name: 'get_budget_vs_actuals',
    description:
      'Compara el presupuesto planificado con los gastos reales por categoría en un mes. ' +
      'Retorna varianza y % de ejecución por categoría.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: { type: 'string', description: 'YYYY-MM' },
        business_id: { type: 'number', description: 'ID empresa (omitir = consolidado)' },
      },
      required: ['month'],
    },
  },
]

// ── Types ────────────────────────────────────────────────────────────────────
type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type TxFull = {
  date: string
  description: string
  amount: number | string
  type: string
  status: string
  currency: string | null
  exchange_rate: number | null
  categories: { name: string } | { name: string }[] | null
  businesses: { name: string } | { name: string }[] | null
}

type AnthropicBlock = {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

type AnthropicMsg = { role: string; content: string | AnthropicBlock[] }

// ── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  fallbackRate: number,
): Promise<unknown> {
  try {
    // ── search_transactions ─────────────────────────────────────────────────
    if (name === 'search_transactions') {
      const {
        description_contains,
        month,
        year,
        category_name,
        business_name,
        type,
        status,
        limit = 50,
      } = input as Record<string, string | number | undefined>

      let q = supabase
        .from('transactions')
        .select('date, description, amount, currency, exchange_rate, type, status, categories(name), businesses(name)')
        .order('date', { ascending: false })
        .limit(Math.min(Number(limit ?? 50), 200))

      if (description_contains) q = q.ilike('description', `%${description_contains}%`)
      if (month) { q = q.gte('date', `${month}-01`).lte('date', `${month}-31`) }
      else if (year) { q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`) }
      if (type) q = q.eq('type', type)
      if (status) q = q.eq('status', status)

      const { data: rows } = await q
      if (!rows || rows.length === 0) return { count: 0, transactions: [], total_ars: 0 }

      const txs = rows as unknown as TxFull[]

      const filtered = txs.filter(t => {
        const catName = Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name: string } | null)?.name
        const bizName = Array.isArray(t.businesses) ? t.businesses[0]?.name : (t.businesses as { name: string } | null)?.name
        if (category_name && !catName?.toLowerCase().includes(String(category_name).toLowerCase())) return false
        if (business_name && !bizName?.toLowerCase().includes(String(business_name).toLowerCase())) return false
        return true
      })

      const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      const totalArs = filtered.reduce((s, t) => s + txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate), 0)

      return {
        count: filtered.length,
        total_ars_formatted: fmt(totalArs),
        transactions: filtered.map(t => {
          const catName = Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name: string } | null)?.name
          const bizName = Array.isArray(t.businesses) ? t.businesses[0]?.name : (t.businesses as { name: string } | null)?.name
          const ars = txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate)
          return {
            date: t.date,
            description: t.description,
            amount_ars: fmt(ars),
            currency: t.currency ?? 'ARS',
            original_amount: t.currency === 'USD' ? `USD ${Number(t.amount).toLocaleString('es-AR')}` : undefined,
            type: t.type === 'income' ? 'ingreso' : 'gasto',
            status: t.status === 'percibido' ? (t.type === 'income' ? 'cobrado' : 'pagado') : 'pendiente',
            category: catName ?? '-',
            business: bizName ?? '-',
          }
        }),
      }
    }

    // ── get_cash_flow ───────────────────────────────────────────────────────
    if (name === 'get_cash_flow') {
      const { month, business_id } = input as { month: string; business_id?: number }
      const [year, m] = month.split('-')
      const dateFrom = `${month}-01`
      const daysInMonth = new Date(parseInt(year), parseInt(m), 0).getDate()
      const dateTo = `${year}-${m}-${String(daysInMonth).padStart(2, '0')}`

      let q = supabase
        .from('transactions')
        .select('date, description, amount, currency, exchange_rate, type, categories(name)')
        .eq('status', 'percibido')
        .lte('date', dateTo)
        .order('date')

      if (business_id) q = q.eq('business_id', business_id)

      type CfTx = { date: string; description: string; amount: number; currency: string | null; exchange_rate: number | null; type: string; categories: { name: string } | null }
      const { data: all } = await q
      const allTxs = (all ?? []) as unknown as CfTx[]
      const toARS = (t: CfTx) => txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate)

      const priorTxs = allTxs.filter(t => t.date < dateFrom)
      const periodTxs = allTxs.filter(t => t.date >= dateFrom)

      const openingBalance = priorTxs.reduce((s, t) => s + (t.type === 'income' ? toARS(t) : -toARS(t)), 0)
      const totalIn  = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + toARS(t), 0)
      const totalOut = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + toARS(t), 0)
      const closingBalance = openingBalance + totalIn - totalOut

      const catMap: Record<string, number> = {}
      for (const t of periodTxs) {
        const cat = (t.categories as { name: string } | null)?.name ?? 'Sin categoría'
        catMap[cat] = (catMap[cat] ?? 0) + (t.type === 'income' ? toARS(t) : -toARS(t))
      }

      const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      return {
        month,
        opening_balance: fmt(openingBalance),
        total_inflows: fmt(totalIn),
        total_outflows: fmt(totalOut),
        net_change: fmt(totalIn - totalOut),
        closing_balance: fmt(closingBalance),
        by_category: Object.entries(catMap)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .map(([category, net]) => ({ category, net: fmt(net) })),
      }
    }

    // ── get_income_statement ────────────────────────────────────────────────
    if (name === 'get_income_statement') {
      const { year, business_id } = input as { year: string; business_id?: number }

      let q = supabase
        .from('transactions')
        .select('date, amount, currency, exchange_rate, type')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date')

      if (business_id) q = q.eq('business_id', business_id)

      type IsRow = { date: string; amount: number | string; currency: string | null; exchange_rate: number | null; type: string }
      const { data: rows } = await q
      const txs = (rows ?? []) as unknown as IsRow[]

      const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      const monthly: Record<number, { income: number; expense: number }> = {}
      for (let i = 1; i <= 12; i++) monthly[i] = { income: 0, expense: 0 }

      for (const t of txs) {
        const m = parseInt(t.date.slice(5, 7))
        const ars = txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate)
        if (t.type === 'income') monthly[m].income += ars
        else monthly[m].expense += ars
      }

      const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      let totalIncome = 0, totalExpense = 0

      const months = Object.entries(monthly).map(([mStr, d]) => {
        totalIncome += d.income
        totalExpense += d.expense
        return {
          month: MONTHS[parseInt(mStr) - 1],
          income: fmt(d.income),
          expense: fmt(d.expense),
          net: fmt(d.income - d.expense),
          savings_rate: d.income > 0 ? `${((d.income - d.expense) / d.income * 100).toFixed(1)}%` : '—',
        }
      })

      return {
        year,
        months,
        totals: {
          income: fmt(totalIncome),
          expense: fmt(totalExpense),
          net: fmt(totalIncome - totalExpense),
          savings_rate: totalIncome > 0 ? `${((totalIncome - totalExpense) / totalIncome * 100).toFixed(1)}%` : '—',
        },
      }
    }

    // ── get_budget_vs_actuals ───────────────────────────────────────────────
    if (name === 'get_budget_vs_actuals') {
      const { month, business_id } = input as { month: string; business_id?: number }
      const [year, m] = month.split('-')

      let bq = supabase
        .from('budgets')
        .select('amount_ars, category_id, categories(name)')
        .eq('year', parseInt(year))
        .eq('month', parseInt(m))
      if (business_id) bq = bq.eq('business_id', business_id)

      let tq = supabase
        .from('transactions')
        .select('amount, currency, exchange_rate, category_id, categories(name)')
        .eq('type', 'expense')
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`)
      if (business_id) tq = tq.eq('business_id', business_id)

      const [{ data: budgets }, { data: actuals }] = await Promise.all([bq, tq])

      type BudgetRow = { amount_ars: number | string; category_id: number; categories: { name: string } | null }
      type ActualRow = { amount: number | string; currency: string | null; exchange_rate: number | null; category_id: number; categories: { name: string } | null }

      const budgetMap: Record<string, number> = {}
      for (const b of (budgets ?? []) as unknown as BudgetRow[]) {
        const cat = (b.categories as { name: string } | null)?.name ?? `cat_${b.category_id}`
        budgetMap[cat] = Number(b.amount_ars)
      }

      const actualMap: Record<string, number> = {}
      for (const t of (actuals ?? []) as unknown as ActualRow[]) {
        const cat = (t.categories as { name: string } | null)?.name ?? `cat_${t.category_id}`
        actualMap[cat] = (actualMap[cat] ?? 0) + txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate)
      }

      const allCats = Array.from(new Set([...Object.keys(budgetMap), ...Object.keys(actualMap)]))
      const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

      const rows = allCats.map(cat => {
        const budget = budgetMap[cat] ?? 0
        const actual = actualMap[cat] ?? 0
        return {
          category: cat,
          budget: fmt(budget),
          actual: fmt(actual),
          variance: fmt(budget - actual),
          execution_pct: budget > 0 ? `${(actual / budget * 100).toFixed(1)}%` : '—',
          status: actual > budget ? '🔴 sobre presupuesto' : actual > budget * 0.8 ? '🟡 cerca del límite' : '✅ ok',
        }
      }).sort((a, b) => (actualMap[b.category] ?? 0) - (actualMap[a.category] ?? 0))

      const totalBudget = allCats.reduce((s, c) => s + (budgetMap[c] ?? 0), 0)
      const totalActual = allCats.reduce((s, c) => s + (actualMap[c] ?? 0), 0)

      return {
        month,
        categories: rows,
        totals: {
          budget: fmt(totalBudget),
          actual: fmt(totalActual),
          variance: fmt(totalBudget - totalActual),
          execution_pct: totalBudget > 0 ? `${(totalActual / totalBudget * 100).toFixed(1)}%` : '—',
        },
      }
    }

    return { error: `Herramienta desconocida: ${name}` }
  } catch (e) {
    return { error: `Error ejecutando ${name}: ${(e as Error).message}` }
  }
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    // Usar API key separada para el chat si está configurada
    const apiKey = process.env.ANTHROPIC_AI_CHAT_KEY ?? process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    const supabase = await createClient()

    // ── Settings + FX ────────────────────────────────────────────────────────
    const [{ data: settings }, { rateType: fxRateType }] = await Promise.all([
      supabase.from('settings').select('*'),
      getReportFxSettings(),
    ])
    const sMap: Record<string, string> = {}
    for (const s of settings ?? []) sMap[s.key] = s.value ?? ''
    const fallbackRate = parseFloat(sMap.current_rate) || 1

    // ── Current month ────────────────────────────────────────────────────────
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const [
      { data: transactions },
      { data: categories },
      { data: businesses },
      burn3,
      burn6,
      burn12,
      runway,
      balance,
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('date, description, amount, type, status, currency, exchange_rate, categories(name), businesses(name)')
        .order('date', { ascending: false })
        .limit(300),
      supabase.from('categories').select('name, type'),
      supabase.from('businesses').select('name'),
      getBurnRate(null, 3, fxRateType),
      getBurnRate(null, 6, fxRateType),
      getBurnRate(null, 12, fxRateType),
      getRunway(null),
      getConsolidatedBalanceSheet(currentMonth),
    ])

    const ratios = balance ? await calculateBalanceRatios(balance) : null

    // ── Build context ────────────────────────────────────────────────────────
    const txs = (transactions ?? []) as unknown as TxFull[]
    const toARS = (t: TxFull) => txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate)
    const fmt   = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
    const fmtUSD = (n: number | null) => n !== null ? `USD ${Math.round(n).toLocaleString('en-US')}` : '—'

    const totalIncome  = txs.filter(t => t.type === 'income').reduce((s, t) => s + toARS(t), 0)
    const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + toARS(t), 0)
    const pendingCount = txs.filter(t => t.status === 'devengado').length
    const paidCount    = txs.filter(t => t.status === 'percibido').length

    const monthly: Record<string, { income: number; expense: number }> = {}
    for (const t of txs) {
      const m = t.date.slice(0, 7)
      if (!monthly[m]) monthly[m] = { income: 0, expense: 0 }
      if (t.type === 'income') monthly[m].income += toARS(t)
      else monthly[m].expense += toARS(t)
    }

    const byCat: Record<string, { income: number; expense: number }> = {}
    for (const t of txs) {
      const cat = Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name: string } | null)?.name
      const name = cat ?? 'Sin categoría'
      if (!byCat[name]) byCat[name] = { income: 0, expense: 0 }
      if (t.type === 'income') byCat[name].income += toARS(t)
      else byCat[name].expense += toARS(t)
    }

    const byBiz: Record<string, { income: number; expense: number }> = {}
    for (const t of txs) {
      const biz = Array.isArray(t.businesses) ? t.businesses[0]?.name : (t.businesses as { name: string } | null)?.name
      const name = biz ?? 'Sin empresa'
      if (!byBiz[name]) byBiz[name] = { income: 0, expense: 0 }
      if (t.type === 'income') byBiz[name].income += toARS(t)
      else byBiz[name].expense += toARS(t)
    }

    // Quick cash flow summary for current month (percibido only)
    const cfTxs = txs.filter(t => t.status === 'percibido' && t.date.startsWith(currentMonth))
    const cfIn  = cfTxs.filter(t => t.type === 'income').reduce((s, t) => s + toARS(t), 0)
    const cfOut = cfTxs.filter(t => t.type === 'expense').reduce((s, t) => s + toARS(t), 0)

    const dataCtx = `
DATOS FINANCIEROS (últimas ${txs.length} transacciones en contexto):

Resumen general:
- Total ingresos: ${fmt(totalIncome)}
- Total gastos: ${fmt(totalExpense)}
- Resultado neto: ${fmt(totalIncome - totalExpense)}
- Pendientes/devengados: ${pendingCount} | Cobrados/pagados: ${paidCount}
- TC actual: ${sMap.current_rate || 'no configurado'} ARS/USD (${sMap.rate_type || '-'})
- Mes actual: ${currentMonth}

BURN RATE (promedio mensual de gastos — meses completos anteriores):
- Últimos 3m: ${fmt(burn3.ars)} ARS / ${fmtUSD(burn3.usd)}
- Últimos 6m: ${fmt(burn6.ars)} ARS / ${fmtUSD(burn6.usd)}
- Últimos 12m: ${fmt(burn12.ars)} ARS / ${fmtUSD(burn12.usd)}

RUNWAY:
- Caja registrada: ${fmt(runway.cashArs)}
- Runway estimado: ${runway.months !== null ? `${runway.months.toFixed(1)} meses` : 'Sin datos (registrá posición de caja en Configuración → Posición de Caja)'}

BALANCE SHEET (${currentMonth}):${balance ? `
- Activos corrientes: ${fmt(balance.assets.current.subtotal)} (caja: ${fmt(balance.assets.current.cash)} | CxC: ${fmt(balance.assets.current.receivables)})
- Pasivos corrientes: ${fmt(balance.liabilities.current.subtotal)}
- Patrimonio neto: ${fmt(balance.equity.total)} (ganancias retenidas: ${fmt(balance.equity.retainedEarnings)})
- Balance cuadra: ${balance.isBalanced ? 'Sí ✓' : `No ✗ (diferencia ${fmt(balance.balanceDifference)})`}` : '\n- No disponible'}

RATIOS FINANCIEROS:${ratios ? `
- Liquidez corriente: ${ratios.currentRatio.toFixed(2)} (saludable >1.5, riesgo <1.0)
- Deuda/Patrimonio: ${ratios.debtToEquity.toFixed(2)}
- Ratio de deuda: ${(ratios.debtRatio * 100).toFixed(1)}%
- Estado general: ${ratios.status === 'healthy' ? 'Saludable ✅' : ratios.status === 'caution' ? 'Precaución ⚠️' : 'Riesgo 🔴'}` : '\n- No disponibles'}

CASH FLOW MES ACTUAL (${currentMonth}, solo efectivo percibido):
- Entradas del mes: ${fmt(cfIn)}
- Salidas del mes: ${fmt(cfOut)}
- Flujo neto: ${fmt(cfIn - cfOut)}

Por mes (últimos 6 meses):
${Object.entries(monthly).sort().reverse().slice(0, 6).map(([m, d]) =>
  `  ${m}: Ing ${fmt(d.income)} | Gast ${fmt(d.expense)} | Neto ${fmt(d.income - d.expense)}`
).join('\n')}

Por categoría (top gastos):
${Object.entries(byCat).sort((a, b) => b[1].expense - a[1].expense).slice(0, 10).map(([name, d]) =>
  `  ${name}: Gast ${fmt(d.expense)}${d.income > 0 ? ` | Ing ${fmt(d.income)}` : ''}`
).join('\n')}

Por empresa:
${Object.entries(byBiz).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).map(([name, d]) =>
  `  ${name}: Ing ${fmt(d.income)} | Gast ${fmt(d.expense)}`
).join('\n')}

Categorías disponibles: ${(categories ?? []).map(c => `${c.name} (${c.type})`).join(', ')}
Empresas: ${(businesses ?? []).map(b => b.name).join(', ')}

Todas las transacciones (${txs.length}, de más reciente a más antigua):
${txs.map(t => {
  const catName = Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name: string } | null)?.name
  const bizName = Array.isArray(t.businesses) ? t.businesses[0]?.name : (t.businesses as { name: string } | null)?.name
  const arsAmt = toARS(t)
  const currTag = t.currency === 'USD' ? ` (USD ${Number(t.amount).toLocaleString('es-AR')} × TC ${t.exchange_rate ?? fallbackRate})` : ''
  return `  ${t.date} | ${t.description} | ${fmt(arsAmt)}${currTag} | ${t.type === 'income' ? 'ingreso' : 'gasto'} | ${t.status === 'percibido' ? (t.type === 'income' ? 'cobrado' : 'pagado') : 'pendiente'} | ${catName ?? '-'} | ${bizName ?? '-'}`
}).join('\n')}
`

    const systemPrompt = `Sos un asistente financiero inteligente para "Grupo Lubrano", un sistema de gestión financiera familiar argentino.

Tu trabajo:
1. Responder preguntas sobre datos financieros con precisión y profundidad
2. Analizar burn rate, runway, flujo de caja, ratios financieros y tendencias
3. Dar recomendaciones accionables basadas en datos reales
4. Usar herramientas cuando el usuario pida datos de períodos específicos no cubiertos en el contexto

HERRAMIENTAS DISPONIBLES:
- search_transactions: para buscar por proveedor específico, concepto o período
- get_cash_flow: para analizar flujo de caja real (percibido) de un mes
- get_income_statement: para el P&L mensual de un año completo
- get_budget_vs_actuals: para comparar presupuesto vs gastos reales

REGLA CRÍTICA — USO DE HERRAMIENTAS:
Ante CUALQUIER pregunta que implique comparar períodos, ver tendencias, analizar meses pasados o resultados históricos (ej: "últimos 3 meses", "cómo fue enero", "comparar meses", "tendencia", "evolución", "año pasado", etc.), SIEMPRE llamá get_income_statement PRIMERO antes de responder. No uses los datos del contexto estático para este tipo de preguntas — los datos del contexto pueden estar incompletos si hay más de 300 transacciones. get_income_statement devuelve datos completos sin límite para cualquier año.

REGLAS:
- Respondé SIEMPRE en español argentino (vos, tenés, etc.)
- Sé conciso pero completo; usá tablas o listas cuando ayuden
- Usá números formateados ($X.XXX.XXX)
- NO inventes datos; si faltan datos, decilo y sugerí cómo obtenerlos
- Podés usar emojis moderadamente (📊 💰 📈 📉 ⚠️)

FUNCIONALIDADES DE LA APP:
- Dashboard: KPIs del período, burn rate, runway, MoM %
- Transacciones: ver todas, agregar manual, OCR (foto de ticket), importar CSV/PDF
- Reportes: Flujo de Caja (percibido), Estado de Resultados (anual), Balance
- Presupuesto (/budgets): budget vs actuals por categoría + plantillas
- Configuración: categorías, tipo de cambio (dólar en vivo), posición de caja para runway

${dataCtx}`

    // ── Agentic tool loop ────────────────────────────────────────────────────
    async function callClaude(msgs: AnthropicMsg[]) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2048,
          system: systemPrompt,
          tools: AI_TOOLS,
          messages: msgs,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`API error (${res.status}): ${err}`)
      }

      return res.json()
    }

    let convMsgs: AnthropicMsg[] = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))

    let response = await callClaude(convMsgs)

    // Tool use loop — max 5 iterations
    let iterations = 0
    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++

      const toolUses = (response.content as AnthropicBlock[]).filter(b => b.type === 'tool_use')
      const toolResults = await Promise.all(
        toolUses.map(async tu => {
          const result = await executeTool(tu.name!, tu.input ?? {}, supabase, fallbackRate)
          return { type: 'tool_result' as const, tool_use_id: tu.id!, content: JSON.stringify(result) }
        })
      )

      convMsgs = [
        ...convMsgs,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ]

      response = await callClaude(convMsgs)
    }

    const textBlock = (response.content as AnthropicBlock[])?.find(b => b.type === 'text')

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
