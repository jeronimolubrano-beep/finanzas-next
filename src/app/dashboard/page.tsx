import { createClient } from '@/lib/supabase/server'
import { KPICard } from '@/components/KPICard'
import { DashboardCharts } from './DashboardCharts'
import { formatMoney, formatMoney0, getCurrentYear, daysUntilDue } from '@/lib/utils'
import Link from 'next/link'
import { AlertTriangle, Clock } from 'lucide-react'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ business_id?: string; period?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const now = new Date()
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

  // Query transacciones del periodo con fecha y categoria
  let query = supabase
    .from('transactions')
    .select('date, type, amount, status, category_id, categories(name)')
    .gte('date', dateFrom)
    .order('date')

  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }

  const { data: txs } = await query
  const allTxs = txs ?? []

  // KPIs principales
  const income = allTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = allTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = income - expense
  const savingsRate = income > 0 ? (net / income * 100) : 0

  // Cuentas a cobrar / pagar (devengados, sin filtro de fecha)
  let devQuery = supabase.from('transactions').select('type, amount').eq('status', 'devengado')
  if (params.business_id) devQuery = devQuery.eq('business_id', parseInt(params.business_id))
  const { data: devengados } = await devQuery
  const ctasCobrar = (devengados ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const ctasPagar = (devengados ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // Top categoria de gasto
  const catTotals: Record<string, number> = {}
  const catNames: Record<string, string> = {}
  for (const t of allTxs.filter(t => t.type === 'expense')) {
    const cid = String(t.category_id)
    catTotals[cid] = (catTotals[cid] || 0) + Number(t.amount)
    if (t.categories) catNames[cid] = (t.categories as unknown as { name: string }).name
  }
  const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  const topExpenseCat = topCatId ? catNames[topCatId[0]] || '—' : '—'
  const topExpenseTotal = topCatId ? topCatId[1] : 0

  // YTD
  let ytdQuery = supabase.from('transactions').select('type, amount').gte('date', `${currentYear}-01-01`)
  if (params.business_id) ytdQuery = ytdQuery.eq('business_id', parseInt(params.business_id))
  const { data: ytdTxs } = await ytdQuery
  const ytdNet =
    (ytdTxs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) -
    (ytdTxs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // ── Datos para gráficos ──────────────────────────────────────────────────

  // Agrupar por mes para el gráfico de barras
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const monthMap: Record<string, { ingresos: number; gastos: number }> = {}

  for (const t of allTxs) {
    const key = t.date.slice(0, 7) // YYYY-MM
    if (!monthMap[key]) monthMap[key] = { ingresos: 0, gastos: 0 }
    if (t.type === 'income') monthMap[key].ingresos += Number(t.amount)
    else monthMap[key].gastos += Number(t.amount)
  }

  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [y, m] = key.split('-')
      return {
        month: `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`,
        ingresos: val.ingresos,
        gastos: val.gastos,
        neto: val.ingresos - val.gastos,
      }
    })

  // Gastos por categoria para el pie chart
  const categoryData = Object.entries(catTotals)
    .map(([cid, total]) => ({ name: catNames[cid] || 'Sin cat.', value: total }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Tipo de cambio
  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const tcRate = parseFloat(settingsMap.current_rate) || 0
  const tcDate = settingsMap.rate_date || ''
  const tcType = settingsMap.rate_type || ''
  const hasTC = tcRate > 0

  function toUSD(ars: number): string {
    if (!hasTC) return ''
    return (ars / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  // Pagos pendientes para alertas (sin filtro de empresa ni período)
  const { data: pendingTxs } = await supabase
    .from('transactions')
    .select('id, type, amount, due_date, currency, exchange_rate')
    .eq('status', 'devengado')

  const allPending = pendingTxs ?? []
  const today = new Date().toISOString().slice(0, 10)
  const overdueItems = allPending.filter(t => t.due_date && t.due_date < today)
  const soonItems = allPending.filter(t =>
    t.due_date && t.due_date >= today && daysUntilDue(t.due_date) <= 7
  )

  const totalCobrar = allPending.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalPagar = allPending.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

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
        <form className="flex flex-wrap items-center gap-2">
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

      {/* Alertas de pagos urgentes */}
      {(overdueItems.length > 0 || soonItems.length > 0) && (
        <div className="space-y-2 mb-6">
          {overdueItems.length > 0 && (
            <Link href="/transactions/pending"
                  className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 hover:bg-red-100 transition">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-sm text-red-700 font-medium flex-1">
                Tenés {overdueItems.length} pago{overdueItems.length > 1 ? 's' : ''} vencido{overdueItems.length > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-red-500">Ver →</span>
            </Link>
          )}
          {soonItems.length > 0 && (
            <Link href="/transactions/pending"
                  className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 hover:bg-yellow-100 transition">
              <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
              <span className="text-sm text-yellow-700 font-medium flex-1">
                Tenés {soonItems.length} pago{soonItems.length > 1 ? 's' : ''} que vence{soonItems.length > 1 ? 'n' : ''} esta semana
              </span>
              <span className="text-xs text-yellow-500">Ver →</span>
            </Link>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <KPICard title="Ingresos" value={`$${formatMoney(income)}`} color="green"
                 usdValue={hasTC ? `$${toUSD(income)}` : undefined} />
        <KPICard title="Gastos" value={`$${formatMoney(expense)}`} color="red"
                 usdValue={hasTC ? `$${toUSD(expense)}` : undefined} />
        <KPICard title="Flujo neto" value={`${net >= 0 ? '+' : ''}$${formatMoney(net)}`}
                 color={net >= 0 ? 'green' : 'red'}
                 usdValue={hasTC ? `${net >= 0 ? '+' : ''}$${toUSD(Math.abs(net))}` : undefined} />
        <KPICard title="Tasa ahorro" value={`${savingsRate.toFixed(1)}%`}
                 color={savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'yellow' : 'red'} />
        <KPICard title="Mayor gasto" value={topExpenseCat}
                 subtitle={`$${formatMoney(topExpenseTotal)}`} color="purple"
                 usdValue={hasTC ? `$${toUSD(topExpenseTotal)}` : undefined} />
        <KPICard title="YTD Neto" value={`${ytdNet >= 0 ? '+' : ''}$${formatMoney0(ytdNet)}`}
                 subtitle={currentYear} color={ytdNet >= 0 ? 'cyan' : 'red'}
                 usdValue={hasTC ? `${ytdNet >= 0 ? '+' : ''}$${toUSD(Math.abs(ytdNet))}` : undefined} />
      </div>

      {/* TC del día + Pendientes */}
      <div className={`grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 ${hasTC ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {hasTC && (
          <KPICard title={`TC ${tcType}`} value={`$${tcRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                   subtitle={`Actualizado: ${tcDate}`} color="blue" />
        )}
        <KPICard title="Total a cobrar" value={`$${formatMoney(totalCobrar)}`}
                 subtitle={`${allPending.filter(t => t.type === 'income').length} pendiente(s)`}
                 color="yellow"
                 usdValue={hasTC ? `$${toUSD(totalCobrar)}` : undefined} />
        <KPICard title="Total a pagar" value={`$${formatMoney(totalPagar)}`}
                 subtitle={`${allPending.filter(t => t.type === 'expense').length} pendiente(s)`}
                 color="orange"
                 usdValue={hasTC ? `$${toUSD(totalPagar)}` : undefined} />
      </div>


      {/* Gráficos */}
      <DashboardCharts monthlyData={monthlyData} categoryData={categoryData} />
    </div>
  )
}
