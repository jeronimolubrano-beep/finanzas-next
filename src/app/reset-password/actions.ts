'use server'

import { createClient } from '@/lib/supabase/server'

export async function resetPasswordAction(formData: FormData, token: string) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Validate inputs
  if (!password || !confirmPassword) {
    return { error: 'Contraseña y confirmación son requeridas' }
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden' }
  }

  if (!token) {
    return { error: 'Token inválido o expirado' }
  }

  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      if (error.message.includes('token')) {
        return { error: 'El enlace de recuperación ha expirado. Solicita uno nuevo.' }
      }
      return { error: error.message || 'Error al cambiar la contraseña' }
    }

    return { success: true }
  } catch (e) {
    return { error: 'Error al cambiar la contraseña. Intente más tarde.' }
  }
}
