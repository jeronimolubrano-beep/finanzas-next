// Wrapper liviano para la API de InvertirOnline (IOL)
// Usa fetch nativo, sin dependencias externas

import type { IOLToken, IOLPosition, IOLOperacion } from './iol-types'

const IOL_BASE = 'https://api.invertironline.com'

export class IOLError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'IOLError'
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function iolLogin(username: string, password: string): Promise<IOLToken> {
  const res = await fetch(`${IOL_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&grant_type=password`,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new IOLError(
      text || 'Error de autenticación en IOL',
      res.status,
      'AUTH_FAILED',
    )
  }

  return res.json()
}

export async function iolRefresh(refreshToken: string): Promise<IOLToken> {
  const res = await fetch(`${IOL_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`,
  })

  if (!res.ok) {
    throw new IOLError('No se pudo renovar la sesión', res.status, 'REFRESH_FAILED')
  }

  return res.json()
}

// ─── Generic Fetcher ─────────────────────────────────────────────────────────

async function iolFetch<T>(
  path: string,
  token: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path, IOL_BASE)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new IOLError(
      text || `Error IOL: ${res.status}`,
      res.status,
    )
  }

  return res.json()
}

// ─── Typed Endpoints ─────────────────────────────────────────────────────────

export async function getPortfolio(token: string, pais = 'argentina'): Promise<IOLPosition[]> {
  const data = await iolFetch<{ activos: IOLPosition[] }>(
    `/api/v2/portafolio/${pais}`,
    token,
  )
  return data.activos ?? []
}

export interface OperacionesFilter {
  simbolo?: string
  desde?: string // YYYY-MM-DD
  hasta?: string // YYYY-MM-DD
  estado?: string
}

export async function getOperaciones(
  token: string,
  filters: OperacionesFilter = {},
): Promise<IOLOperacion[]> {
  const params: Record<string, string | undefined> = {
    'filtro.simbolo': filters.simbolo,
    'filtro.fechaDesde': filters.desde,
    'filtro.fechaHasta': filters.hasta,
    'filtro.estado': filters.estado,
  }

  return iolFetch<IOLOperacion[]>('/api/v2/operaciones', token, params)
}

export interface SerieHistoricaPoint {
  fecha: string
  apertura: number
  maximo: number
  minimo: number
  cierre: number
  volumen: number
  montoOperado: number
}

export async function getSerieHistorica(
  token: string,
  mercado: string,
  simbolo: string,
  desde: string,
  hasta: string,
  ajustada = 'ajustada',
): Promise<SerieHistoricaPoint[]> {
  return iolFetch<SerieHistoricaPoint[]>(
    `/api/v2/${mercado}/Titulos/${simbolo}/Cotizacion/seriehistorica/${desde}/${hasta}/${ajustada}`,
    token,
  )
}

export async function getEstadoCuenta(token: string) {
  return iolFetch<{ cuentas: unknown[] }>('/api/v2/estadocuenta', token)
}
