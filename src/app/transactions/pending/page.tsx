import { createClient } from '@/lib/supabase/server'
import { formatMoney, dueDateUrgency, daysUntilDue } from '@/lib/utils'
import { UrgencyBadge } from '@/components/dashboard/UrgencyBadge'
import { PendingTable } from '@/components/dashboard/PendingTable'
import Link from 'next/link'
import { TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PendingPage() {
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from('transactions')
    .select('*, categories(name), businesses(name)')
    .eq('status', 'devengado')
    .order('due_date', { ascending: true, nullsFirst: false })

  const txs = pending ?? []

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

  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = txs.filter(t => t.due_date && t.due_date < today).length
  const soonCount = txs.filter(t => t.due_date && t.due_date >= today && daysUntilDue(t.due_date) <= 7).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Pagos Pendientes</h1>
          <p className="text-sm" style={{ color: '#8b8ec0' }}>{txs.length} pendiente(s) en total</p>
        </div>
        <Link href="/dashboard?tab=pending"
              className="text-sm hover:opacity-70 transition" style={{ color: '#6439ff' }}>
          ← Ver dashboard
        </Link>
      </div>

      {/* Alertas */}
      {(overdueCount > 0 || soonCount > 0) && (
        <div className="space-y-2 mb-6">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 border"
                 style={{ background: 'rgba(254,73,98,0.05)', borderColor: 'rgba(254,73,98,0.2)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fe4962' }} />
              <span className="text-sm font-medium" style={{ color: '#fe4962' }}>
                {overdueCount} pago{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
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

      {/* Tabla A cobrar */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: 'rgba(46,219,193,0.05)', borderColor: '#e8e8f0' }}>
          <TrendingUp className="w-4 h-4 text-[#2edbc1]" />
          <h2 className="font-semibold text-[#2edbc1]">A cobrar ({cobrar.length})</h2>
        </div>
        <PendingTable items={cobrar} color="green" sign="+" tcRate={tcRate} hasTC={hasTC} />
      </div>

      {/* Tabla A pagar */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: 'rgba(254,73,98,0.05)', borderColor: '#e8e8f0' }}>
          <TrendingDown className="w-4 h-4 text-[#fe4962]" />
          <h2 className="font-semibold text-[#fe4962]">A pagar ({pagar.length})</h2>
        </div>
        <PendingTable items={pagar} color="red" sign="-" tcRate={tcRate} hasTC={hasTC} />
      </div>
    </div>
  )
}
