import { createClient } from '@/lib/supabase/server'
import { formatMoney, dueDateUrgency, daysUntilDue } from '@/lib/utils'
import { MarkPaidButton } from './MarkPaidButton'
import Link from 'next/link'
import { Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PendingPage() {
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from('transactions')
    .select('*, categories(name), businesses(name)')
    .eq('status', 'devengado')
    .order('due_date', { ascending: true, nullsFirst: false })

  const txs = pending ?? []

  // Tipo de cambio
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

  // Urgency counts
  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = txs.filter(t => t.due_date && t.due_date < today).length
  const soonCount = txs.filter(t => t.due_date && t.due_date >= today && daysUntilDue(t.due_date) <= 7).length

  function UrgencyBadge({ dueDate }: { dueDate: string | null }) {
    if (!dueDate) return <span className="text-xs text-gray-400">Sin vencimiento</span>
    const urgency = dueDateUrgency(dueDate)
    const days = daysUntilDue(dueDate)
    const colorClass = urgency === 'overdue'
      ? 'bg-red-100 text-red-700 border border-red-200'
      : urgency === 'soon'
      ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
      : 'bg-green-100 text-green-700 border border-green-200'
    const label = days < 0
      ? `Vencido hace ${Math.abs(days)}d`
      : days === 0
      ? 'Vence hoy'
      : `Vence en ${days}d`
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {dueDate.slice(5).replace('-', '/')} · {label}
      </span>
    )
  }

  function PendingTable({
    items,
    color,
    sign,
  }: {
    items: typeof txs
    color: 'green' | 'red'
    sign: '+' | '-'
  }) {
    if (items.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          No hay pendientes en esta sección
        </div>
      )
    }

    return (
      <div className="divide-y">
        {items.map(t => {
          const urgency = dueDateUrgency(t.due_date)
          const rowBg = urgency === 'overdue' ? 'bg-red-50/40' : ''
          return (
            <div key={t.id} className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition ${rowBg}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{t.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(t.categories as { name: string } | null)?.name ?? '—'} · {(t.businesses as { name: string } | null)?.name ?? '—'}
                </p>
                <div className="mt-1">
                  <UrgencyBadge dueDate={t.due_date} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold text-sm ${color === 'green' ? 'text-green-600' : 'text-red-600'}`}>
                  {sign}${formatMoney(Number(t.amount))}
                </p>
                {hasTC && (
                  <p className="text-xs text-gray-400">USD ${toUSD(Number(t.amount))}</p>
                )}
              </div>
              <div className="shrink-0">
                <MarkPaidButton id={t.id} type={t.type} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pagos Pendientes</h1>
          <p className="text-sm text-gray-500">{txs.length} pendiente(s) en total</p>
        </div>
        <Link href="/transactions"
              className="text-sm text-blue-600 hover:text-blue-800 transition">
          ← Ver todas las transacciones
        </Link>
      </div>

      {/* Alertas */}
      {(overdueCount > 0 || soonCount > 0) && (
        <div className="space-y-2 mb-6">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-sm text-red-700 font-medium">
                {overdueCount} pago{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {soonCount > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
              <span className="text-sm text-yellow-700 font-medium">
                {soonCount} pago{soonCount > 1 ? 's' : ''} vence{soonCount > 1 ? 'n' : ''} esta semana
              </span>
            </div>
          )}
        </div>
      )}

      {/* Resumen totales */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-l-green-500 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Total a cobrar</span>
          </div>
          <p className="text-xl font-bold text-green-600">${formatMoney(totalCobrar)}</p>
          {hasTC && <p className="text-xs text-blue-500 mt-0.5">USD ${toUSD(totalCobrar)}</p>}
          <p className="text-xs text-gray-400 mt-1">{cobrar.length} item(s)</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-l-red-500 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm text-gray-500">Total a pagar</span>
          </div>
          <p className="text-xl font-bold text-red-600">${formatMoney(totalPagar)}</p>
          {hasTC && <p className="text-xs text-blue-500 mt-0.5">USD ${toUSD(totalPagar)}</p>}
          <p className="text-xs text-gray-400 mt-1">{pagar.length} item(s)</p>
        </div>
      </div>

      {/* Tabla A cobrar */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 bg-green-50 border-b flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-700" />
          <h2 className="font-semibold text-green-700">A cobrar ({cobrar.length})</h2>
        </div>
        <PendingTable items={cobrar} color="green" sign="+" />
      </div>

      {/* Tabla A pagar */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-700" />
          <h2 className="font-semibold text-red-700">A pagar ({pagar.length})</h2>
        </div>
        <PendingTable items={pagar} color="red" sign="-" />
      </div>
    </div>
  )
}
