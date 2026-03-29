import { createClient } from '@/lib/supabase/server'
import { formatMoney, statusLabel, formatDateAR } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { DollarSign } from 'lucide-react'

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; business_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const selectedMonth = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = selectedMonth.split('-')
  const dateFrom = `${selectedMonth}-01`
  const dateTo = `${selectedMonth}-31`

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`

  let query = supabase
    .from('transactions')
    .select('*, categories(name)')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date')

  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }

  const { data: transactions } = await query
  const txs = transactions ?? []

  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  // Tipo de cambio
  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const tcRate = parseFloat(settingsMap.current_rate) || 0
  const tcDate = settingsMap.rate_date || ''
  const tcType = settingsMap.rate_type || ''
  const hasTC = tcRate > 0

  // === PERCIBIDO ===
  const percibido = txs.filter(t => t.status === 'percibido')
  const pIncome = percibido.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const pExpense = percibido.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const pNet = pIncome - pExpense

  // === DEVENGADO ===
  const dIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const dExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const dNet = dIncome - dExpense

  // Agrupar por categoria
  type CatGroup = { name: string; total: number }
  function groupByCategory(items: typeof txs, type: string): CatGroup[] {
    const map: Record<string, CatGroup> = {}
    for (const t of items.filter(t => t.type === type)) {
      const name = (t.categories as unknown as { name: string } | null)?.name ?? 'Sin categoria'
      if (!map[name]) map[name] = { name, total: 0 }
      map[name].total += Number(t.amount)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  const incomeByCategory = groupByCategory(txs, 'income')
  const expenseByCategory = groupByCategory(txs, 'expense')

  function toUSD(ars: number): string {
    return formatMoney(ars / tcRate)
  }

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cash Flow</h1>
          <p className="text-sm text-gray-500">{monthLabel}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="month" name="month" defaultValue={selectedMonth}
                 className="border rounded-lg px-3 py-1.5 text-sm" />
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

      {/* KPI Cards - Cobrado/Pagado vs Pendiente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <KPICard title="Ingresos cobrados" value={`$${formatMoney(pIncome)}`} color="green" />
        <KPICard title="Gastos pagados" value={`$${formatMoney(pExpense)}`} color="red" />
        <KPICard title="Flujo neto efectivo" value={`${pNet >= 0 ? '+' : ''}$${formatMoney(pNet)}`}
                 color={pNet >= 0 ? 'green' : 'red'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard title="Ingresos totales (incl. pendientes)" value={`$${formatMoney(dIncome)}`} color="cyan" />
        <KPICard title="Gastos totales (incl. pendientes)" value={`$${formatMoney(dExpense)}`} color="orange" />
        <KPICard title="Flujo neto devengado" value={`${dNet >= 0 ? '+' : ''}$${formatMoney(dNet)}`}
                 color={dNet >= 0 ? 'cyan' : 'red'} />
      </div>

      {/* Equivalente en USD */}
      {hasTC && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Equivalente en USD</span>
            <span className="text-xs text-blue-400 ml-auto">
              TC: ${tcRate.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({tcType}) al {tcDate}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-blue-400">Ingresos</p>
              <p className="text-lg font-bold text-green-600">USD ${toUSD(dIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-400">Gastos</p>
              <p className="text-lg font-bold text-red-500">USD ${toUSD(dExpense)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-400">Flujo neto</p>
              <p className={`text-lg font-bold ${dNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                USD {dNet >= 0 ? '+' : ''}${toUSD(Math.abs(dNet))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Desglose por categoria */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b">
            <h2 className="font-semibold text-green-700">Ingresos por categoria</h2>
          </div>
          <table className="w-full text-sm">
            <thead className={hasTC ? 'bg-gray-50 text-gray-500 text-xs' : ''}>
              {hasTC && (
                <tr>
                  <th className="px-4 py-1 text-left"></th>
                  <th className="px-4 py-1 text-right">ARS</th>
                  <th className="px-4 py-1 text-right">USD</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y">
              {incomeByCategory.map(c => (
                <tr key={c.name}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-600">${formatMoney(c.total)}</td>
                  {hasTC && <td className="px-4 py-2 text-right text-xs text-gray-400">${toUSD(c.total)}</td>}
                </tr>
              ))}
              {incomeByCategory.length === 0 && (
                <tr><td colSpan={hasTC ? 3 : 2} className="px-4 py-4 text-center text-gray-400">Sin ingresos</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td className="px-4 py-2 font-bold">Total</td>
                <td className="px-4 py-2 text-right font-bold text-green-600">${formatMoney(dIncome)}</td>
                {hasTC && <td className="px-4 py-2 text-right font-bold text-xs text-gray-500">${toUSD(dIncome)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b">
            <h2 className="font-semibold text-red-700">Gastos por categoria</h2>
          </div>
          <table className="w-full text-sm">
            <thead className={hasTC ? 'bg-gray-50 text-gray-500 text-xs' : ''}>
              {hasTC && (
                <tr>
                  <th className="px-4 py-1 text-left"></th>
                  <th className="px-4 py-1 text-right">ARS</th>
                  <th className="px-4 py-1 text-right">USD</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y">
              {expenseByCategory.map(c => (
                <tr key={c.name}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">${formatMoney(c.total)}</td>
                  {hasTC && <td className="px-4 py-2 text-right text-xs text-gray-400">${toUSD(c.total)}</td>}
                </tr>
              ))}
              {expenseByCategory.length === 0 && (
                <tr><td colSpan={hasTC ? 3 : 2} className="px-4 py-4 text-center text-gray-400">Sin gastos</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td className="px-4 py-2 font-bold">Total</td>
                <td className="px-4 py-2 text-right font-bold text-red-600">${formatMoney(dExpense)}</td>
                {hasTC && <td className="px-4 py-2 text-right font-bold text-xs text-gray-500">${toUSD(dExpense)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detalle de transacciones */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-700">Detalle de transacciones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripcion</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {txs.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{formatDateAR(t.date)}</td>
                  <td className="px-4 py-2">{t.description}</td>
                  <td className="px-4 py-2 text-gray-500">{(t.categories as unknown as { name: string } | null)?.name ?? '—'}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}${formatMoney(Number(t.amount))}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'devengado' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {statusLabel(t.status, t.type)}
                    </span>
                  </td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No hay transacciones en este periodo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
