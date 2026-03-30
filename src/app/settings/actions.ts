'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveExchangeRate(formData: FormData) {
  const supabase = await createClient()

  const rate = formData.get('current_rate') as string
  const date = formData.get('rate_date') as string
  const rateType = formData.get('rate_type') as string

  await supabase.from('settings').upsert({ key: 'current_rate', value: rate || null })
  await supabase.from('settings').upsert({ key: 'rate_date', value: date || null })
  await supabase.from('settings').upsert({ key: 'rate_type', value: rateType || null })

  revalidatePath('/settings')
  revalidatePath('/transactions/add')
  revalidatePath('/reports/cash-flow')
  revalidatePath('/reports/income-statement')
}

export async function selectDolarRate(rate: string, date: string, rateType: string) {
  const supabase = await createClient()

  await supabase.from('settings').upsert({ key: 'current_rate', value: rate })
  await supabase.from('settings').upsert({ key: 'rate_date', value: date })
  await supabase.from('settings').upsert({ key: 'rate_type', value: rateType })

  revalidatePath('/settings')
  revalidatePath('/reports/cash-flow')
  revalidatePath('/reports/income-statement')
}
