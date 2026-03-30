'use server'

import { createClient } from '@/lib/supabase/server'

export async function sendPasswordResetAction(formData: FormData) {
  const email = formData.get('email') as string

  // Validate input
  if (!email) {
    return { error: 'Email es requerido' }
  }

  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    })

    if (error) {
      // Don't expose whether email exists or not for security
      return { error: 'Si la dirección de correo existe, recibirás un enlace de recuperación' }
    }

    return { success: true }
  } catch (e) {
    return { error: 'Error al enviar el correo de recuperación. Intente más tarde.' }
  }
}
