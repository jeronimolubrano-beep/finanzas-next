'use client'

import { useState } from 'react'
import { DashboardCharts } from './DashboardCharts'
import { KPICard, type DeltaBadge } from '@/components/KPICard'
import { formatMoney, formatMoney0 } from '@/lib/utils'
import type { BurnRateResult, RunwayResult } from '@/lib/metrics'

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
  // MoM deltas
  momIncome?:  DeltaBadge
  momExpense?: DeltaBadge
  momNet?:     DeltaBadge
  momSavings?: DeltaBadge
  // Burn rate & runway
  burn3:   BurnRateResult
  burn6:   BurnRateResult
  burn12:  BurnRateResult
  runway:  RunwayResult
}

const fmtArs = (n: number) => `$${formatMoney0(n)}`
const fmtUsd = (n: number) =>
  `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

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
  momIncome,
  momExpense,
  momNet,
  momSavings,
  burn3,
  burn6,
  burn12,
  runway,
}: DashboardTabsProps) {
  const [burnWindow, setBurnWindow] = useState<'3' | '6' | '12'>('3')

  const burnMap = { '3': burn3, '6': burn6, '12': burn12 }
  const activeBurn = burnMap[burnWindow]

  // Runway color
  const runwayColor =
    runway.months === null        ? 'blue' :
    runway.months > 6            ? 'green' :
    runway.months > 3            ? 'yellow' : 'red'

  const runwayValue = runway.months !== null
    ? `${runway.months.toFixed(1)} meses`
    : 'Sin datos'

  const runwaySubtitle = runway.cashArs === 0
    ? 'Registrá posición de caja en Configuración'
    : `Caja: $${formatMoney0(runway.cashArs)}`

  return (
    <div>
      {/* ── Main KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <KPICard
          dark
          title="Ingresos"
          value={`$${formatMoney(income)}`}
          color="green"
          usdValue={hasTC ? `$${(income / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined}
          delta={momIncome}
        />
        <KPICard
          dark
          title="Gastos"
          value={`$${formatMoney(expense)}`}
          color="red"
          usdValue={hasTC ? `$${(expense / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined}
          delta={momExpense}
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
          delta={momNet}
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
          delta={momSavings}
        />
      </div>

      {/* ── Gasto mensual promedio & Meses de caja ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Gasto mensual promedio card */}
        <div
          className="rounded-xl p-4 border transition-all hover:scale-[1.01]"
          style={{
            background: 'var(--dash-card)',
            borderColor: 'var(--dash-border)',
            boxShadow: '0 0 20px rgba(249,115,22,0.12)',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--dash-text)' }}>
            Gasto mensual promedio
          </p>
          <p className="text-xl lg:text-2xl font-bold" style={{ color: '#f97316' }}>
            {fmtArs(activeBurn.ars)}
            <span className="text-sm font-normal ml-1" style={{ color: '#8b8ec0' }}>/mes</span>
          </p>
          {activeBurn.usd !== null && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#6439ff' }}>
              {fmtUsd(activeBurn.usd)}/mes
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
            Promedio últimos {burnWindow} meses completos
          </p>
          {/* Window selector */}
          <div className="flex gap-1.5 mt-3">
            {(['3', '6', '12'] as const).map(w => (
              <button
                key={w}
                onClick={() => setBurnWindow(w)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border transition"
                style={
                  burnWindow === w
                    ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                    : { color: '#8b8ec0', borderColor: '#333b72', background: 'transparent' }
                }
              >
                {w}m
              </button>
            ))}
          </div>
          <div className="mt-3 h-0.5 rounded-full" style={{ background: 'linear-gradient(to right, #f97316, transparent)' }} />
        </div>

        {/* Meses de caja card */}
        <KPICard
          dark
          title="Meses de caja"
          value={runwayValue}
          color={runwayColor}
          subtitle={runwaySubtitle}
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
