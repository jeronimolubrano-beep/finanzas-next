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

  // Query todas las transacciones del anio
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

  // Empresas para filtro
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  // Tipo de cambio
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

  // Agrupar por mes
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

  // Totales anuales
  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0)
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0)
  const totalNet = totalIncome - totalExpense
  const totalSavingsRate = totalIncome > 0 ? (totalNet / totalIncome * 100) : 0

  // Anios disponibles (ultimos 5)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estado de Resultados</h1>
          <p className="text-sm text-gray-500">Anio {selectedYear}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <select name="year" defaultValue={selectedYear}
                  className="border rounded-lg px-3 py-1.5 text-sm">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
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

      {/* Tabla anual */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 z-10">Concepto</th>
                {monthNames.map(m => (
                  <th key={m} className="px-3 py-3 text-right min-w-[90px]">{m}</th>
                ))}
                <th className="px-4 py-3 text-right bg-gray-100 font-bold min-w-[100px]">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* Ingresos */}
              <tr className="border-b bg-green-50/50">
                <td className="px-4 py-3 font-semibold text-green-700 sticky left-0 bg-green-50/50 z-10">
                  Total Ingresos
                </td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-3 text-right text-green-600 font-medium">
                    {m.income > 0 ? `$${formatMoney0(m.income)}` : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50">
                  ${formatMoney0(totalIncome)}
                </td>
              </tr>

              {/* Gastos */}
              <tr className="border-b bg-red-50/50">
                <td className="px-4 py-3 font-semibold text-red-700 sticky left-0 bg-red-50/50 z-10">
                  Total Gastos
                </td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-3 text-right text-red-600 font-medium">
                    {m.expense > 0 ? `$${formatMoney0(m.expense)}` : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-red-700 bg-red-50">
                  ${formatMoney0(totalExpense)}
                </td>
              </tr>

              {/* Resultado Neto */}
              <tr className="border-b-2 border-gray-300">
                <td className="px-4 py-3 font-bold text-gray-800 sticky left-0 bg-white z-10">
                  Resultado Neto
                </td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`px-3 py-3 text-right font-bold ${
                    m.net >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(m.income > 0 || m.expense > 0) ? `${m.net >= 0 ? '+' : ''}$${formatMoney0(m.net)}` : '—'}
                  </td>
                ))}
                <td className={`px-4 py-3 text-right font-bold bg-gray-50 ${
                  totalNet >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {totalNet >= 0 ? '+' : ''}${formatMoney0(totalNet)}
                </td>
              </tr>

              {/* Tasa de ahorro */}
              <tr>
                <td className="px-4 py-3 font-medium text-gray-600 sticky left-0 bg-white z-10">
                  Tasa de Ahorro
                </td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`px-3 py-3 text-right text-sm ${
                    m.savingsRate >= 20 ? 'text-green-600' : m.savingsRate >= 0 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {m.income > 0 ? `${m.savingsRate.toFixed(0)}%` : '—'}
                  </td>
                ))}
                <td className={`px-4 py-3 text-right font-bold bg-gray-50 ${
                  totalSavingsRate >= 20 ? 'text-green-700' : totalSavingsRate >= 0 ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {totalSavingsRate.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen anual */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 uppercase mb-1">Ingresos {selectedYear}</p>
          <p className="text-xl font-bold text-green-600">${formatMoney0(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 uppercase mb-1">Gastos {selectedYear}</p>
          <p className="text-xl font-bold text-red-600">${formatMoney0(totalExpense)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 uppercase mb-1">Resultado Neto</p>
          <p className={`text-xl font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalNet >= 0 ? '+' : ''}${formatMoney0(totalNet)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 uppercase mb-1">Tasa de Ahorro</p>
          <p className={`text-xl font-bold ${
            totalSavingsRate >= 20 ? 'text-green-600' : totalSavingsRate >= 0 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {totalSavingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Equivalente en USD */}
      {hasTC && (
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Resumen anual en USD</span>
            <span className="text-xs text-blue-400 sm:ml-auto">
              TC: ${tcRate.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({tcType}) al {tcDate}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-blue-400">Ingresos {selectedYear}</p>
              <p className="text-lg font-bold text-green-600">USD ${toUSD(totalIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-400">Gastos {selectedYear}</p>
              <p className="text-lg font-bold text-red-500">USD ${toUSD(totalExpense)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-400">Resultado Neto</p>
              <p className={`text-lg font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                USD {totalNet >= 0 ? '+' : ''}${toUSD(Math.abs(totalNet))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
