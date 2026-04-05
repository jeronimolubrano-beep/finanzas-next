/**
 * TC Histórico — consulta tipo de cambio ARS/USD para un período pasado.
 *
 * Fuentes:
 *  - Oficial: BCRA API (variable 4 = TC referencia BNA vendedor)
 *  - Blue:    Bluelytics API (dólar blue venta)
 */

export interface TCHistorico {
  period: string
  oficial: number
  blue: number
  oficialFuente: string
  blueFuente: string
}

// ─── BCRA ─────────────────────────────────────────────────────────────────────

async function fetchOficial(desde: string, hasta: string): Promise<number> {
  // Variable 4 = Tipo de cambio de referencia (BNA vendedor, Com. A 3500)
  const url = `https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/4/${desde}/${hasta}`
  console.log('[TC BCRA] GET', url)

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'finanzas-next/1.0',
    },
    // No cache para datos históricos puntuales
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[TC BCRA] Error', res.status, body.slice(0, 200))
    throw new Error(`BCRA ${res.status}`)
  }

  const json = await res.json()
  console.log('[TC BCRA] Respuesta:', JSON.stringify(json).slice(0, 300))

  // La respuesta puede estar en json.results o json.data o ser el array directamente
  const rows: { fecha?: string; valor?: number; value?: number }[] =
    json.results ?? json.data ?? (Array.isArray(json) ? json : [])

  if (!rows.length) {
    console.warn('[TC BCRA] Sin datos para el período', desde, hasta)
    return 0
  }

  const valores = rows.map(r => r.valor ?? r.value ?? 0).filter(v => v > 0)
  if (!valores.length) return 0

  const avg = valores.reduce((s, v) => s + v, 0) / valores.length
  return Math.round(avg * 100) / 100
}

// ─── Bluelytics ───────────────────────────────────────────────────────────────

interface BluelyticsEntry {
  date: string
  source: 'Blue' | 'Oficial'
  value_buy: number
  value_sell: number
}

async function fetchBlue(desde: string, hasta: string): Promise<number> {
  // Sin parámetro `days` para obtener TODO el histórico disponible
  // (con days=N la API limita y puede no llegar a fechas antiguas)
  const url = 'https://api.bluelytics.com.ar/v2/evolution.json'
  console.log('[TC Bluelytics] GET', url, '| filtrando', desde, '-', hasta)

  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    console.error('[TC Bluelytics] Error', res.status)
    throw new Error(`Bluelytics ${res.status}`)
  }

  const data: BluelyticsEntry[] = await res.json()
  console.log('[TC Bluelytics] Total entradas:', data.length, '| primera:', data[0]?.date, '| última:', data[data.length - 1]?.date)

  const inPeriod = data.filter(
    e => e.source === 'Blue' && e.date >= desde && e.date <= hasta
  )
  console.log('[TC Bluelytics] Entradas en período:', inPeriod.length)

  if (!inPeriod.length) return 0

  const avg = inPeriod.reduce((s, e) => s + e.value_sell, 0) / inPeriod.length
  return Math.round(avg * 100) / 100
}

// ─── Principal ────────────────────────────────────────────────────────────────

export async function getTCHistorico(period: string): Promise<TCHistorico> {
  const [year, month] = period.split('-')
  const desde = `${year}-${month}-01`
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
  const hasta = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  console.log('[TC Histórico] Período:', period, '| Desde:', desde, '| Hasta:', hasta)

  const [oficialResult, blueResult] = await Promise.allSettled([
    fetchOficial(desde, hasta),
    fetchBlue(desde, hasta),
  ])

  if (oficialResult.status === 'rejected') console.error('[TC Oficial] Falló:', oficialResult.reason)
  if (blueResult.status === 'rejected') console.error('[TC Blue] Falló:', blueResult.reason)

  return {
    period,
    oficial: oficialResult.status === 'fulfilled' ? oficialResult.value : 0,
    blue: blueResult.status === 'fulfilled' ? blueResult.value : 0,
    oficialFuente: 'BCRA (Com. A 3500 — promedio mensual)',
    blueFuente: 'Bluelytics — promedio mensual venta',
  }
}
