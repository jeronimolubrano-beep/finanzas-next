'use server'

import { createClient } from '@/lib/supabase/server'

interface ImportTransaction {
  date: string
  description: string
  notes: string
  type: 'income' | 'expense'
  amount: number
  businessId: number
  categoryId: number | null
  expenseType: 'ordinario' | 'extraordinario'
  currency: 'ARS' | 'USD'
  exchangeRate: number | null
}

export async function saveImportedTransactions(transactions: ImportTransaction[]) {
  const supabase = await createClient()

  if (!transactions.length) {
    return { error: 'No hay transacciones para importar' }
  }

  // Validar que todas tengan campos requeridos
  for (const tx of transactions) {
    if (!tx.date || !tx.description || !tx.amount || !tx.type || !tx.businessId) {
      return { error: `Transacción inválida: ${tx.description || 'sin descripción'}` }
    }
  }

  // Preparar registros para insert
  const records = transactions.map(tx => ({
    date: tx.date,
    description: tx.description,
    notes: tx.notes || null,
    type: tx.type,
    amount: tx.amount,
    business_id: tx.businessId,
    category_id: tx.categoryId,
    expense_type: tx.type === 'expense' ? tx.expenseType : null,
    currency: tx.currency,
    exchange_rate: tx.exchangeRate,
    status: 'percibido' as const,
    account_id: null,
    due_date: null,
    paid_date: null,
  }))

  // Insert en batches de 500
  const batchSize = 500
  let totalInserted = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from('transactions').insert(batch)

    if (error) {
      return {
        error: `Error al guardar batch ${Math.floor(i / batchSize) + 1}: ${error.message}`,
        inserted: totalInserted,
      }
    }
    totalInserted += batch.length
  }

  return { success: true, inserted: totalInserted }
}

export async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, type')
    .order('type')
    .order('name')
  return data ?? []
}
