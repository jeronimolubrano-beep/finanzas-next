'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addTransaction(formData: FormData) {
  const supabase = await createClient()

  const type_ = formData.get('type') as string

  // IVA: solo aplica a expenses, valor entre 0 y 100
  const ivaRawStr = formData.get('iva_rate') as string
  const ivaRaw = ivaRawStr ? parseFloat(ivaRawStr) : null
  const iva_rate =
    type_ === 'expense' && ivaRaw !== null && !isNaN(ivaRaw) && ivaRaw >= 0
      ? ivaRaw
      : null

  const { error } = await supabase.from('transactions').insert({
    date: formData.get('date') as string,
    description: (formData.get('description') as string).trim(),
    amount: parseFloat(formData.get('amount') as string),
    type: type_,
    category_id: parseInt(formData.get('category_id') as string),
    account_id: formData.get('account_id') ? parseInt(formData.get('account_id') as string) : null,
    business_id: parseInt(formData.get('business_id') as string),
    status: (formData.get('status') as string) || 'percibido',
    expense_type: type_ === 'expense' ? (formData.get('expense_type') as string) || 'ordinario' : null,
    notes: (formData.get('notes') as string)?.trim() || null,
    currency: (formData.get('currency') as string) || 'ARS',
    exchange_rate: formData.get('exchange_rate') ? parseFloat(formData.get('exchange_rate') as string) : null,
    due_date: (formData.get('due_date') as string) || null,
    iva_rate,
  })

  if (error) {
    throw new Error('Error al guardar: ' + error.message)
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/reports/cash-flow')
  redirect('/transactions/add?success=true')
}
