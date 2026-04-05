/**
 * TC Histórico — consulta tipo de cambio ARS/USD para un período pasado.
 *
 * Fuentes:
 *  - Oficial: BCRA API (variable 4 = TC referencia BNA vendedor)
 *  - Blue:    Bluelytics API (dólar blue venta)
 */

export interface TCHistorico {
  period: string   // YYYY-MM
  oficial: number  // promedio mensual TC oficial BNA vendedor
  blue: number     // promedio mensual TC blue venta
  oficialFuente: string
  blueFuente: string
}

// ─── BCRA ─────────────────────────────────────────────────────────────────────

interface BCRAResult {
  fecha: string
  valor: number
}

async function fetchOficial(desde: string, hasta: string): Promise<number> {
  const url = `https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/4/${desde}/${hasta}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`BCRA ${res.status}`)
  const json = await res.json()
  const rows: BCRAResult[] = json.results ?? []
  if (!rows.length) return 0
  const avg = rows.reduce((s, r) => s + r.valor, 0) / rows.length
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
  // Calcular cuántos días pedir desde hoy hasta la fecha de inicio del período
  const daysBack = Math.ceil(
    (Date.now() - new Date(desde).getTime()) / (1000 * 60 * 60 * 24)
  ) + 31 // +31 para cubrir el mes completo

  const url = `https://api.bluelytics.com.ar/v2/evolution.json?days=${daysBack}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Bluelytics ${res.status}`)

  const data: BluelyticsEntry[] = await res.json()

  const inPeriod = data.filter(
    e => e.source === 'Blue' && e.date >= desde && e.date <= hasta
  )
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

  const [oficialResult, blueResult] = await Promise.allSettled([
    fetchOficial(desde, hasta),
    fetchBlue(desde, hasta),
  ])

  return {
    period,
    oficial: oficialResult.status === 'fulfilled' ? oficialResult.value : 0,
    blue: blueResult.status === 'fulfilled' ? blueResult.value : 0,
    oficialFuente: 'BCRA (Com. A 3500 — promedio mensual)',
    blueFuente: 'Bluelytics — promedio mensual venta',
  }
}
