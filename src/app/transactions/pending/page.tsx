import { createClient } from '@/lib/supabase/server'
import { formatMoney, daysUntilDue } from '@/lib/utils'
import { UrgencyBadge } from '@/components/dashboard/UrgencyBadge'
import { PendingTable } from '@/components/dashboard/PendingTable'
import { PendingFilters } from './PendingFilters'
import Link from 'next/link'
import { TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getDateRange(filter: string, from: string, to: string): { from: string | null; to: string | null } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  if (filter === 'custom') {
    return { from: from || null, to: to || null }
  }

  if (filter === 'overdue') {
    return { from: null, to: new Date(today.getTime() - 86400000).toISOString().slice(0, 10) }
  }

  if (filter === 'today') {
    return { from: todayStr, to: todayStr }
  }

  if (filter === 'tomorrow') {
    const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)
    return { from: tomorrow, to: tomorrow }
  }

  if (filter === 'this-week') {
    const end = new Date(today)
    end.setDate(end.getDate() + 6)
    return { from: todayStr, to: end.toISOString().slice(0, 10) }
  }

  if (filter === 'next-week') {
    const start = new Date(today)
    start.setDate(start.getDate() + 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }

  if (filter === 'this-month') {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { from: todayStr, to: end.toISOString().slice(0, 10) }
  }

  // 'all' — no date filter
  return { from: null, to: null }
}

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const filter = params.filter || 'all'
  const fromParam = params.from || ''
  const toParam = params.to || ''

  const supabase = await createClient()

  // Base query
  let query = supabase
    .from('transactions')
    .select('*, categories(name), businesses(name)')
    .eq('status', 'devengado')
    .order('due_date', { ascending: true, nullsFirst: false })

  // Apply server-side date filter
  const { from: dateFrom, to: dateTo } = getDateRange(filter, fromParam, toParam)

  if (dateFrom) query = query.gte('due_date', dateFrom)
  if (dateTo) query = query.lte('due_date', dateTo)

  const { data: pending } = await query
  const txs = pending ?? []

  // Settings for TC
  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const tcRate = parseFloat(settingsMap.current_rate) || 0
  const hasTC = tcRate > 0

  function toUSD(ars: number): string {
    if (!hasTC) return ''
    return formatMoney(ars / tcRate)
  }

  const cobrar = txs.filter(t => t.type === 'income')
  const pagar = txs.filter(t => t.type === 'expense')
  const totalCobrar = cobrar.reduce((s, t) => s + Number(t.amount), 0)
  const totalPagar = pagar.reduce((s, t) => s + Number(t.amount), 0)

  // Alerts (always based on real dates, independent of filter)
  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = txs.filter(t => t.due_date && t.due_date < today).length
  const soonCount = txs.filter(t => t.due_date && t.due_date >= today && daysUntilDue(t.due_date) <= 7).length

  // Label for current filter
  const filterLabels: Record<string, string> = {
    all: 'Todos',
    overdue: 'Vencidos',
    today: 'Hoy',
    tomorrow: 'Mañana',
    'this-week': 'Esta semana',
    'next-week': 'Próxima semana',
    'this-month': 'Este mes',
    custom: fromParam && toParam ? `${fromParam} → ${toParam}` : fromParam || toParam || 'Rango personalizado',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Pagos Pendientes</h1>
          <p className="text-sm" style={{ color: '#8b8ec0' }}>
            {txs.length} resultado{txs.length !== 1 ? 's' : ''} · {filterLabels[filter] || filter}
          </p>
        </div>
        <Link href="/dashboard"
              className="text-sm hover:opacity-70 transition" style={{ color: '#6439ff' }}>
          ← Dashboard
        </Link>
      </div>

      {/* Filter component (client) */}
      <PendingFilters />

      {/* Alertas */}
      {(overdueCount > 0 || soonCount > 0) && (
        <div className="space-y-2 mb-6">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 border"
                 style={{ background: 'rgba(254,73,98,0.05)', borderColor: 'rgba(254,73,98,0.2)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fe4962' }} />
              <span className="text-sm font-medium" style={{ color: '#fe4962' }}>
                {overdueCount} pago{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''} en este período
              </span>
            </div>
          )}
          {soonCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 border"
                 style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
              <Clock className="w-4 h-4 shrink-0 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-600">
                {soonCount} pago{soonCount > 1 ? 's' : ''} vence{soonCount > 1 ? 'n' : ''} esta semana
              </span>
            </div>
          )}
        </div>
      )}

      {/* Resumen totales */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderLeft: '3px solid #2edbc1', borderColor: '#e8e8f0', borderLeftColor: '#2edbc1' }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#2edbc1]" />
            <span className="text-sm" style={{ color: '#8b8ec0' }}>Total a cobrar</span>
          </div>
          <p className="text-xl font-bold text-[#2edbc1]">${formatMoney(totalCobrar)}</p>
          {hasTC && <p className="text-xs mt-0.5" style={{ color: '#6439ff' }}>USD ${toUSD(totalCobrar)}</p>}
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>{cobrar.length} item(s)</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderLeft: '3px solid #fe4962', borderColor: '#e8e8f0', borderLeftColor: '#fe4962' }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-[#fe4962]" />
            <span className="text-sm" style={{ color: '#8b8ec0' }}>Total a pagar</span>
          </div>
          <p className="text-xl font-bold text-[#fe4962]">${formatMoney(totalPagar)}</p>
          {hasTC && <p className="text-xs mt-0.5" style={{ color: '#6439ff' }}>USD ${toUSD(totalPagar)}</p>}
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>{pagar.length} item(s)</p>
        </div>
      </div>

      {/* Empty state */}
      {txs.length === 0 && (
        <div className="text-center py-16" style={{ color: '#8b8ec0' }}>
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hay pagos pendientes</p>
          <p className="text-sm mt-1">para el período seleccionado</p>
        </div>
      )}

      {/* Tabla A cobrar */}
      {cobrar.length > 0 && (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: 'rgba(46,219,193,0.05)', borderColor: '#e8e8f0' }}>
            <TrendingUp className="w-4 h-4 text-[#2edbc1]" />
            <h2 className="font-semibold text-[#2edbc1]">A cobrar ({cobrar.length})</h2>
          </div>
          <PendingTable items={cobrar} color="green" sign="+" tcRate={tcRate} hasTC={hasTC} />
        </div>
      )}

      {/* Tabla A pagar */}
      {pagar.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: 'rgba(254,73,98,0.05)', borderColor: '#e8e8f0' }}>
            <TrendingDown className="w-4 h-4 text-[#fe4962]" />
            <h2 className="font-semibold text-[#fe4962]">A pagar ({pagar.length})</h2>
          </div>
          <PendingTable items={pagar} color="red" sign="-" tcRate={tcRate} hasTC={hasTC} />
        </div>
      )}
    </div>
  )
}
