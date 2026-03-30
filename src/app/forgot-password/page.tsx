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
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #f4f4ff 100%)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-lg border p-8"
           style={{ background: '#ffffff', borderColor: '#e8e8f0' }}>
        {submitted ? (
          <>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-14 h-14" style={{ color: '#2edbc1' }} />
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: '#1a1a2e' }}>
                Correo enviado
              </h1>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>
                Si la dirección existe, recibirás un enlace para recuperar tu contraseña. El enlace expira en 24 horas.
              </p>
            </div>

            <Link
              href="/login"
              className="block w-full text-center text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
              style={{ background: '#6439ff' }}
            >
              Volver al inicio de sesión
            </Link>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold mb-2" style={{ color: '#1a1a2e' }}>
                Recuperar contraseña
              </h1>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>
                Ingresa tu email y te enviaremos un enlace de recuperación.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="nombre@empresa.com"
                  required
                  disabled={loading}
                  className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none transition focus:ring-2"
                  style={{ borderColor: '#e0e0ef', color: '#1a1a2e', background: '#fafaff' }}
                />
              </div>

              {error && (
                <div className="text-xs px-3 py-2.5 rounded-lg" style={{ background: '#fff0f2', color: '#e53e5a', border: '1px solid #fdd' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                style={{ background: '#6439ff' }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 mt-5 text-xs transition hover:opacity-70"
              style={{ color: '#6439ff' }}
            >
              <ArrowLeft className="w-3 h-3" />
              Volver al inicio de sesión
            </Link>
          </>
        )}

        <p className="text-[10px] text-center mt-6" style={{ color: '#b0b3d0' }}>
          © 2024 Grupo Lubrano
        </p>
      </div>
    </div>
  )
}
