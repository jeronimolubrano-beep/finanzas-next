// Token store en memoria del servidor para sesiones IOL
// Los tokens NUNCA se persisten en base de datos — solo viven en RAM

import type { IOLToken } from './iol-types'
import { iolRefresh } from './iol-client'

interface StoredSession {
  token: IOLToken
  expiresAt: number // timestamp ms
}

const sessions = new Map<string, StoredSession>()

// Limpiar sesiones expiradas cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (session.expiresAt < now) {
        sessions.delete(id)
      }
    }
  }, 5 * 60 * 1000)
}

export function storeToken(sessionId: string, token: IOLToken): void {
  sessions.set(sessionId, {
    token,
    expiresAt: Date.now() + token.expires_in * 1000,
  })
}

export function getToken(sessionId: string): IOLToken | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId)
    return null
  }
  return session.token
}

export function isAuthenticated(sessionId: string): boolean {
  return getToken(sessionId) !== null
}

export function removeToken(sessionId: string): void {
  sessions.delete(sessionId)
}

/**
 * Renueva el token si queda menos de 2 minutos para que expire.
 * Retorna el access_token actual (renovado o no), o null si falló.
 */
export async function refreshIfNeeded(sessionId: string): Promise<string | null> {
  const session = sessions.get(sessionId)
  if (!session) return null

  const timeLeft = session.expiresAt - Date.now()

  // Si queda más de 2 min, usar el token actual
  if (timeLeft > 2 * 60 * 1000) {
    return session.token.access_token
  }

  // Intentar renovar
  try {
    const newToken = await iolRefresh(session.token.refresh_token)
    storeToken(sessionId, newToken)
    return newToken.access_token
  } catch {
    // Refresh falló — eliminar sesión
    sessions.delete(sessionId)
    return null
  }
}

/**
 * Obtiene el access_token listo para usar (refrescando si es necesario).
 * Retorna null si no hay sesión o la renovación falló.
 */
export async function getAccessToken(sessionId: string): Promise<string | null> {
  const token = getToken(sessionId)
  if (!token) return null
  return refreshIfNeeded(sessionId)
}
