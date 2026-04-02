'use server'

import { createClient } from '@/lib/supabase/server'
import { createUserProfile } from '@/lib/db'

export async function signupAction(formData: FormData) {
  const credential = formData.get('credential') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Validations
  if (!credential || !password || !confirmPassword) {
    return { error: 'Todos los campos son requeridos' }
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden' }
  }

  // Determine if credential is email or username
  const isEmail = credential.includes('@')
  let username: string
  let email: string

  if (isEmail) {
    // Credential is an email address
    email = credential
    // Generate username from email (everything before @)
    username = credential.split('@')[0]
  } else {
    // Credential is a username
    username = credential
    // Email is required but can be the same as username for now
    // In a real app, you might ask for email separately
    email = `${credential}@finanzas-local.app`
  }

  // Validate username
  if (username.length < 3) {
    return { error: 'El usuario debe tener al menos 3 caracteres' }
  }

  if (username.length > 20) {
    return { error: 'El usuario no puede exceder 20 caracteres' }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { error: 'El usuario solo puede contener letras, números, guiones y guiones bajos' }
  }

  const supabase = await createClient()

  // Create user in Supabase Auth
  const { data, error: signupError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (signupError) {
    return { error: signupError.message }
  }

  // Save profile with username
  if (data.user) {
    const { error: profileError } = await createUserProfile(data.user.id, username, email)
    if (profileError) {
      return { error: 'Error al guardar el perfil. El usuario podría ya estar en uso.' }
    }
  }

  return { success: true, message: 'Cuenta creada exitosamente. Por favor inicia sesión.' }
}
