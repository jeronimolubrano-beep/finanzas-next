/**
 * TC Histórico — consulta tipo de cambio ARS/USD para un período pasado.
 *
 * Fuente única: Bluelytics API (evolution.json)
 * Devuelve entradas con source: 'Blue' | 'Oficial' — un solo fetch para ambas.
 * https://api.bluelytics.com.ar/v2/evolution.json
 */

export interface TCHistorico {
  period: string
  oficial: number  // promedio mensual BNA vendedor
  blue: number     // promedio mensual blue venta
  oficialFuente: string
  blueFuente: string
}

interface BluelyticsEntry {
  date: string              // "YYYY-MM-DD"
  source: 'Blue' | 'Oficial'
  value_buy: number
  value_sell: number
}

export async function getTCHistorico(period: string): Promise<TCHistorico> {
  const [year, month] = period.split('-')
  const desde = `${year}-${month}-01`
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
  const hasta = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  console.log('[TC Histórico] Período:', period, '→', desde, hasta)

  const res = await fetch('https://api.bluelytics.com.ar/v2/evolution.json', {
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Bluelytics ${res.status}`)

  const data: BluelyticsEntry[] = await res.json()
  console.log('[TC Histórico] Total entradas:', data.length)

  const avg = (source: 'Blue' | 'Oficial') => {
    const rows = data.filter(e => e.source === source && e.date >= desde && e.date <= hasta)
    console.log(`[TC ${source}] Entradas en período:`, rows.length)
    if (!rows.length) return 0
    return Math.round(rows.reduce((s, e) => s + e.value_sell, 0) / rows.length * 100) / 100
  }

  return {
    period,
    oficial: avg('Oficial'),
    blue:    avg('Blue'),
    oficialFuente: 'Bluelytics — BNA vendedor, promedio mensual',
    blueFuente:    'Bluelytics — blue venta, promedio mensual',
  }
}
