'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardCharts } from './DashboardCharts'
import { KPICard } from '@/components/KPICard'
import { PendingTable } from '@/components/dashboard/PendingTable'
import { formatMoney, daysUntilDue } from '@/lib/utils'
import { TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react'

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

interface Transaction {
  id: number
  description: string
  amount: number
  type: 'income' | 'expense'
  due_date: string | null
  categories?: { name: string } | null
  businesses?: { name: string } | null
}

interface DashboardTabsProps {
  currentTab: 'overview' | 'pending'
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
  pendingTxs: Transaction[]
  businesses: Business[]
  period: string
  businessFilter?: string
}

export function DashboardTabs({
  currentTab,
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
  pendingTxs,
  businesses,
  period,
  businessFilter,
}: DashboardTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTabChange = (tab: 'overview' | 'pending') => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    router.push(`/dashboard?${params.toString()}`)
  }

  // Split pending into income/expense
  const cobrar = pendingTxs.filter(t => t.type === 'income')
  const pagar = pendingTxs.filter(t => t.type === 'expense')
  const totalCobrar = cobrar.reduce((s, t) => s + Number(t.amount), 0)
  const totalPagar = pagar.reduce((s, t) => s + Number(t.amount), 0)

  // Alerts
  const today = new Date().toISOString().slice(0, 10)
  const overdueItems = pendingTxs.filter(t => t.due_date && t.due_date < today)
  const soonItems = pendingTxs.filter(
    t => t.due_date && t.due_date >= today && daysUntilDue(t.due_date) <= 7
  )

  return (
    <div>
      {/* Tab Selector */}
      <div className="flex gap-4 mb-6 border-b" style={{ borderColor: '#e8e8f0' }}>
        <button
          onClick={() => handleTabChange('overview')}
          className="px-4 py-3 text-sm font-medium transition border-b-2 -mb-[1px]"
          style={{
            color: currentTab === 'overview' ? '#6439ff' : '#8b8ec0',
            borderColor: currentTab === 'overview' ? '#6439ff' : 'transparent',
            background: currentTab === 'overview' ? 'rgba(100,57,255,0.05)' : 'transparent',
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => handleTabChange('pending')}
          className="px-4 py-3 text-sm font-medium transition border-b-2 -mb-[1px]"
          style={{
            color: currentTab === 'pending' ? '#6439ff' : '#8b8ec0',
            borderColor: currentTab === 'pending' ? '#6439ff' : 'transparent',
            background: currentTab === 'pending' ? 'rgba(100,57,255,0.05)' : 'transparent',
          }}
        >
          Pagos Pendientes
        </button>
      </div>

      {/* Overview Tab */}
      {currentTab === 'overview' && (
        <div>
          {/* Alertas de pagos urgentes */}
          {(overdueItems.length > 0 || soonItems.length > 0) && (
            <div className="space-y-2 mb-6">
              {overdueItems.length > 0 && (
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition border"
                  style={{
                    background: 'rgba(254,73,98,0.1)',
                    borderColor: 'rgba(254,73,98,0.3)',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fe4962' }} />
                  <span className="text-sm font-medium flex-1" style={{ color: '#fe4962' }}>
                    Tenés {overdueItems.length} pago{overdueItems.length > 1 ? 's' : ''} vencido
                    {overdueItems.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => handleTabChange('pending')}
                    className="text-xs hover:opacity-80 transition"
                    style={{ color: '#fe4962' }}
                  >
                    Ver →
                  </button>
                </div>
              )}
              {soonItems.length > 0 && (
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition border"
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    borderColor: 'rgba(245,158,11,0.3)',
                  }}
                >
                  <Clock className="w-4 h-4 shrink-0 text-yellow-400" />
                  <span className="text-sm font-medium flex-1 text-yellow-400">
                    Tenés {soonItems.length} pago{soonItems.length > 1 ? 's' : ''} que vence
                    {soonItems.length > 1 ? 'n' : ''} esta semana
                  </span>
                  <button
                    onClick={() => handleTabChange('pending')}
                    className="text-xs hover:opacity-80 transition text-yellow-400"
                  >
                    Ver →
                  </button>
                </div>
              )}
            </div>
          )}

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
              title="Total a cobrar"
              value={`$${formatMoney(totalCobrar)}`}
              subtitle={`${cobrar.length} pendiente(s)`}
              color="yellow"
              usdValue={hasTC ? `$${(totalCobrar / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined}
            />
            <KPICard
              dark
              title="Total a pagar"
              value={`$${formatMoney(totalPagar)}`}
              subtitle={`${pagar.length} pendiente(s)`}
              color="orange"
              usdValue={hasTC ? `$${(totalPagar / tcRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined}
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
            <span className="text-xs" style={{ color: '#8b8ec0' }}>
              Tasa de ahorro:{' '}
              <span
                className="font-semibold"
                style={{
                  color: savingsRate >= 20 ? '#2edbc1' : savingsRate >= 0 ? '#f59e0b' : '#fe4962',
                }}
              >
                {savingsRate.toFixed(1)}%
              </span>
            </span>
            <span className="text-xs" style={{ color: '#8b8ec0' }}>
              Mayor gasto: <span className="font-semibold text-white">{topExpenseCat}</span>
              <span className="ml-1 opacity-60">(${formatMoney(topExpenseTotal)})</span>
            </span>
          </div>

          {/* Charts */}
          <DashboardCharts monthlyData={monthlyData} categoryData={categoryData} />
        </div>
      )}

      {/* Pending Payments Tab */}
      {currentTab === 'pending' && (
        <div>
          {/* Alerts */}
          {(overdueItems.length > 0 || soonItems.length > 0) && (
            <div className="space-y-2 mb-6">
              {overdueItems.length > 0 && (
                <div
                  className="flex items-center gap-2 rounded-lg px-4 py-3 border"
                  style={{
                    background: 'rgba(254,73,98,0.05)',
                    borderColor: 'rgba(254,73,98,0.2)',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fe4962' }} />
                  <span className="text-sm font-medium" style={{ color: '#fe4962' }}>
                    {overdueItems.length} pago{overdueItems.length > 1 ? 's' : ''} vencido
                    {overdueItems.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {soonItems.length > 0 && (
                <div
                  className="flex items-center gap-2 rounded-lg px-4 py-3 border"
                  style={{
                    background: 'rgba(245,158,11,0.05)',
                    borderColor: 'rgba(245,158,11,0.2)',
                  }}
                >
                  <Clock className="w-4 h-4 shrink-0 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-600">
                    {soonItems.length} pago{soonItems.length > 1 ? 's' : ''} vence{soonItems.length > 1 ? 'n' : ''} esta
                    semana
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--card-bg)',
                borderLeft: '3px solid #2edbc1',
                borderColor: '#e8e8f0',
                borderLeftColor: '#2edbc1',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#2edbc1]" />
                <span className="text-sm" style={{ color: '#8b8ec0' }}>
                  Total a cobrar
                </span>
              </div>
              <p className="text-xl font-bold text-[#2edbc1]">${formatMoney(totalCobrar)}</p>
              {hasTC && (
                <p className="text-xs mt-0.5" style={{ color: '#6439ff' }}>
                  USD ${(totalCobrar / tcRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
                {cobrar.length} item(s)
              </p>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--card-bg)',
                borderLeft: '3px solid #fe4962',
                borderColor: '#e8e8f0',
                borderLeftColor: '#fe4962',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-[#fe4962]" />
                <span className="text-sm" style={{ color: '#8b8ec0' }}>
                  Total a pagar
                </span>
              </div>
              <p className="text-xl font-bold text-[#fe4962]">${formatMoney(totalPagar)}</p>
              {hasTC && (
                <p className="text-xs mt-0.5" style={{ color: '#6439ff' }}>
                  USD ${(totalPagar / tcRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
                {pagar.length} item(s)
              </p>
            </div>
          </div>

          {/* Tables */}
          <div className="rounded-xl border overflow-hidden mb-6" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
            <div
              className="px-4 py-3 border-b flex items-center gap-2"
              style={{ background: 'rgba(46,219,193,0.05)', borderColor: '#e8e8f0' }}
            >
              <TrendingUp className="w-4 h-4 text-[#2edbc1]" />
              <h2 className="font-semibold text-[#2edbc1]">A cobrar ({cobrar.length})</h2>
            </div>
            <PendingTable items={cobrar} color="green" sign="+" tcRate={tcRate} hasTC={hasTC} />
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
            <div
              className="px-4 py-3 border-b flex items-center gap-2"
              style={{ background: 'rgba(254,73,98,0.05)', borderColor: '#e8e8f0' }}
            >
              <TrendingDown className="w-4 h-4 text-[#fe4962]" />
              <h2 className="font-semibold text-[#fe4962]">A pagar ({pagar.length})</h2>
            </div>
            <PendingTable items={pagar} color="red" sign="-" tcRate={tcRate} hasTC={hasTC} />
          </div>
        </div>
      )}
    </div>
  )
}
