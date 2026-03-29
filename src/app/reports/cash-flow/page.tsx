import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; business_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Mes seleccionado (default: mes actual)
  const now = new Date()
  const selectedMonth = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = selectedMonth.split('-')
  const dateFrom = `${selectedMonth}-01`
  const dateTo = `${selectedMonth}-31`

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`

  // Query transacciones del mes
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

  // Empresas para filtro
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  // === PERCIBIDO (solo cobrado/pagado) ===
  const percibido = txs.filter(t => t.status === 'percibido')
  const pIncome = percibido.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const pExpense = percibido.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const pNet = pIncome - pExpense

  // === DEVENGADO (todas) ===
  const dIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const dExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const dNet = dIncome - dExpense

  // Agrupar por categoria
  type CatGroup = { name: string; total: number }
  function groupByCategory(items: typeof txs, type: string): CatGroup[] {
    const map: Record<string, CatGroup> = {}
    for (const t of items.filter(t => t.type === type)) {
      const name = (t.categories as { name: string } | null)?.name ?? 'Sin categoria'
      if (!map[name]) map[name] = { name, total: 0 }
      map[name].total += Number(t.amount)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  const incomeByCategory = groupByCategory(txs, 'income')
  const expenseByCategory = groupByCategory(txs, 'expense')

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cash Flow</h1>
          <p className="text-sm text-gray-500">{monthLabel}</p>
        </div>
        <form className="flex items-center gap-2">
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

      {/* KPI Cards - Percibido vs Devengado */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <KPICard title="Ingresos percibidos" value={`$${formatMoney(pIncome)}`} color="green" />
        <KPICard title="Gastos percibidos" value={`$${formatMoney(pExpense)}`} color="red" />
        <KPICard title="Flujo neto percibido" value={`${pNet >= 0 ? '+' : ''}$${formatMoney(pNet)}`}
                 color={pNet >= 0 ? 'green' : 'red'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard title="Ingresos devengados" value={`$${formatMoney(dIncome)}`} color="cyan" />
        <KPICard title="Gastos devengados" value={`$${formatMoney(dExpense)}`} color="orange" />
        <KPICard title="Flujo neto devengado" value={`${dNet >= 0 ? '+' : ''}$${formatMoney(dNet)}`}
                 color={dNet >= 0 ? 'cyan' : 'red'} />
      </div>

      {/* Desglose por categoria */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Ingresos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b">
            <h2 className="font-semibold text-green-700">Ingresos por categoria</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {incomeByCategory.map(c => (
                <tr key={c.name}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-600">${formatMoney(c.total)}</td>
                </tr>
              ))}
              {incomeByCategory.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400">Sin ingresos</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td className="px-4 py-2 font-bold">Total</td>
                <td className="px-4 py-2 text-right font-bold text-green-600">${formatMoney(dIncome)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b">
            <h2 className="font-semibold text-red-700">Gastos por categoria</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {expenseByCategory.map(c => (
                <tr key={c.name}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">${formatMoney(c.total)}</td>
                </tr>
              ))}
              {expenseByCategory.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400">Sin gastos</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td className="px-4 py-2 font-bold">Total</td>
                <td className="px-4 py-2 text-right font-bold text-red-600">${formatMoney(dExpense)}</td>
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
                  <td className="px-4 py-2 text-gray-500">{t.date}</td>
                  <td className="px-4 py-2">{t.description}</td>
                  <td className="px-4 py-2 text-gray-500">{(t.categories as { name: string } | null)?.name ?? '—'}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}${formatMoney(Number(t.amount))}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'devengado' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {t.status === 'devengado' ? 'Devengado' : 'Percibido'}
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
