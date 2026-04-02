'use client'

import { signupAction } from './actions'
import { useState } from 'react'

export default function SignupPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #f4f4ff 100%)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-lg border p-8"
           style={{ background: '#ffffff', borderColor: '#e8e8f0' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>
            Grupo Lubrano
          </h1>
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
            Crear Cuenta
          </p>
        </div>

        {/* Form */}
        <SignupForm />

        {/* Footer */}
        <p className="text-[10px] text-center mt-6" style={{ color: '#b0b3d0' }}>
          © 2024 Grupo Lubrano
        </p>
      </div>
    </div>
  )
}

function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await signupAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success) {
      setSuccess(true)
      e.currentTarget.reset()
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="credential" className="block text-xs font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
          Usuario o Email
        </label>
        <input
          id="credential"
          type="text"
          name="credential"
          placeholder="mi_usuario o nombre@empresa.com"
          required
          disabled={loading}
          className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none transition focus:ring-2"
          style={{ borderColor: '#e0e0ef', color: '#1a1a2e', background: '#fafaff' }}
        />
        <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
          Ingresa tu usuario (3-20 caracteres: letras, números, - y _) o tu email
        </p>
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          name="password"
          placeholder="••••••••"
          required
          disabled={loading}
          className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none transition focus:ring-2"
          style={{ borderColor: '#e0e0ef', color: '#1a1a2e', background: '#fafaff' }}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-xs font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
          Confirmar Contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          name="confirmPassword"
          placeholder="••••••••"
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

      {success && (
        <div className="text-xs px-3 py-2.5 rounded-lg" style={{ background: '#f0fff4', color: '#059669', border: '1px solid #dff' }}>
          ✓ Cuenta creada. Redirigiendo al login...
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        style={{ background: '#6439ff' }}
      >
        {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
      </button>

      <div className="pt-2">
        <a
          href="/login"
          className="block text-center text-xs transition hover:opacity-70"
          style={{ color: '#6439ff' }}
        >
          ¿Ya tienes cuenta? Inicia sesión aquí
        </a>
      </div>
    </form>
  )
}
