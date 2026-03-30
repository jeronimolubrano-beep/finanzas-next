'use client'

import { loginAction } from './actions'
import { useState } from 'react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-sm border p-8" style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Grupo Lubrano" style={{ width: '60px', height: '60px' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>
            Grupo Lubrano
          </h1>
          <p className="text-sm" style={{ color: '#8b8ec0' }}>
            Finanzas
          </p>
        </div>

        {/* Form */}
        <LoginForm />

        {/* Footer */}
        <p className="text-xs text-center mt-6" style={{ color: '#5b5c8c' }}>
          © 2024 Grupo Lubrano. All rights reserved.
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
    // If no error, loginAction will redirect
  }

  return (
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

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
          Contraseña
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
        {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-full border-t" style={{ borderColor: '#333b72' }}></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2" style={{ background: 'var(--dash-card)', color: '#5b5c8c' }}>
            ¿Olvidaste tu contraseña?
          </span>
        </div>
      </div>

      <a
        href="/forgot-password"
        className="block w-full text-center text-sm py-2 rounded-lg border transition hover:bg-opacity-5"
        style={{ borderColor: '#6439ff', color: '#6439ff' }}
      >
        Recuperar contraseña
      </a>
    </form>
  )
}
