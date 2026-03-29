import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { EditTransactionForm } from './EditTransactionForm'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', parseInt(id))
    .single()

  if (!transaction) notFound()

  const { data: categories } = await supabase.from('categories').select('*').order('type').order('name')
  const { data: accounts } = await supabase.from('accounts').select('*').order('name')
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Editar Transaccion</h1>
      <EditTransactionForm
        transaction={transaction}
        categories={categories ?? []}
        accounts={accounts ?? []}
        businesses={businesses ?? []}
      />
    </div>
  )
}
