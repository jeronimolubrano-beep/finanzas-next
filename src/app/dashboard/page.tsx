import { createClient } from '@/lib/supabase/server'
import { KPICard } from '@/components/KPICard'
import { formatMoney, formatMoney0, getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ business_id?: string; period?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const now = new Date()
  const currentMonth = getCurrentMonth()
  const currentYear = getCurrentYear()

  // Determinar rango de fechas segun periodo
  const period = params.period || '12m'
  let dateFrom: string

  if (period === 'ytd') {
    dateFrom = `${currentYear}-01-01`
  } else {
    const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[period] || 12
    const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    dateFrom = from.toISOString().slice(0, 10)
  }

  // Query transacciones del periodo
  let query = supabase
    .from('transactions')
    .select('type, amount, status')
    .gte('date', dateFrom)

  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }

  const { data: txs } = await query

  // KPIs
  const income = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = (txs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = income - expense
  const savingsRate = income > 0 ? (net / income * 100) : 0

  // Cuentas a cobrar / pagar (global, sin filtro de fecha)
  let devQuery = supabase.from('transactions').select('type, amount').eq('status', 'devengado')
  if (params.business_id) devQuery = devQuery.eq('business_id', parseInt(params.business_id))
  const { data: devengados } = await devQuery

  const ctasCobrar = (devengados ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const ctasPagar = (devengados ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // Top categoria de gasto
  let topQuery = supabase
    .from('transactions')
    .select('category_id, amount, categories(name)')
    .eq('type', 'expense')
    .gte('date', dateFrom)
  if (params.business_id) topQuery = topQuery.eq('business_id', parseInt(params.business_id))
  const { data: expTxs } = await topQuery

  const catTotals: Record<string, number> = {}
  const catNames: Record<string, string> = {}
  for (const t of expTxs ?? []) {
    const cid = String(t.category_id)
    catTotals[cid] = (catTotals[cid] || 0) + Number(t.amount)
    const cat = t.categories as { name: string } | { name: string }[] | null
    if (cat) catNames[cid] = Array.isArray(cat) ? cat[0]?.name : cat.name
  }
  const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  const topExpenseCat = topCatId ? catNames[topCatId[0]] || '—' : '—'
  const topExpenseTotal = topCatId ? topCatId[1] : 0

  // YTD
  let ytdQuery = supabase.from('transactions').select('type, amount').gte('date', `${currentYear}-01-01`)
  if (params.business_id) ytdQuery = ytdQuery.eq('business_id', parseInt(params.business_id))
  const { data: ytdTxs } = await ytdQuery
  const ytdIncome = (ytdTxs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const ytdExpense = (ytdTxs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const ytdNet = ytdIncome - ytdExpense

  // Empresas para filtro
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  const periodLabels: Record<string, string> = {
    '1m': 'Este mes', '3m': '3 meses', '6m': '6 meses', '12m': '12 meses',
    'ytd': `YTD (${currentYear})`,
  }

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard KPI</h1>
          <p className="text-sm text-gray-500">{periodLabels[period] || '12 meses'}</p>
        </div>
        <form className="flex items-center gap-2">
          <select name="period" defaultValue={period}
                  className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="1m">Este mes</option>
            <option value="3m">3 meses</option>
            <option value="6m">6 meses</option>
            <option value="12m">12 meses</option>
            <option value="ytd">YTD ({currentYear})</option>
          </select>
          <select name="business_id" defaultValue={params.business_id ?? ''}
                  className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="">Todas las empresas</option>
            {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button type="submit" className="bg-gray-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
            Filtrar
          </button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <KPICard title="Ingresos" value={`$${formatMoney(income)}`} color="green" />
        <KPICard title="Gastos" value={`$${formatMoney(expense)}`} color="red" />
        <KPICard title="Flujo neto" value={`${net >= 0 ? '+' : ''}$${formatMoney(net)}`}
                 color={net >= 0 ? 'green' : 'red'} />
        <KPICard title="Tasa ahorro" value={`${savingsRate.toFixed(1)}%`}
                 color={savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'yellow' : 'red'} />
        <KPICard title="Mayor gasto" value={topExpenseCat}
                 subtitle={`$${formatMoney(topExpenseTotal)}`} color="purple" />
        <KPICard title="YTD Neto" value={`${ytdNet >= 0 ? '+' : ''}$${formatMoney0(ytdNet)}`}
                 subtitle={currentYear} color={ytdNet >= 0 ? 'cyan' : 'red'} />
      </div>

      {/* Cuentas a cobrar / pagar */}
      {(ctasCobrar > 0 || ctasPagar > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <KPICard title="Cuentas a cobrar" value={`$${formatMoney(ctasCobrar)}`}
                   subtitle="Ingresos devengados pendientes" color="yellow" />
          <KPICard title="Cuentas a pagar" value={`$${formatMoney(ctasPagar)}`}
                   subtitle="Gastos devengados pendientes" color="orange" />
        </div>
      )}
    </div>
  )
}
