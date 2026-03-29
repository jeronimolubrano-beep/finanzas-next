import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import Link from 'next/link'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { DeleteButton } from './DeleteButton'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string
    month?: string
    business_id?: string
    status?: string
    category_id?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Cargar transacciones con relaciones
  let query = supabase
    .from('transactions')
    .select('*, categories(name), accounts(name), businesses(name)')
    .order('date', { ascending: false })
    .limit(200)

  if (params.type && ['income', 'expense'].includes(params.type)) {
    query = query.eq('type', params.type)
  }
  if (params.month) {
    query = query.gte('date', `${params.month}-01`).lte('date', `${params.month}-31`)
  }
  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }
  if (params.status && ['percibido', 'devengado'].includes(params.status)) {
    query = query.eq('status', params.status)
  }
  if (params.category_id) {
    query = query.eq('category_id', parseInt(params.category_id))
  }

  const { data: transactions } = await query

  // Cargar categorias y empresas para filtros
  const { data: categories } = await supabase.from('categories').select('*').order('type').order('name')
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  // Totales
  const totalIncome = (transactions ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = (transactions ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = totalIncome - totalExpense

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Transacciones</h1>
        <Link
          href="/transactions/add"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <PlusCircle className="w-4 h-4" />
          Agregar
        </Link>
      </div>

      {/* Filtros */}
      <form className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Tipo</label>
            <select name="type" defaultValue={params.type ?? ''} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Mes</label>
            <input type="month" name="month" defaultValue={params.month ?? ''} className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Empresa</label>
            <select name="business_id" defaultValue={params.business_id ?? ''} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">Todas</option>
              {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Estado</label>
            <select name="status" defaultValue={params.status ?? ''} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              <option value="percibido">Percibido</option>
              <option value="devengado">Devengado</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-gray-800 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-900 transition">
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripcion</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(transactions ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{t.date}</td>
                  <td className="px-4 py-3 font-medium">{t.description}</td>
                  <td className="px-4 py-3 text-gray-500">{t.categories?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.businesses?.name ?? '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}${formatMoney(Number(t.amount))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'devengado' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {t.status === 'devengado' ? 'Devengado' : 'Percibido'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/transactions/${t.id}/edit`}
                        className="p-1 text-gray-400 hover:text-blue-600 transition"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <DeleteButton id={t.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {(!transactions || transactions.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No hay transacciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        {transactions && transactions.length > 0 && (
          <div className="border-t px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-500 font-medium">
              {transactions.length} transaccion(es)
            </span>
            <div className="flex items-center gap-4">
              <span className="text-green-600 font-semibold">+${formatMoney(totalIncome)}</span>
              <span className="text-red-600 font-semibold">-${formatMoney(totalExpense)}</span>
              <span className={`font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Neto: ${formatMoney(net)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
