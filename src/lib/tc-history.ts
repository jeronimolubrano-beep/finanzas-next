/**
 * TC Histórico — consulta tipo de cambio ARS/USD para un período pasado.
 *
 * Fuentes:
 *  - Oficial: ArgentinaDatos API (mirror del BCRA, sin problemas de SSL)
 *             https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/{año}/{mes}
 *  - Blue:    Bluelytics API — dólar blue venta (promedio mensual)
 */

export interface TCHistorico {
  period: string
  oficial: number
  blue: number
  oficialFuente: string
  blueFuente: string
}

// ─── Oficial (ArgentinaDatos) ─────────────────────────────────────────────────

interface ArgentinaDatosCotizacion {
  fecha: string   // "YYYY-MM-DD"
  compra: number
  venta: number
}

async function fetchOficial(year: string, month: string): Promise<number> {
  const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/${year}/${month}`
  console.log('[TC Oficial] GET', url)

  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    console.error('[TC Oficial] Error', res.status, await res.text().catch(() => ''))
    throw new Error(`ArgentinaDatos ${res.status}`)
  }

  const data: ArgentinaDatosCotizacion[] = await res.json()
  console.log('[TC Oficial] Entradas:', data.length, '| muestra:', data[0])

  if (!Array.isArray(data) || !data.length) return 0

  const ventas = data.map(d => d.venta).filter(v => v > 0)
  if (!ventas.length) return 0

  const avg = ventas.reduce((s, v) => s + v, 0) / ventas.length
  return Math.round(avg * 100) / 100
}

// ─── Blue (Bluelytics) ────────────────────────────────────────────────────────

interface BluelyticsEntry {
  date: string
  source: 'Blue' | 'Oficial'
  value_buy: number
  value_sell: number
}

async function fetchBlue(desde: string, hasta: string): Promise<number> {
  // Sin ?days para traer todo el histórico disponible y filtrar por fecha
  const url = 'https://api.bluelytics.com.ar/v2/evolution.json'
  console.log('[TC Blue] GET', url, '→ filtrando', desde, '-', hasta)

  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    console.error('[TC Blue] Error', res.status)
    throw new Error(`Bluelytics ${res.status}`)
  }

  const data: BluelyticsEntry[] = await res.json()
  console.log('[TC Blue] Total entradas:', data.length, '| rango:', data[data.length - 1]?.date, '→', data[0]?.date)

  const inPeriod = data.filter(
    e => e.source === 'Blue' && e.date >= desde && e.date <= hasta
  )
  console.log('[TC Blue] En período:', inPeriod.length)

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

  console.log('[TC Histórico] Período:', period)

  const [oficialResult, blueResult] = await Promise.allSettled([
    fetchOficial(year, month),
    fetchBlue(desde, hasta),
  ])

  if (oficialResult.status === 'rejected') console.error('[TC Oficial] Falló:', oficialResult.reason)
  if (blueResult.status === 'rejected')   console.error('[TC Blue] Falló:', blueResult.reason)

  return {
    period,
    oficial: oficialResult.status === 'fulfilled' ? oficialResult.value : 0,
    blue:    blueResult.status    === 'fulfilled' ? blueResult.value    : 0,
    oficialFuente: 'ArgentinaDatos — BNA vendedor, promedio mensual',
    blueFuente:    'Bluelytics — blue venta, promedio mensual',
  }
}
