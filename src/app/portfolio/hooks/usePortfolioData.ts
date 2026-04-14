'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  IOLPosition,
  IOLOperacion,
  PortfolioPosition,
  PositionGroup,
  PortfolioKPISummary,
  TIPO_LABELS,
} from '@/lib/iol-types'

interface DolarRate {
  blue_venta: number
  oficial_venta: number
}

interface UsePortfolioData {
  groups: PositionGroup[]
  kpis: PortfolioKPISummary | null
  isLoading: boolean
  error: string | null
  refetch: () => void
  getOperaciones: (simbolo: string) => Promise<IOLOperacion[]>
}

// Cache de tasas de dólar para no repetir fetches
const dolarCache = new Map<string, DolarRate>()

async function fetchDolarRate(day: string): Promise<DolarRate | null> {
  if (dolarCache.has(day)) return dolarCache.get(day)!

  // Intentar hasta 5 días atrás (feriados/fines de semana)
  for (let offset = 0; offset < 5; offset++) {
    const date = new Date(day)
    date.setDate(date.getDate() - offset)
    const dateStr = date.toISOString().split('T')[0]

    if (dolarCache.has(dateStr)) return dolarCache.get(dateStr)!

    try {
      const res = await fetch(`/api/dolar-historico?day=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        if (data.blue_venta) {
          const rate = { blue_venta: data.blue_venta, oficial_venta: data.oficial_venta }
          dolarCache.set(dateStr, rate)
          dolarCache.set(day, rate) // Cache also for the original date
          return rate
        }
      }
    } catch {
      // Try next day
    }
  }

  return null
}

function classifyTipo(position: IOLPosition): string {
  const tipo = (position.titulo?.tipo ?? '').toLowerCase()
  if (tipo.includes('cedear')) return 'cedears'
  if (tipo.includes('accion') || tipo.includes('accione')) return 'acciones'
  if (tipo.includes('bono') || tipo.includes('titulo_publico') || tipo.includes('letra')) return 'bonos'
  if (tipo.includes('fci') || tipo.includes('fondo')) return 'fci'
  if (tipo.includes('on') || tipo.includes('obligacion')) return 'on'
  if (tipo.includes('caucion')) return 'cauciones'
  return 'otros'
}

const LABEL_MAP: Record<string, string> = {
  acciones: 'Acciones',
  cedears: 'CEDEARs',
  bonos: 'Bonos',
  fci: 'FCI',
  on: 'Obligaciones Negociables',
  cauciones: 'Cauciones',
  otros: 'Otros',
}

export function usePortfolioData(isAuthenticated: boolean): UsePortfolioData {
  const [groups, setGroups] = useState<PositionGroup[]>([])
  const [kpis, setKpis] = useState<PortfolioKPISummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    setError(null)

    try {
      // Fetch portfolio y dólar de hoy en paralelo
      const [portfolioRes, dolarHoyRes] = await Promise.all([
        fetch('/api/iol/portafolio'),
        fetchDolarRate(new Date().toISOString().split('T')[0]),
      ])

      if (!portfolioRes.ok) {
        if (portfolioRes.status === 401) {
          setError('Sesión expirada')
          return
        }
        throw new Error('Error al obtener portfolio')
      }

      const rawPositions: IOLPosition[] = await portfolioRes.json()
      const dolarHoy = dolarHoyRes?.blue_venta ?? null

      // Fetch operaciones para calcular USD historical
      const opsRes = await fetch('/api/iol/operaciones?estado=terminadas')
      const allOps: IOLOperacion[] = opsRes.ok ? await opsRes.json() : []

      // Agrupar operaciones por símbolo
      const opsBySimbolo = new Map<string, IOLOperacion[]>()
      for (const op of allOps) {
        const key = op.simbolo
        if (!opsBySimbolo.has(key)) opsBySimbolo.set(key, [])
        opsBySimbolo.get(key)!.push(op)
      }

      // Para cada posición, calcular USD usando dólar histórico
      const positions: PortfolioPosition[] = []

      for (const pos of rawPositions) {
        const tipo = classifyTipo(pos)
        const ops = opsBySimbolo.get(pos.simbolo) ?? []
        const compras = ops.filter(o => o.tipo === 'Compra')

        // Calcular costo USD con dólar histórico por compra
        let costoUSD: number | null = null
        let dolarPromedioCompra: number | null = null

        if (compras.length > 0) {
          let totalCostoUSD = 0
          let totalMontoARS = 0
          let totalDolarPonderado = 0

          // Fetch dólar histórico para cada fecha única de compra
          const fechasUnicas = [...new Set(compras.map(c => c.fechaOrden.split('T')[0]))]
          const dolarPorFecha = new Map<string, number>()

          await Promise.all(
            fechasUnicas.map(async (fecha) => {
              const rate = await fetchDolarRate(fecha)
              if (rate) dolarPorFecha.set(fecha, rate.blue_venta)
            }),
          )

          for (const compra of compras) {
            const fecha = compra.fechaOrden.split('T')[0]
            const dolar = dolarPorFecha.get(fecha)
            if (dolar && compra.montoOperado > 0) {
              totalCostoUSD += compra.montoOperado / dolar
              totalMontoARS += compra.montoOperado
              totalDolarPonderado += dolar * compra.montoOperado
            }
          }

          if (totalMontoARS > 0) {
            costoUSD = totalCostoUSD
            dolarPromedioCompra = totalDolarPonderado / totalMontoARS
          }
        }

        const valorActualUSD = dolarHoy ? pos.valorizado / dolarHoy : null
        const plUSD = costoUSD !== null && valorActualUSD !== null ? valorActualUSD - costoUSD : null

        positions.push({
          simbolo: pos.simbolo,
          descripcion: pos.descripcion ?? pos.titulo?.descripcion ?? '',
          tipo,
          moneda: pos.titulo?.moneda ?? 'peso_Argentino',
          mercado: pos.titulo?.mercado ?? 'bCBA',
          cantidad: pos.cantidad,
          ppc: pos.ppc,
          precioActual: pos.ultimoPrecio,
          variacionDiaria: pos.variacionDiaria,
          valorizadoARS: pos.valorizado,
          plARS: pos.gananciaDinero,
          plPercent: pos.gananciaPorcentaje,
          dolarCompra: dolarPromedioCompra,
          costoUSD,
          valorActualUSD,
          plUSD,
        })
      }

      // Agrupar por tipo
      const groupMap = new Map<string, PortfolioPosition[]>()
      for (const pos of positions) {
        if (!groupMap.has(pos.tipo)) groupMap.set(pos.tipo, [])
        groupMap.get(pos.tipo)!.push(pos)
      }

      const sorted = ['cedears', 'acciones', 'bonos', 'fci', 'on', 'cauciones', 'otros']
      const resultGroups: PositionGroup[] = sorted
        .filter(tipo => groupMap.has(tipo))
        .map(tipo => {
          const posArr = groupMap.get(tipo)!
          const subtotalARS = posArr.reduce((s, p) => s + p.valorizadoARS, 0)
          const subtotalCostoARS = posArr.reduce((s, p) => s + (p.valorizadoARS - p.plARS), 0)
          const subtotalPL = posArr.reduce((s, p) => s + p.plARS, 0)
          const subtotalUSD = posArr.every(p => p.valorActualUSD !== null)
            ? posArr.reduce((s, p) => s + (p.valorActualUSD ?? 0), 0)
            : null
          const subtotalPLUSD = posArr.every(p => p.plUSD !== null)
            ? posArr.reduce((s, p) => s + (p.plUSD ?? 0), 0)
            : null

          return {
            tipo,
            label: LABEL_MAP[tipo] ?? tipo,
            positions: posArr,
            subtotalARS,
            subtotalCostoARS,
            subtotalPL,
            subtotalPLPercent: subtotalCostoARS > 0 ? (subtotalPL / subtotalCostoARS) * 100 : 0,
            subtotalUSD,
            subtotalPLUSD,
          }
        })

      setGroups(resultGroups)

      // Calcular KPIs
      const totalValueARS = positions.reduce((s, p) => s + p.valorizadoARS, 0)
      const totalCostARS = positions.reduce((s, p) => s + (p.valorizadoARS - p.plARS), 0)
      const totalValueUSD = positions.every(p => p.valorActualUSD !== null)
        ? positions.reduce((s, p) => s + (p.valorActualUSD ?? 0), 0)
        : null
      const totalCostUSD = positions.every(p => p.costoUSD !== null)
        ? positions.reduce((s, p) => s + (p.costoUSD ?? 0), 0)
        : null
      const plTotalARS = totalValueARS - totalCostARS
      const plTotalUSD = totalValueUSD !== null && totalCostUSD !== null ? totalValueUSD - totalCostUSD : null
      const plPercent = totalCostARS > 0 ? (plTotalARS / totalCostARS) * 100 : 0

      // Rendimiento vs dólar
      let rendimientoVsDolar: number | null = null
      let dolarAtStart: number | null = null

      if (allOps.length > 0 && dolarHoy) {
        // Encontrar la operación más vieja
        const fechas = allOps
          .map(o => o.fechaOrden.split('T')[0])
          .sort()
        const primeraFecha = fechas[0]
        const rateStart = await fetchDolarRate(primeraFecha)

        if (rateStart) {
          dolarAtStart = rateStart.blue_venta
          const dolarDeval = (dolarHoy / dolarAtStart) - 1
          const portfolioReturn = totalCostARS > 0 ? plTotalARS / totalCostARS : 0
          rendimientoVsDolar = ((1 + portfolioReturn) / (1 + dolarDeval) - 1) * 100
        }
      }

      setKpis({
        totalValueARS,
        totalCostARS,
        totalValueUSD,
        totalCostUSD,
        plTotalARS,
        plTotalUSD,
        plPercent,
        dolarAtStart,
        dolarNow: dolarHoy,
        rendimientoVsDolar,
      })
    } catch (err) {
      console.error('[usePortfolioData]', err)
      setError(err instanceof Error ? err.message : 'Error al cargar portfolio')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getOperaciones = useCallback(async (simbolo: string): Promise<IOLOperacion[]> => {
    try {
      const res = await fetch(`/api/iol/operaciones?simbolo=${encodeURIComponent(simbolo)}&estado=terminadas`)
      if (!res.ok) return []
      return res.json()
    } catch {
      return []
    }
  }, [])

  return { groups, kpis, isLoading, error, refetch: fetchData, getOperaciones }
}
