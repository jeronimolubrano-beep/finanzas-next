'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addCategory(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('categories').insert({
    name: (formData.get('name') as string).trim(),
    type: formData.get('type') as string,
  })

  if (error) throw new Error('Error al crear: ' + error.message)

  revalidatePath('/categories')
  revalidatePath('/transactions')
  redirect('/categories')
}

export async function updateCategory(id: number, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('categories')
    .update({
      name: (formData.get('name') as string).trim(),
      type: formData.get('type') as string,
    })
    .eq('id', id)

  if (error) throw new Error('Error al actualizar: ' + error.message)

  revalidatePath('/categories')
  revalidatePath('/transactions')
  redirect('/categories')
}

export async function deleteCategory(id: number) {
  const supabase = await createClient()

  // Verificar si tiene transacciones
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    throw new Error('No se puede eliminar: tiene transacciones asociadas')
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error('Error al eliminar: ' + error.message)

  revalidatePath('/categories')
}
