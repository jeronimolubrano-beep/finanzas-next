'use server'

import { createClient } from '@/lib/supabase/server'

export async function getSettingsExchangeRate(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value')
  const map: Record<string, string> = {}
  for (const s of data ?? []) map[s.key] = s.value ?? ''
  return parseFloat(map.current_rate) || 0
}

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

  // FASE 5: Validación reforzada de transacciones
  const discardedInActions: string[] = []
  const validTransactions: ImportTransaction[] = []

  for (const tx of transactions) {
    // Validar fecha
    if (!tx.date || !String(tx.date).trim()) {
      discardedInActions.push(`"${tx.description}" - fecha faltante`)
      continue
    }

    // Validar descripción
    if (!tx.description || !String(tx.description).trim()) {
      discardedInActions.push(`Sin descripción`)
      continue
    }

    // Validar tipo
    if (!tx.type || !['income', 'expense'].includes(tx.type)) {
      discardedInActions.push(`"${tx.description}" - tipo inválido`)
      continue
    }

    // Validar empresa
    if (!tx.businessId || typeof tx.businessId !== 'number') {
      discardedInActions.push(`"${tx.description}" - empresa no válida`)
      continue
    }

    // CRÍTICO: Validar monto > 0
    if (typeof tx.amount !== 'number' || tx.amount <= 0 || isNaN(tx.amount)) {
      discardedInActions.push(`"${tx.description}" - monto inválido o cero`)
      continue
    }

    validTransactions.push(tx)
  }

  // Si todas se descartan, error
  if (validTransactions.length === 0) {
    return {
      error: 'Ninguna transacción es válida. Verificá montos, fechas y empresas.',
      discarded: discardedInActions.slice(0, 5),
    }
  }

  // Log de descartadas (para debugging)
  if (discardedInActions.length > 0) {
    console.warn(
      `[saveImportedTransactions] Descartadas ${discardedInActions.length} transacciones:`,
      discardedInActions.slice(0, 5)
    )
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
