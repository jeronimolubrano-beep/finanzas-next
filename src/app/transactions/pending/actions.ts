'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markAsPaid(id: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .update({
      status: 'percibido',
      paid_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)

  if (error) {
    throw new Error('Error al marcar como pagado: ' + error.message)
  }

  revalidatePath('/transactions')
  revalidatePath('/transactions/pending')
  revalidatePath('/dashboard')
  revalidatePath('/reports/cash-flow')
  revalidatePath('/reports/income-statement')
}
