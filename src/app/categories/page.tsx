import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusCircle, Pencil } from 'lucide-react'
import { DeleteCategoryButton } from './DeleteCategoryButton'

export default async function CategoriesPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('type')
    .order('name')

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
        <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Categorias</h1>
        <Link
          href="/categories/add"
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          style={{ background: '#6439ff' }}
        >
          <PlusCircle className="w-4 h-4" />
          Nueva categoria
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Ingresos */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: 'rgba(46,219,193,0.05)', borderColor: '#e8e8f0' }}>
            <h2 className="font-semibold text-[#2edbc1]">Categorias de Ingreso ({incomeCategories.length})</h2>
          </div>
          <div className="divide-y" style={{ borderColor: '#f0f0f8' }}>
            {incomeCategories.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-[#f9f9ff] transition">
                <div>
                  <span className="font-medium" style={{ color: 'var(--navy)' }}>{c.name}</span>
                  <span className="ml-2 text-xs" style={{ color: '#8b8ec0' }}>
                    {countMap[c.id] || 0} transaccion(es)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/categories/${c.id}/edit`}
                        className="p-1 transition hover:opacity-70" style={{ color: '#6439ff' }} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <DeleteCategoryButton id={c.id} hasTransactions={(countMap[c.id] || 0) > 0} />
                </div>
              </div>
            ))}
            {incomeCategories.length === 0 && (
              <p className="px-4 py-6 text-center" style={{ color: '#8b8ec0' }}>Sin categorias de ingreso</p>
            )}
          </div>
        </div>

        {/* Gastos */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: 'rgba(254,73,98,0.05)', borderColor: '#e8e8f0' }}>
            <h2 className="font-semibold text-[#fe4962]">Categorias de Gasto ({expenseCategories.length})</h2>
          </div>
          <div className="divide-y" style={{ borderColor: '#f0f0f8' }}>
            {expenseCategories.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-[#f9f9ff] transition">
                <div>
                  <span className="font-medium" style={{ color: 'var(--navy)' }}>{c.name}</span>
                  <span className="ml-2 text-xs" style={{ color: '#8b8ec0' }}>
                    {countMap[c.id] || 0} transaccion(es)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/categories/${c.id}/edit`}
                        className="p-1 transition hover:opacity-70" style={{ color: '#6439ff' }} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <DeleteCategoryButton id={c.id} hasTransactions={(countMap[c.id] || 0) > 0} />
                </div>
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <p className="px-4 py-6 text-center" style={{ color: '#8b8ec0' }}>Sin categorias de gasto</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
