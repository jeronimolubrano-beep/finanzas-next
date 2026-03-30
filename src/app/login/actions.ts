'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate inputs
  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos' }
  }

  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message || 'Error al iniciar sesión. Verifique sus credenciales.' }
    }

    // Successful login - redirect to dashboard
    redirect('/')
  } catch (e) {
    return { error: 'Error al iniciar sesión. Intente más tarde.' }
  }
}
