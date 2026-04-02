'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserEmailByUsername, updateUsername } from '@/lib/db'

export async function changeUsernameAction(formData: FormData) {
  const newUsername = (formData.get('username') as string)?.trim()

  if (!newUsername) return { error: 'El usuario es requerido' }
  if (newUsername.length < 3) return { error: 'El usuario debe tener al menos 3 caracteres' }
  if (newUsername.length > 20) return { error: 'El usuario no puede exceder 20 caracteres' }
  if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
    return { error: 'Solo letras, números, guiones y guiones bajos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Check if username already taken
  const existingEmail = await getUserEmailByUsername(newUsername)
  if (existingEmail && existingEmail !== user.email) {
    return { error: 'Ese usuario ya está en uso' }
  }

  const { error } = await updateUsername(user.id, newUsername)
  if (error) return { error: 'Error al actualizar el usuario' }

  revalidatePath('/settings')
  return { success: true }
}

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
