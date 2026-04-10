'use client'

import { DashboardCharts } from './DashboardCharts'
import { KPICard } from '@/components/KPICard'
import { formatMoney } from '@/lib/utils'

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

interface Business {
  id: number
  name: string
}

interface DashboardTabsProps {
  monthlyData: MonthlyData[]
  categoryData: CategoryData[]
  income: number
  expense: number
  net: number
  savingsRate: number
  topExpenseCat: string
  topExpenseTotal: number
  tcRate: number
  tcType: string
  tcDate: string
  hasTC: boolean
  period: string
}

export function DashboardTabs({
  monthlyData,
  categoryData,
  income,
  expense,
  net,
  savingsRate,
  topExpenseCat,
  topExpenseTotal,
  tcRate,
  tcType,
  tcDate,
  hasTC,
  period,
}: DashboardTabsProps) {


  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <KPICard
          dark
          title="Ingresos"
          value={`$${formatMoney(income)}`}
          color="green"
          usdValue={hasTC ? `$${(income / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined}
        />
        <KPICard
          dark
          title="Gastos"
          value={`$${formatMoney(expense)}`}
          color="red"
          usdValue={hasTC ? `$${(expense / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined}
        />
        <KPICard
          dark
          title="Flujo neto"
          value={`${net >= 0 ? '+' : ''}$${formatMoney(net)}`}
          color={net >= 0 ? 'green' : 'red'}
          usdValue={
            hasTC
              ? `${net >= 0 ? '+' : ''}$${(Math.abs(net) / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : undefined
          }
        />
        <KPICard
          dark
          title="Mayor gasto"
          value={topExpenseCat}
          color="orange"
          subtitle={`$${formatMoney(topExpenseTotal)}`}
        />
        <KPICard
          dark
          title="Tasa de ahorro"
          value={`${savingsRate.toFixed(1)}%`}
          color={savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'yellow' : 'red'}
        />
      </div>

      {/* TC + Metrics */}
      <div className="flex flex-wrap items-center gap-4 mb-5 px-1">
        {hasTC && (
          <span className="text-xs" style={{ color: '#8b8ec0' }}>
            TC {tcType}: <span className="font-semibold text-white">${tcRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="ml-1 opacity-60">({tcDate})</span>
          </span>
        )}
      </div>

      {/* Charts */}
      <DashboardCharts monthlyData={monthlyData} categoryData={categoryData} />
    </div>
  )
}
