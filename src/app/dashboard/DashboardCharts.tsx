'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
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

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899']

function formatARS(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function DashboardCharts({ monthlyData, categoryData }: Props) {
  return (
    <div className="grid lg:grid-cols-3 gap-6 mt-6">
      {/* Grafico de barras — Ingresos vs Gastos */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos vs Gastos por mes</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatARS} tick={{ fontSize: 11 }} width={55} />
            <Tooltip
              formatter={(value: number) =>
                `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grafico de torta — Gastos por categoria */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Gastos por categoria</h2>
        {categoryData.length > 0 ? (
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
                >
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {categoryData.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600 truncate max-w-[110px]">{c.name}</span>
                  </div>
                  <span className="text-gray-500 font-medium">{formatARS(c.value)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Sin datos de gastos
          </div>
        )}
      </div>

      {/* Grafico de linea — Flujo neto */}
      <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Flujo neto mensual</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatARS} tick={{ fontSize: 11 }} width={55} />
            <Tooltip
              formatter={(value: number) =>
                `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
              }
            />
            <Bar
              dataKey="neto"
              name="Flujo neto"
              radius={[3, 3, 0, 0]}
              fill="#3b82f6"
            >
              {monthlyData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.neto >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
