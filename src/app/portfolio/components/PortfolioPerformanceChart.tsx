'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import type { PortfolioPosition } from '@/lib/iol-types'

type Period = 'ytd' | '6m' | '1y' | 'max'

interface Props {
  positions: PortfolioPosition[]
}

interface DataPoint {
  date: string
  value: number
}

function getPeriodDates(period: Period): { from: string; to: string } {
  const to = new Date()
  const from = new Date()

  switch (period) {
    case 'ytd':
      from.setMonth(0)
      from.setDate(1)
      break
    case '6m':
      from.setMonth(from.getMonth() - 6)
      break
    case '1y':
      from.setFullYear(from.getFullYear() - 1)
      break
    case 'max':
      from.setFullYear(from.getFullYear() - 5)
      break
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'ytd', label: 'YTD' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1A' },
  { key: 'max', label: 'Max' },
]

export function PortfolioPerformanceChart({ positions }: Props) {
  const [period, setPeriod] = useState<Period>('ytd')
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (positions.length === 0) return

    const { from, to } = getPeriodDates(period)
    setLoading(true)
    setData([])

    Promise.all(
      positions.map(async pos => {
        try {
          const params = new URLSearchParams({
            mercado: pos.mercado || 'bCBA',
            simbolo: pos.simbolo,
            from,
            to,
          })
          const res = await fetch(`/api/iol/serie-historica?${params}`)
          if (!res.ok) return null
          const series: Array<{ fecha: string; ultimoPrecio?: number; cierre?: number }> =
            await res.json()
          return { pos, series }
        } catch {
          return null
        }
      }),
    )
      .then(results => {
        const valid = results.filter(Boolean) as Array<{
          pos: PortfolioPosition
          series: Array<{ fecha: string; ultimoPrecio?: number; cierre?: number }>
        }>

        if (valid.length === 0) return

        // Build date → total value map
        const dateMap = new Map<string, number>()

        for (const { pos, series } of valid) {
          for (const point of series) {
            const dateKey = point.fecha.split('T')[0]
            const price = point.cierre ?? point.ultimoPrecio ?? 0
            const value = price * pos.cantidad
            dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + value)
          }
        }

        const sorted = Array.from(dateMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))

        setData(sorted)
      })
      .finally(() => setLoading(false))
  }, [positions, period])

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>
          Evolución del Portfolio
        </h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg transition"
              style={{
                background: period === p.key ? '#6439ff' : 'transparent',
                color: period === p.key ? '#fff' : '#8b8ec0',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center h-[220px] gap-2"
          style={{ color: '#8b8ec0' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando datos históricos...</span>
        </div>
      ) : data.length === 0 ? (
        <div
          className="flex items-center justify-center h-[220px]"
          style={{ color: '#8b8ec0' }}
        >
          <span className="text-sm">Sin datos para este período</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6439ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6439ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333b72" strokeOpacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: '#8b8ec0' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 11, fill: '#8b8ec0' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value) => [
                `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                'Valor',
              ]}
              labelFormatter={formatDateLabel}
              contentStyle={{
                backgroundColor: '#232a5c',
                border: '1px solid #333b72',
                borderRadius: '8px',
                color: '#d0d4f0',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6439ff"
              strokeWidth={2.5}
              fill="url(#perfGradient)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
