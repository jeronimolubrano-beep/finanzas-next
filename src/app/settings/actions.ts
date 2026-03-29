'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveExchangeRate(formData: FormData) {
  const supabase = await createClient()

  const rate = formData.get('current_rate') as string
  const date = formData.get('rate_date') as string

  await supabase.from('settings').upsert({ key: 'current_rate', value: rate || null })
  await supabase.from('settings').upsert({ key: 'rate_date', value: date || null })

  revalidatePath('/settings')
  revalidatePath('/transactions/add')
}
