'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { sendPasswordResetAction } from './actions'

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await sendPasswordResetAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success) {
      setSubmitted(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-sm border p-8" style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        {submitted ? (
          <>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16" style={{ color: '#2edbc1' }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>
                Correo enviado
              </h1>
              <p className="text-sm" style={{ color: '#8b8ec0' }}>
                Si la dirección de correo existe en nuestro sistema, recibirás un enlace para recuperar tu contraseña.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-center" style={{ color: '#5b5c8c' }}>
                El enlace expirará en 24 horas.
              </p>
              <Link
                href="/login"
                className="block w-full text-center text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                style={{ background: '#6439ff' }}
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>
                Recuperar contraseña
              </h1>
              <p className="text-sm" style={{ color: '#8b8ec0' }}>
                Ingresa tu correo electrónico y te enviaremos un enlace para recuperar tu contraseña.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="nombre@empresa.com"
                  required
                  disabled={loading}
                  className="w-full rounded-lg px-3 py-2 text-sm border bg-white text-black"
                  style={{ borderColor: '#e8e8f0' }}
                />
              </div>

              {error && (
                <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(254,73,98,0.1)', color: '#fe4962' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                style={{ background: '#6439ff' }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>

            {/* Back to login */}
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 mt-6 text-sm transition hover:opacity-80"
              style={{ color: '#6439ff' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </>
        )}

        {/* Footer */}
        <p className="text-xs text-center mt-6" style={{ color: '#5b5c8c' }}>
          © 2024 Grupo Lubrano. All rights reserved.
        </p>
      </div>
    </div>
  )
}
