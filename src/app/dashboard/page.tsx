import { createClient } from '@/lib/supabase/server'
import { KPICard } from '@/components/KPICard'
import { DashboardCharts } from './DashboardCharts'
import { DashboardTabs } from './DashboardTabs'
import { DuePaymentsModal } from '@/components/dashboard/DuePaymentsModal'
import { formatMoney, getCurrentYear, daysUntilDue, getPaymentsDueToday, txToARS } from '@/lib/utils'
import Link from 'next/link'
import { AlertTriangle, Clock, BarChart3 } from 'lucide-react'
import { getReportFxSettings, getMonthlyRate } from '@/lib/fx'
import { getBurnRate, getRunway } from '@/lib/metrics'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ business_id?: string; period?: string; tab?: string }>
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

  // Fetch TC fallback antes del query principal
  const { data: settingsRaw } = await supabase.from('settings').select('*')
  const settingsMapEarly: Record<string, string> = {}
  for (const s of settingsRaw ?? []) settingsMapEarly[s.key] = s.value ?? ''
  const fallbackRate = parseFloat(settingsMapEarly.current_rate) || 1

  // Query transacciones del periodo con fecha y categoria
  let query = supabase
    .from('transactions')
    .select('date, type, amount, currency, exchange_rate, status, category_id, categories(name)')
    .gte('date', dateFrom)
    .order('date')

  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }

  const { data: txs } = await query
  const allTxs = txs ?? []

  // Helper para convertir a ARS usando TC de la transacción o fallback
  const toARS = (t: { amount: number | string; currency?: string | null; exchange_rate?: number | null }) =>
    txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate)

  // KPIs principales
  const income = allTxs.filter(t => t.type === 'income').reduce((s, t) => s + toARS(t), 0)
  const expense = allTxs.filter(t => t.type === 'expense').reduce((s, t) => s + toARS(t), 0)
  const net = income - expense
  const savingsRate = income > 0 ? (net / income * 100) : 0

  // Top categoria de gasto
  const catTotals: Record<string, number> = {}
  const catNames: Record<string, string> = {}
  for (const t of allTxs.filter(t => t.type === 'expense')) {
    const cid = String(t.category_id)
    catTotals[cid] = (catTotals[cid] || 0) + toARS(t)
    if (t.categories) catNames[cid] = (t.categories as unknown as { name: string }).name
  }
  const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  const topExpenseCat = topCatId ? catNames[topCatId[0]] || '—' : '—'
  const topExpenseTotal = topCatId ? topCatId[1] : 0

  // ── Datos para gráficos ──────────────────────────────────────────────────

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const monthMap: Record<string, { ingresos: number; gastos: number }> = {}

  for (const t of allTxs) {
    const key = t.date.slice(0, 7)
    if (!monthMap[key]) monthMap[key] = { ingresos: 0, gastos: 0 }
    if (t.type === 'income') monthMap[key].ingresos += toARS(t)
    else monthMap[key].gastos += toARS(t)
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

  const categoryData = Object.entries(catTotals)
    .map(([cid, total]) => ({ name: catNames[cid] || 'Sin cat.', value: total }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Tipo de cambio (reusa el fetch de settings de arriba)
  const tcRate = parseFloat(settingsMapEarly.current_rate) || 0
  const tcDate = settingsMapEarly.rate_date || ''
  const tcType = settingsMapEarly.rate_type || ''
  const hasTC = tcRate > 0

  // ── Report FX settings (historical USD mode) ───────────────────────────────
  const { usdMode: fxUsdMode, rateType: fxRateType } = await getReportFxSettings()
  const fxCurrentRate = fxUsdMode
    ? await getMonthlyRate(now.getFullYear(), now.getMonth() + 1, fxRateType, 'avg')
    : null
  // Effective rate: prefer historical monthly rate when usdMode is on
  const effectiveTcRate = fxCurrentRate ?? tcRate
  const effectiveHasTC  = effectiveTcRate > 0

  function toUSD(ars: number): string {
    if (!effectiveHasTC) return ''
    return (ars / effectiveTcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  // Pagos pendientes para alertas y tabla
  const { data: pendingTxs } = await supabase
    .from('transactions')
    .select('id, type, amount, due_date, currency, exchange_rate, description, categories(name), businesses(name)')
    .eq('status', 'devengado')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPending: any[] = pendingTxs ?? []
  const today = new Date().toISOString().slice(0, 10)
  const overdueItems = allPending.filter(t => t.due_date && t.due_date < today)
  const soonItems = allPending.filter(t =>
    t.due_date && t.due_date >= today && daysUntilDue(t.due_date) <= 7
  )
  const paymentsDueToday = getPaymentsDueToday(allPending)

  const totalCobrar = allPending.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalPagar = allPending.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // ── MoM: compare with the same number of days in the previous month ─────────
  const todayDay = now.getDate()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth() - 1, todayDay)
  const prevDateFrom   = prevMonthStart.toISOString().slice(0, 10)
  const prevDateTo     = prevMonthEnd.toISOString().slice(0, 10)

  let priorQuery = supabase
    .from('transactions')
    .select('type, amount, currency, exchange_rate')
    .gte('date', prevDateFrom)
    .lte('date', prevDateTo)

  if (params.business_id) {
    priorQuery = priorQuery.eq('business_id', parseInt(params.business_id))
  }

  // ── Burn rate & runway ─────────────────────────────────────────────────────
  const businessId = params.business_id ? parseInt(params.business_id) : null

  const [
    { data: priorTxsData },
    burn3,
    burn6,
    burn12,
    runway,
  ] = await Promise.all([
    priorQuery,
    getBurnRate(businessId, 3,  fxRateType),
    getBurnRate(businessId, 6,  fxRateType),
    getBurnRate(businessId, 12, fxRateType),
    getRunway(businessId),
  ])

  const priorTxs = priorTxsData ?? []
  const priorIncome  = priorTxs.filter(t => t.type === 'income').reduce((s, t) => s + toARS(t), 0)
  const priorExpense = priorTxs.filter(t => t.type === 'expense').reduce((s, t) => s + toARS(t), 0)
  const priorNet     = priorIncome - priorExpense

  function calcDelta(current: number, prior: number, higherIsBetter: boolean) {
    if (prior === 0) return undefined
    const pct = ((current - prior) / Math.abs(prior)) * 100
    return { pct, isPositive: higherIsBetter ? pct >= 0 : pct <= 0 }
  }

  const momIncome   = calcDelta(income,  priorIncome,  true)
  const momExpense  = calcDelta(expense, priorExpense, false)
  const momNet      = calcDelta(net,     priorNet,     true)
  const momSavings  = calcDelta(savingsRate, priorIncome > 0 ? ((priorNet / priorIncome) * 100) : 0, true)

  // Empresas para filtro
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  const periodLabels: Record<string, string> = {
    '1m': 'Este mes', '3m': '3 meses', '6m': '6 meses', '12m': '12 meses',
    'ytd': `YTD (${currentYear})`,
  }

  return (
    <div style={{ background: 'var(--dash-bg)', width: '100vw', marginLeft: 'calc(50% - 50vw)', marginTop: '-24px', minHeight: '100vh', padding: '24px 16px' }}>
      {/* Modal de pagos vencidos */}
      {paymentsDueToday.length > 0 && (
        <DuePaymentsModal
          dueItems={paymentsDueToday}
          tcRate={tcRate}
          hasTC={hasTC}
        />
      )}

      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(100,57,255,0.2)' }}>
            <BarChart3 className="w-5 h-5" style={{ color: '#6439ff' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-xs" style={{ color: '#5b5c8c' }}>{periodLabels[period] || '12 meses'}</p>
          </div>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <select name="period" defaultValue={period}
                  className="rounded-lg px-3 py-1.5 text-sm border-0 text-white"
                  style={{ background: 'var(--dash-card)', color: 'var(--dash-text)' }}>
            <option value="1m">Este mes</option>
            <option value="3m">3 meses</option>
            <option value="6m">6 meses</option>
            <option value="12m">12 meses</option>
            <option value="ytd">YTD ({currentYear})</option>
          </select>
          <select name="business_id" defaultValue={params.business_id ?? ''}
                  className="rounded-lg px-3 py-1.5 text-sm border-0"
                  style={{ background: 'var(--dash-card)', color: 'var(--dash-text)' }}>
            <option value="">Todas las empresas</option>
            {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button type="submit" className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                  style={{ background: '#6439ff' }}>
            Filtrar
          </button>
        </form>
      </div>

      {/* Dashboard Component */}
      <DashboardTabs
        monthlyData={monthlyData}
        categoryData={categoryData}
        income={income}
        expense={expense}
        net={net}
        savingsRate={savingsRate}
        topExpenseCat={topExpenseCat}
        topExpenseTotal={topExpenseTotal}
        tcRate={effectiveTcRate}
        tcType={fxUsdMode ? `${fxRateType === 'blue' ? 'Blue' : 'Oficial'} (histórico)` : tcType}
        tcDate={tcDate}
        hasTC={effectiveHasTC}
        period={period}
        momIncome={momIncome}
        momExpense={momExpense}
        momNet={momNet}
        momSavings={momSavings}
        burn3={burn3}
        burn6={burn6}
        burn12={burn12}
        runway={runway}
      />
    </div>
  )
}
