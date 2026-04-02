'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserEmailByUsername } from '@/lib/db'

export async function loginAction(formData: FormData) {
  const credential = formData.get('credential') as string // username or email
  const password = formData.get('password') as string

  // Validate inputs
  if (!credential || !password) {
    return { error: 'Usuario/email y contraseña son requeridos' }
  }

  // Determine if credential is username or email
  let email = credential
  if (!credential.includes('@')) {
    // It's a username, look up the email
    email = await getUserEmailByUsername(credential)
    if (!email) {
      return { error: 'Usuario no encontrado' }
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciales inválidas. Verifique su usuario/email y contraseña.' }
  }

  return { success: true }
}
