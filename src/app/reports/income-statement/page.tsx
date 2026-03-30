import { createClient } from '@/lib/supabase/server'
import { formatMoney0 } from '@/lib/utils'
import { DollarSign } from 'lucide-react'

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; business_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const currentYear = new Date().getFullYear()
  const selectedYear = parseInt(params.year || String(currentYear))

  let query = supabase
    .from('transactions')
    .select('date, type, amount')
    .gte('date', `${selectedYear}-01-01`)
    .lte('date', `${selectedYear}-12-31`)

  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }

  const { data: transactions } = await query
  const txs = transactions ?? []
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const tcRate = parseFloat(settingsMap.current_rate) || 0
  const tcDate = settingsMap.rate_date || ''
  const tcType = settingsMap.rate_type || ''
  const hasTC = tcRate > 0

  function toUSD(ars: number): string {
    return (ars / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  type MonthData = { income: number; expense: number; net: number; savingsRate: number }
  const monthlyData: MonthData[] = months.map(m => {
    const monthStr = String(m).padStart(2, '0')
    const monthTxs = txs.filter(t => t.date.startsWith(`${selectedYear}-${monthStr}`))
    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const net = income - expense
    const savingsRate = income > 0 ? (net / income * 100) : 0
    return { income, expense, net, savingsRate }
  })

  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0)
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0)
  const totalNet = totalIncome - totalExpense
  const totalSavingsRate = totalIncome > 0 ? (totalNet / totalIncome * 100) : 0
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Estado de Resultados</h1>
          <p className="text-sm" style={{ color: '#8b8ec0' }}>Anio {selectedYear}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <select name="year" defaultValue={selectedYear}
                  className="rounded-lg px-3 py-1.5 text-sm border"
                  style={{ borderColor: '#e8e8f0' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="business_id" defaultValue={params.business_id ?? ''}
                  className="rounded-lg px-3 py-1.5 text-sm border"
                  style={{ borderColor: '#e8e8f0' }}>
            <option value="">Todas las empresas</option>
            {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button type="submit" className="text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
                  style={{ background: '#6439ff' }}>
            Filtrar
          </button>
        </form>
      </div>

      {/* Tabla anual */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f4f4ff' }}>
                <th className="px-4 py-3 text-left sticky left-0 z-10 text-xs font-semibold uppercase" style={{ background: '#f4f4ff', color: '#8b8ec0' }}>Concepto</th>
                {monthNames.map(m => (
                  <th key={m} className="px-3 py-3 text-right min-w-[90px] text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>{m}</th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ background: '#f0f0f8', color: '#8b8ec0' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'rgba(46,219,193,0.03)' }}>
                <td className="px-4 py-3 font-semibold text-[#2edbc1] sticky left-0 z-10" style={{ background: 'rgba(46,219,193,0.03)' }}>Total Ingresos</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-3 text-right font-medium text-[#2edbc1]">
                    {m.income > 0 ? `$${formatMoney0(m.income)}` : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-[#2edbc1]" style={{ background: 'rgba(46,219,193,0.05)' }}>
                  ${formatMoney0(totalIncome)}
                </td>
              </tr>

              <tr style={{ background: 'rgba(254,73,98,0.03)' }}>
                <td className="px-4 py-3 font-semibold text-[#fe4962] sticky left-0 z-10" style={{ background: 'rgba(254,73,98,0.03)' }}>Total Gastos</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-3 text-right font-medium text-[#fe4962]">
                    {m.expense > 0 ? `$${formatMoney0(m.expense)}` : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-[#fe4962]" style={{ background: 'rgba(254,73,98,0.05)' }}>
                  ${formatMoney0(totalExpense)}
                </td>
              </tr>

              <tr style={{ borderBottom: '2px solid #e8e8f0' }}>
                <td className="px-4 py-3 font-bold sticky left-0 z-10" style={{ color: 'var(--navy)' }}>Resultado Neto</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`px-3 py-3 text-right font-bold ${m.net >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                    {(m.income > 0 || m.expense > 0) ? `${m.net >= 0 ? '+' : ''}$${formatMoney0(m.net)}` : '—'}
                  </td>
                ))}
                <td className={`px-4 py-3 text-right font-bold ${totalNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`} style={{ background: '#f4f4ff' }}>
                  {totalNet >= 0 ? '+' : ''}${formatMoney0(totalNet)}
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-medium sticky left-0 z-10" style={{ color: '#8b8ec0' }}>Tasa de Ahorro</td>
                {monthlyData.map((m, i) => {
                  const color = m.savingsRate >= 20 ? '#2edbc1' : m.savingsRate >= 0 ? '#f59e0b' : '#fe4962'
                  return (
                    <td key={i} className="px-3 py-3 text-right text-sm" style={{ color }}>
                      {m.income > 0 ? `${m.savingsRate.toFixed(0)}%` : '—'}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right font-bold" style={{ background: '#f4f4ff', color: totalSavingsRate >= 20 ? '#2edbc1' : totalSavingsRate >= 0 ? '#f59e0b' : '#fe4962' }}>
                  {totalSavingsRate.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen anual */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <p className="text-xs uppercase mb-1" style={{ color: '#8b8ec0' }}>Ingresos {selectedYear}</p>
          <p className="text-xl font-bold text-[#2edbc1]">${formatMoney0(totalIncome)}</p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <p className="text-xs uppercase mb-1" style={{ color: '#8b8ec0' }}>Gastos {selectedYear}</p>
          <p className="text-xl font-bold text-[#fe4962]">${formatMoney0(totalExpense)}</p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <p className="text-xs uppercase mb-1" style={{ color: '#8b8ec0' }}>Resultado Neto</p>
          <p className={`text-xl font-bold ${totalNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
            {totalNet >= 0 ? '+' : ''}${formatMoney0(totalNet)}
          </p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <p className="text-xs uppercase mb-1" style={{ color: '#8b8ec0' }}>Tasa de Ahorro</p>
          <p className={`text-xl font-bold ${totalSavingsRate >= 20 ? 'text-[#2edbc1]' : totalSavingsRate >= 0 ? 'text-yellow-500' : 'text-[#fe4962]'}`}>
            {totalSavingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Equivalente en USD */}
      {hasTC && (
        <div className="mt-6 rounded-xl border p-5" style={{ background: 'rgba(100,57,255,0.05)', borderColor: 'rgba(100,57,255,0.2)' }}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4" style={{ color: '#6439ff' }} />
            <span className="text-sm font-semibold" style={{ color: '#6439ff' }}>Resumen anual en USD</span>
            <span className="text-xs sm:ml-auto" style={{ color: '#8b8ec0' }}>
              TC: ${tcRate.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({tcType}) al {tcDate}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>Ingresos {selectedYear}</p>
              <p className="text-lg font-bold text-[#2edbc1]">USD ${toUSD(totalIncome)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>Gastos {selectedYear}</p>
              <p className="text-lg font-bold text-[#fe4962]">USD ${toUSD(totalExpense)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>Resultado Neto</p>
              <p className={`text-lg font-bold ${totalNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                USD {totalNet >= 0 ? '+' : ''}${toUSD(Math.abs(totalNet))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
