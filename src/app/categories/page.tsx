import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusCircle, Pencil } from 'lucide-react'
import { DeleteCategoryButton } from './DeleteCategoryButton'

export default async function CategoriesPage() {
  const supabase = await createClient()

  // Categorias con conteo de transacciones
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('type')
    .order('name')

  // Contar transacciones por categoria
  const { data: counts } = await supabase
    .from('transactions')
    .select('category_id')

  const countMap: Record<number, number> = {}
  for (const t of counts ?? []) {
    if (t.category_id) {
      countMap[t.category_id] = (countMap[t.category_id] || 0) + 1
    }
  }

  const incomeCategories = (categories ?? []).filter(c => c.type === 'income')
  const expenseCategories = (categories ?? []).filter(c => c.type === 'expense')

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Categorias</h1>
        <Link
          href="/categories/add"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <PlusCircle className="w-4 h-4" />
          Nueva categoria
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Ingresos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b">
            <h2 className="font-semibold text-green-700">Categorias de Ingreso ({incomeCategories.length})</h2>
          </div>
          <div className="divide-y">
            {incomeCategories.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {countMap[c.id] || 0} transaccion(es)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/categories/${c.id}/edit`}
                        className="p-1 text-gray-400 hover:text-blue-600 transition" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <DeleteCategoryButton id={c.id} hasTransactions={(countMap[c.id] || 0) > 0} />
                </div>
              </div>
            ))}
            {incomeCategories.length === 0 && (
              <p className="px-4 py-6 text-center text-gray-400">Sin categorias de ingreso</p>
            )}
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b">
            <h2 className="font-semibold text-red-700">Categorias de Gasto ({expenseCategories.length})</h2>
          </div>
          <div className="divide-y">
            {expenseCategories.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {countMap[c.id] || 0} transaccion(es)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/categories/${c.id}/edit`}
                        className="p-1 text-gray-400 hover:text-blue-600 transition" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <DeleteCategoryButton id={c.id} hasTransactions={(countMap[c.id] || 0) > 0} />
                </div>
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <p className="px-4 py-6 text-center text-gray-400">Sin categorias de gasto</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
