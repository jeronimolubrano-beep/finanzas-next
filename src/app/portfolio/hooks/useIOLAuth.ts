'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseIOLAuth {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

export function useIOLAuth(): UseIOLAuth {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Chequear si hay sesión activa al montar
  useEffect(() => {
    // Primero chequeamos la cookie client-side como optimización
    const hasLoginCookie = document.cookie.includes('iol_logged_in=1')
    if (!hasLoginCookie) {
      setIsLoading(false)
      return
    }

    // Verificar que el token server-side todavía funciona
    fetch('/api/iol/portafolio')
      .then(res => {
        setIsAuthenticated(res.ok)
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/iol/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error de autenticación' }))
        setError(data.error || 'Credenciales incorrectas')
        setIsAuthenticated(false)
        return false
      }

      setIsAuthenticated(true)
      return true
    } catch {
      setError('Error de conexión')
      setIsAuthenticated(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/iol/logout', { method: 'POST' })
    } catch {
      // silently ignore
    }
    setIsAuthenticated(false)
    setError(null)
  }, [])

  return { isAuthenticated, isLoading, error, login, logout }
}
