'use client'

import { useState } from 'react'
import { Loader2, Lock, User } from 'lucide-react'

interface Props {
  onLogin: (username: string, password: string) => Promise<boolean>
  isLoading: boolean
  error: string | null
}

export function IOLLoginModal({ onLogin, isLoading, error }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    await onLogin(username.trim(), password.trim())
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl p-8"
        style={{ background: '#1a1f4e', border: '1px solid #333b72' }}
      >
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(100,57,255,0.15)' }}
          >
            <Lock className="w-7 h-7" style={{ color: '#8b6fff' }} />
          </div>
          <h2 className="text-lg font-bold text-white">Conectar con IOL</h2>
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
            Ingresá tus credenciales de InvertirOnline
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b8ec0' }}>
              Usuario o Email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5b5c8c' }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full rounded-lg pl-10 pr-3 py-2.5 text-sm border outline-none transition focus:ring-2 focus:ring-[#6439ff]"
                style={{ background: '#0d1035', borderColor: '#333b72', color: '#e0e4ff' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b8ec0' }}>
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5b5c8c' }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg pl-10 pr-3 py-2.5 text-sm border outline-none transition focus:ring-2 focus:ring-[#6439ff]"
                style={{ background: '#0d1035', borderColor: '#333b72', color: '#e0e4ff' }}
              />
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: 'rgba(254,73,98,0.1)', color: '#fe4962' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: '#6439ff' }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </span>
            ) : (
              'Iniciar sesión en IOL'
            )}
          </button>
        </form>

        <p className="text-[10px] text-center mt-5" style={{ color: '#5b5c8c' }}>
          Las credenciales no se almacenan. Solo se mantiene la sesión activa durante el uso.
        </p>
      </div>
    </div>
  )
}
