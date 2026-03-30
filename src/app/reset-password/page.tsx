'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { resetPasswordAction } from './actions'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validToken, setValidToken] = useState(true)

  useEffect(() => {
    if (!token) {
      setValidToken(false)
      setError('El enlace de recuperación es inválido o ha expirado.')
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!token) {
      setError('Token inválido')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    const result = await resetPasswordAction(formData, token)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success) {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md rounded-2xl shadow-sm border p-8" style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16" style={{ color: '#fe4962' }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>
              Enlace inválido
            </h1>
            <p className="text-sm" style={{ color: '#8b8ec0' }}>
              El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.
            </p>
          </div>

          <Link
            href="/forgot-password"
            className="block w-full text-center text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
            style={{ background: '#6439ff' }}
          >
            Solicitar nuevo enlace
          </Link>

          <p className="text-xs text-center mt-6" style={{ color: '#5b5c8c' }}>
            © 2024 Grupo Lubrano. All rights reserved.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-sm border p-8" style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        {success ? (
          <>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16" style={{ color: '#2edbc1' }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>
                Contraseña actualizada
              </h1>
              <p className="text-sm" style={{ color: '#8b8ec0' }}>
                Tu contraseña ha sido actualizada exitosamente.
              </p>
            </div>

            <Link
              href="/login"
              className="block w-full text-center text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              style={{ background: '#6439ff' }}
            >
              Ir al inicio de sesión
            </Link>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>
                Nueva contraseña
              </h1>
              <p className="text-sm" style={{ color: '#8b8ec0' }}>
                Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
                  Nueva contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full rounded-lg px-3 py-2 text-sm border bg-white text-black"
                  style={{ borderColor: '#e8e8f0' }}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
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
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>

            {/* Back to login */}
            <Link
              href="/login"
              className="block text-center mt-6 text-sm transition hover:opacity-80"
              style={{ color: '#6439ff' }}
            >
              Volver al inicio de sesión
            </Link>
          </>
        )}

        <p className="text-xs text-center mt-6" style={{ color: '#5b5c8c' }}>
          © 2024 Grupo Lubrano. All rights reserved.
        </p>
      </div>
    </div>
  )
}
