import { createClient } from '@/lib/supabase/server'
import { getToday } from '@/lib/utils'
import { TransactionForm } from './TransactionForm'

export default async function AddTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: categories } = await supabase.from('categories').select('*').order('type').order('name')
  const { data: accounts } = await supabase.from('accounts').select('*').order('name')
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Agregar Transaccion</h1>

      {params.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          Transaccion guardada correctamente.
        </div>
      )}

      <TransactionForm
        categories={categories ?? []}
        accounts={accounts ?? []}
        businesses={businesses ?? []}
        today={getToday()}
      />
    </div>
  )
}
