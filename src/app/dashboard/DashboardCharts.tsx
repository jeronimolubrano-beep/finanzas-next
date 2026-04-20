'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  Area, AreaChart
} from 'recharts'

interface MonthlyData {
  month: string
  ingresos: number
  gastos: number
  neto: number
}

interface CategoryData {
  name: string
  value: number
}

interface Props {
  monthlyData: MonthlyData[]
  categoryData: CategoryData[]
}

const COLORS = ['#6439ff', '#2edbc1', '#fe4962', '#f59e0b', '#8b6fff', '#06b6d4', '#f97316', '#ec4899']

function formatARS(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatTooltip(value: unknown): string {
  return formatARS(Number(value))
}

const darkTooltipStyle = {
  backgroundColor: '#232a5c',
  border: '1px solid #333b72',
  borderRadius: '8px',
  color: '#d0d4f0',
  fontSize: '12px',
}

export function DashboardCharts({ monthlyData, categoryData }: Props) {
  return (
    <div className="grid lg:grid-cols-3 gap-5 mt-6">
      {/* Grafico de barras — Ingresos vs Gastos */}
      <div className="lg:col-span-2 rounded-xl p-5 border"
           style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>
          Ingresos vs Gastos por mes
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8b8ec0' }} axisLine={{ stroke: '#252966' }} tickLine={false} />
            <YAxis tickFormatter={formatARS} tick={{ fontSize: 11, fill: '#8b8ec0' }} axisLine={{ stroke: '#252966' }} tickLine={false} width={55} />
            <Tooltip contentStyle={darkTooltipStyle} cursor={{ fill: 'rgba(100,57,255,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8b8ec0' }} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#2edbc1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" name="Gastos" fill="#fe4962" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grafico de torta — Gastos por categoria */}
      <div className="rounded-xl p-5 border"
           style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>
          Gastos por categoria
        </h2>
        {categoryData.length > 0 ? (() => {
          const total = categoryData.reduce((s, c) => s + c.value, 0)
          const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '0%'
          return (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--dash-bg)"
                    strokeWidth={2}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={darkTooltipStyle}
                    formatter={(value: number, name: string) => [
                      `${pct(value)} · ${formatARS(value)}`,
                      name,
                    ] as [string, string]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {categoryData.slice(0, 5).map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate max-w-[110px]" style={{ color: '#8b8ec0' }}>{c.name}</span>
                    </div>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--dash-text)' }}>
                      {pct(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )
        })() : (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#5b5c8c' }}>
            Sin datos de gastos
          </div>
        )}
      </div>

      {/* Grafico — Flujo neto (línea) */}
      <div className="lg:col-span-3 rounded-xl p-5 border"
           style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>
          Flujo neto mensual
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="netoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6439ff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6439ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8b8ec0' }} axisLine={{ stroke: 'var(--dash-border)' }} tickLine={false} />
            <YAxis tickFormatter={formatARS} tick={{ fontSize: 11, fill: '#8b8ec0' }} axisLine={{ stroke: 'var(--dash-border)' }} tickLine={false} width={55} />
            <Tooltip contentStyle={darkTooltipStyle} formatter={formatTooltip} />
            <Area
              type="monotone"
              dataKey="neto"
              name="Flujo neto"
              stroke="#6439ff"
              strokeWidth={2.5}
              fill="url(#netoGradient)"
              dot={{ fill: '#6439ff', strokeWidth: 0, r: 3 }}
              activeDot={{ fill: '#8b6fff', strokeWidth: 0, r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
