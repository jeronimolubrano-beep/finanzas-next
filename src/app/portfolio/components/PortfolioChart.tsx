'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PositionGroup } from '@/lib/iol-types'
import { formatMoney } from '@/lib/utils'

const COLORS = ['#6439ff', '#2edbc1', '#fe4962', '#f59e0b', '#3b82f6', '#a855f7']

interface Props {
  groups: PositionGroup[]
}

export function PortfolioChart({ groups }: Props) {
  const data = groups
    .filter(g => g.subtotalARS > 0)
    .map(g => ({ name: g.label, value: g.subtotalARS }))

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
      >
        <p className="text-sm" style={{ color: '#8b8ec0' }}>Sin datos para graficar</p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
    >
      <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: '#8b8ec0' }}>
        Composición de Cartera
      </h3>
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex-shrink-0">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
                  '',
                ]}
                contentStyle={{
                  backgroundColor: '#232a5c',
                  border: '1px solid #333b72',
                  borderRadius: '8px',
                  color: '#d0d4f0',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 min-w-[180px] space-y-3">
          {data.map((entry, index) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0
            return (
              <div key={entry.name} className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs flex-1" style={{ color: '#d0d4f0' }}>
                  {entry.name}
                </span>
                <span className="text-xs tabular-nums" style={{ color: '#8b8ec0' }}>
                  {pct.toFixed(1)}%
                </span>
                <span className="text-xs font-semibold tabular-nums w-28 text-right" style={{ color: '#d0d4f0' }}>
                  ${formatMoney(entry.value)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
