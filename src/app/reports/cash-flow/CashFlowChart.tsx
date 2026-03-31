'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { formatMoney } from '@/lib/utils'

interface DayPoint {
  day: number
  balance: number
}

interface Props {
  data: DayPoint[]
}

function fmtY(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function CashFlowChart({ data }: Props) {
  const finalBalance = data.length > 0 ? data[data.length - 1].balance : 0
  const color = finalBalance >= 0 ? '#059669' : '#dc2626'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cfGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#8b8ec0' }}
          axisLine={{ stroke: '#e8e8f0' }}
          tickLine={false}
          label={{ value: 'Día', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#8b8ec0' }}
        />
        <YAxis
          tickFormatter={fmtY}
          tick={{ fontSize: 11, fill: '#8b8ec0' }}
          axisLine={{ stroke: '#e8e8f0' }}
          tickLine={false}
          width={65}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #e8e8f0',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#06083f',
          }}
          formatter={(value) => {
            const n = Number(value)
            return [`$${formatMoney(Math.abs(n))}${n < 0 ? ' (negativo)' : ''}`, 'Saldo acumulado'] as [string, string]
          }}
          labelFormatter={(day) => `Día ${day}`}
        />
        <ReferenceLine y={0} stroke="#e0e0ef" strokeDasharray="4 2" />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={color}
          strokeWidth={2}
          fill="url(#cfGradient)"
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
