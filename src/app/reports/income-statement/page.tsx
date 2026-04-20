import { createClient } from '@/lib/supabase/server'
import { formatMoney0 } from '@/lib/utils'
import { DollarSign } from 'lucide-react'
import { TaxSection, type CategoryBreakdown } from './TaxSection'
import { getReportFxSettings, getMonthlyRates, arsToUsd, fmtUsd } from '@/lib/fx'
import { InlineFxLoader } from '@/components/InlineFxLoader'

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; business_id?: string; sort?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const currentYear = new Date().getFullYear()
  const selectedYear = parseInt(params.year || String(currentYear))

  let query = supabase
    .from('transactions')
    .select('date, type, amount, iva_rate, categories(name, type)')
    .gte('date', `${selectedYear}-01-01`)
    .lte('date', `${selectedYear}-12-31`)

  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }

  const { data: transactions } = await query

  type TxRow = {
    date: string
    type: string
    amount: number | string
    iva_rate: number | null
    categories: { name: string; type: string } | null
  }
  const txs = (transactions ?? []) as unknown as TxRow[]

  // Build category breakdown for tax modal with IVA tracking
  const catMap: Record<string, CategoryBreakdown & { ivaByRate: Record<number, number> }> = {}
  for (const t of txs) {
    const name = t.categories?.name ?? 'Sin categoría'
    const catType = (t.categories?.type ?? 'expense') as 'income' | 'expense'
    if (!catMap[name]) {
      catMap[name] = { name, catType, income: 0, expense: 0, ivaByRate: {} }
    }
    if (t.type === 'income') {
      catMap[name].income += Number(t.amount)
    } else {
      catMap[name].expense += Number(t.amount)
      if (t.iva_rate && t.iva_rate > 0) {
        const ivaAmount = Number(t.amount) * (t.iva_rate / 100)
        if (!catMap[name].ivaByRate[t.iva_rate]) catMap[name].ivaByRate[t.iva_rate] = 0
        catMap[name].ivaByRate[t.iva_rate] += ivaAmount
      }
    }
  }
  const categoryBreakdown = Object.values(catMap)
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  type MonthData = { income: number; expense: number; net: number; savingsRate: number }
  const monthlyData: MonthData[] = months.map(m => {
    const monthStr = String(m).padStart(2, '0')
    const monthTxs = txs.filter((t: TxRow) => t.date.startsWith(`${selectedYear}-${monthStr}`))
    const income  = monthTxs.filter((t: TxRow) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = monthTxs.filter((t: TxRow) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const net = income - expense
    return { income, expense, net, savingsRate: income > 0 ? (net / income * 100) : 0 }
  })

  const totalIncome  = monthlyData.reduce((s, m) => s + m.income,  0)
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0)
  const totalNet     = totalIncome - totalExpense
  const totalSavingsRate = totalIncome > 0 ? (totalNet / totalIncome * 100) : 0
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // ── Report FX (per-month historical rates) ────────────────────────────────
  const { usdMode, rateType: fxRateType } = await getReportFxSettings()
  let fxRates: Map<number, number> = new Map()
  if (usdMode) {
    fxRates = await getMonthlyRates(selectedYear, months, fxRateType, 'avg')
  }

  // Per-month USD values
  const monthlyUSD = monthlyData.map((m, i) => {
    const rate = fxRates.get(i + 1) ?? null
    return {
      income:  arsToUsd(m.income,  rate),
      expense: arsToUsd(m.expense, rate),
      net:     arsToUsd(m.net,     rate),
    }
  })

  const sumUSD = (vals: (number | null)[]): number | null => {
    const defined = vals.filter((v): v is number => v !== null)
    return defined.length > 0 ? defined.reduce((a, b) => a + b, 0) : null
  }
  const totalIncomeUSD  = sumUSD(monthlyUSD.map(m => m.income))
  const totalExpenseUSD = sumUSD(monthlyUSD.map(m => m.expense))
  const totalNetUSD     = sumUSD(monthlyUSD.map(m => m.net))
  const noFxData        = usdMode && fxRates.size === 0

  const sortParam = params.sort ?? 'date_asc'
  const monthsWithData = months.map((m, i) => ({
    num: m,
    name: monthNames[i],
    data: monthlyData[i],
    usd: monthlyUSD[i],
  }))
  if (sortParam === 'date_desc') monthsWithData.reverse()
  else if (sortParam === 'amount_desc') monthsWithData.sort((a, b) => b.data.net - a.data.net)
  else if (sortParam === 'amount_asc') monthsWithData.sort((a, b) => a.data.net - b.data.net)

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Estado de Resultados</h1>
          <p className="text-sm" style={{ color: '#8b8ec0' }}>Año {selectedYear}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <select name="year" defaultValue={selectedYear}
                  className="rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="business_id" defaultValue={params.business_id ?? ''}
                  className="rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
            <option value="">Todas las empresas</option>
            {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select name="sort" defaultValue={sortParam}
                  className="rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
            <option value="date_asc">Ene → Dic</option>
            <option value="date_desc">Dic → Ene</option>
            <option value="amount_desc">Mayor resultado primero</option>
            <option value="amount_asc">Menor resultado primero</option>
          </select>
          <button type="submit"
                  className="text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
                  style={{ background: '#6439ff' }}>
            Filtrar
          </button>
        </form>
      </div>

      {/* USD mode banner */}
      {usdMode && !noFxData && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm"
             style={{ background: 'rgba(100,57,255,0.05)', borderColor: 'rgba(100,57,255,0.2)', color: '#6439ff' }}>
          <DollarSign className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Modo USD activo</span>
          <span className="text-xs" style={{ color: '#8b8ec0' }}>
            · TC {fxRateType === 'blue' ? 'Blue' : 'Oficial'} promedio por mes · Los meses sin TC muestran —
          </span>
        </div>
      )}

      {/* InlineFxLoader: shown when usdMode=on but no rates in DB for this year */}
      {noFxData && (
        <div className="mb-4">
          <InlineFxLoader
            period={String(selectedYear)}
            rateType={fxRateType}
            label={`${selectedYear}`}
          />
        </div>
      )}

      {/* Tabla anual */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f4f4ff' }}>
                <th className="px-4 py-3 text-left sticky left-0 z-10 text-xs font-semibold uppercase"
                    style={{ background: '#f4f4ff', color: '#8b8ec0' }}>Concepto</th>
                {monthsWithData.map(m => (
                  <th key={m.num} className="px-3 py-3 text-right min-w-[90px] text-xs font-semibold uppercase"
                      style={{ color: '#8b8ec0' }}>{m.name}</th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase"
                    style={{ background: '#f0f0f8', color: '#8b8ec0' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* ARS rows */}
              <tr style={{ background: 'rgba(46,219,193,0.03)' }}>
                <td className="px-4 py-3 font-semibold text-[#2edbc1] sticky left-0 z-10"
                    style={{ background: 'rgba(46,219,193,0.03)' }}>Total Ingresos</td>
                {monthsWithData.map(m => (
                  <td key={m.num} className="px-3 py-3 text-right font-medium text-[#2edbc1]">
                    {m.data.income > 0 ? `$${formatMoney0(m.data.income)}` : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-[#2edbc1]"
                    style={{ background: 'rgba(46,219,193,0.05)' }}>
                  ${formatMoney0(totalIncome)}
                </td>
              </tr>

              <tr style={{ background: 'rgba(254,73,98,0.03)' }}>
                <td className="px-4 py-3 font-semibold text-[#fe4962] sticky left-0 z-10"
                    style={{ background: 'rgba(254,73,98,0.03)' }}>Total Gastos</td>
                {monthsWithData.map(m => (
                  <td key={m.num} className="px-3 py-3 text-right font-medium text-[#fe4962]">
                    {m.data.expense > 0 ? `$${formatMoney0(m.data.expense)}` : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-[#fe4962]"
                    style={{ background: 'rgba(254,73,98,0.05)' }}>
                  ${formatMoney0(totalExpense)}
                </td>
              </tr>

              <tr style={{ borderBottom: '2px solid #e8e8f0' }}>
                <td className="px-4 py-3 font-bold sticky left-0 z-10" style={{ color: 'var(--navy)' }}>
                  Resultado Neto
                </td>
                {monthsWithData.map(m => (
                  <td key={m.num}
                      className={`px-3 py-3 text-right font-bold ${m.data.net >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                    {(m.data.income > 0 || m.data.expense > 0)
                      ? `${m.data.net >= 0 ? '+' : ''}$${formatMoney0(m.data.net)}`
                      : '—'}
                  </td>
                ))}
                <td className={`px-4 py-3 text-right font-bold ${totalNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}
                    style={{ background: '#f4f4ff' }}>
                  {totalNet >= 0 ? '+' : ''}${formatMoney0(totalNet)}
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-medium sticky left-0 z-10" style={{ color: '#8b8ec0' }}>
                  Tasa de Ahorro
                </td>
                {monthsWithData.map(m => {
                  const color = m.data.savingsRate >= 20 ? '#2edbc1' : m.data.savingsRate >= 0 ? '#f59e0b' : '#fe4962'
                  return (
                    <td key={m.num} className="px-3 py-3 text-right text-sm" style={{ color }}>
                      {m.data.income > 0 ? `${m.data.savingsRate.toFixed(0)}%` : '—'}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right font-bold"
                    style={{ background: '#f4f4ff', color: totalSavingsRate >= 20 ? '#2edbc1' : totalSavingsRate >= 0 ? '#f59e0b' : '#fe4962' }}>
                  {totalSavingsRate.toFixed(1)}%
                </td>
              </tr>

              {/* USD rows — only when usdMode is on and we have at least some data */}
              {usdMode && !noFxData && (
                <>
                  <tr style={{ background: '#fafafe', borderTop: '2px solid #e8e8f0' }}>
                    <td colSpan={monthsWithData.length + 2}
                        className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#6439ff' }}>
                      En USD · TC promedio mensual ({fxRateType === 'blue' ? 'Blue' : 'Oficial'})
                    </td>
                  </tr>
                  <tr style={{ background: 'rgba(46,219,193,0.02)' }}>
                    <td className="px-4 py-2 text-xs font-medium sticky left-0 z-10"
                        style={{ color: '#2edbc1', background: 'rgba(46,219,193,0.02)' }}>
                      Ingresos USD
                    </td>
                    {monthsWithData.map(m => (
                      <td key={m.num} className="px-3 py-2 text-right text-xs font-medium text-[#2edbc1]">
                        {m.usd.income !== null ? fmtUsd(m.usd.income) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-xs font-bold text-[#2edbc1]"
                        style={{ background: 'rgba(46,219,193,0.04)' }}>
                      {totalIncomeUSD !== null ? fmtUsd(totalIncomeUSD) : '—'}
                    </td>
                  </tr>
                  <tr style={{ background: 'rgba(254,73,98,0.02)' }}>
                    <td className="px-4 py-2 text-xs font-medium sticky left-0 z-10"
                        style={{ color: '#fe4962', background: 'rgba(254,73,98,0.02)' }}>
                      Gastos USD
                    </td>
                    {monthsWithData.map(m => (
                      <td key={m.num} className="px-3 py-2 text-right text-xs font-medium text-[#fe4962]">
                        {m.usd.expense !== null ? fmtUsd(m.usd.expense) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-xs font-bold text-[#fe4962]"
                        style={{ background: 'rgba(254,73,98,0.04)' }}>
                      {totalExpenseUSD !== null ? fmtUsd(totalExpenseUSD) : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-xs font-bold sticky left-0 z-10" style={{ color: 'var(--navy)' }}>
                      Neto USD
                    </td>
                    {monthsWithData.map(m => (
                      <td key={m.num}
                          className={`px-3 py-2 text-right text-xs font-bold ${m.usd.net !== null && m.usd.net >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                        {m.usd.net !== null
                          ? `${m.usd.net >= 0 ? '+' : ''}${fmtUsd(m.usd.net)}`
                          : '—'}
                      </td>
                    ))}
                    <td className={`px-4 py-2 text-right text-xs font-bold ${totalNetUSD !== null && totalNetUSD >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}
                        style={{ background: '#f4f4ff' }}>
                      {totalNetUSD !== null
                        ? `${totalNetUSD >= 0 ? '+' : ''}${fmtUsd(totalNetUSD)}`
                        : '—'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección de impuestos */}
      <TaxSection
        totalNet={totalNet}
        categoryBreakdown={categoryBreakdown}
        selectedYear={selectedYear}
      />

      {/* Resumen anual */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: `Ingresos ${selectedYear}`, value: totalIncome,  usd: totalIncomeUSD,  color: '#2edbc1' },
          { label: `Gastos ${selectedYear}`,   value: totalExpense, usd: totalExpenseUSD, color: '#fe4962' },
          { label: 'Resultado Neto',           value: totalNet,     usd: totalNetUSD,     color: totalNet  >= 0 ? '#2edbc1' : '#fe4962' },
          { label: 'Tasa de Ahorro',           value: null,         usd: null,            color: totalSavingsRate >= 20 ? '#2edbc1' : totalSavingsRate >= 0 ? '#f59e0b' : '#fe4962' },
        ].map(({ label, value, usd, color }) => (
          <div key={label} className="rounded-xl border p-4 text-center"
               style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
            <p className="text-xs uppercase mb-1" style={{ color: '#8b8ec0' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color }}>
              {value !== null
                ? `${value >= 0 && label.startsWith('Resultado') ? '+' : ''}$${formatMoney0(value)}`
                : `${totalSavingsRate.toFixed(1)}%`}
            </p>
            {usdMode && usd !== null && (
              <p className="text-xs mt-0.5 font-medium" style={{ color: '#8b8ec0' }}>
                {fmtUsd(usd)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
