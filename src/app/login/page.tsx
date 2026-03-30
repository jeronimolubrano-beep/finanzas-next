'use client'

import { loginAction } from './actions'
import { useState } from 'react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #f4f4ff 100%)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-lg border p-8"
           style={{ background: '#ffffff', borderColor: '#e8e8f0' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ background: '#f4f4ff' }}>
              <img src="/logo.png" alt="Grupo Lubrano"
                   className="w-12 h-12 object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>
            Grupo Lubrano
          </h1>
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
            Sistema de Finanzas
          </p>
        </div>

        {/* Form */}
        <LoginForm />

        {/* Footer */}
        <p className="text-[10px] text-center mt-6" style={{ color: '#b0b3d0' }}>
          © 2024 Grupo Lubrano
        </p>
      </div>
    </div>
  )
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
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
        {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>

      <div className="pt-2">
        <a
          href="/forgot-password"
          className="block text-center text-xs transition hover:opacity-70"
          style={{ color: '#6439ff' }}
        >
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </form>
  )
}
