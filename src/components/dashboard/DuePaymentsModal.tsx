'use client'

import { useEffect, useState } from 'react'
import { formatMoney, dueDateUrgency } from '@/lib/utils'
import { UrgencyBadge } from './UrgencyBadge'
import { AlertTriangle, Clock, X } from 'lucide-react'
import Link from 'next/link'

interface DuePaymentsModalProps {
  dueItems: any[]
  hasTC: boolean
  tcRate: number
  onDismiss?: () => void
}

export function DuePaymentsModal({
  dueItems,
  hasTC,
  tcRate,
}: DuePaymentsModalProps) {
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    // Auto-show on mount
    setIsOpen(true)
  }, [dueItems.length])

  if (!isOpen || dueItems.length === 0) {
    return null
  }

  function toUSD(ars: number): string {
    if (!hasTC) return ''
    return formatMoney(ars / tcRate)
  }

  const overdue = dueItems.filter(t => t.due_date && dueDateUrgency(t.due_date) === 'overdue')
  const today = dueItems.filter(t => t.due_date && dueDateUrgency(t.due_date) === 'today')
  const tomorrow = dueItems.filter(t => t.due_date && dueDateUrgency(t.due_date) === 'soon')

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--dash-card)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-start justify-between"
          style={{ borderColor: '#e8e8f0' }}
        >
          <div className="flex items-start gap-3 flex-1">
            {overdue.length > 0 ? (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#fe4962' }} />
            ) : (
              <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            )}
            <div>
              <h2 className="font-semibold text-white">Pagos pendientes</h2>
              <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                {overdue.length > 0
                  ? `${overdue.length} vencido${overdue.length > 1 ? 's' : ''}`
                  : `${dueItems.length} vence${dueItems.length > 1 ? 'n' : ''} hoy/mañana`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Compact list */}
        <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
          {overdue.length > 0 && (
            <div>
              <p
                className="text-xs font-semibold mb-2 uppercase"
                style={{ color: '#fe4962' }}
              >
                Vencidos ({overdue.length})
              </p>
              <div className="space-y-2">
                {overdue.slice(0, 5).map(t => (
                  <div
                    key={t.id}
                    className="p-2 rounded text-xs"
                    style={{ background: 'rgba(254,73,98,0.1)' }}
                  >
                    <p className="font-medium text-white">{t.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ color: '#fe4962' }}>
                        {t.type === 'income' ? '+' : '-'}${formatMoney(Number(t.amount))}
                      </span>
                      <UrgencyBadge dueDate={t.due_date} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {today.length > 0 && (
            <div>
              <p
                className="text-xs font-semibold mb-2 uppercase"
                style={{ color: '#2edbc1' }}
              >
                Hoy ({today.length})
              </p>
              <div className="space-y-2">
                {today.slice(0, 5).map(t => (
                  <div
                    key={t.id}
                    className="p-2 rounded text-xs"
                    style={{ background: 'rgba(46,219,193,0.1)' }}
                  >
                    <p className="font-medium text-white">{t.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ color: '#2edbc1' }}>
                        {t.type === 'income' ? '+' : '-'}${formatMoney(Number(t.amount))}
                      </span>
                      <UrgencyBadge dueDate={t.due_date} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tomorrow.length > 0 && (
            <div>
              <p
                className="text-xs font-semibold mb-2 uppercase"
                style={{ color: '#f59e0b' }}
              >
                Mañana ({tomorrow.length})
              </p>
              <div className="space-y-2">
                {tomorrow.slice(0, 5).map(t => (
                  <div
                    key={t.id}
                    className="p-2 rounded text-xs"
                    style={{ background: 'rgba(245,158,11,0.1)' }}
                  >
                    <p className="font-medium text-white">{t.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ color: '#f59e0b' }}>
                        {t.type === 'income' ? '+' : '-'}${formatMoney(Number(t.amount))}
                      </span>
                      <UrgencyBadge dueDate={t.due_date} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div
          className="px-6 py-3 border-t flex items-center gap-2"
          style={{ borderColor: '#e8e8f0' }}
        >
          <Link
            href="/dashboard?tab=pending"
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition hover:opacity-90"
            style={{ background: '#6439ff', color: 'white' }}
          >
            Ver todos
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition"
            style={{ background: '#f0f0f8', color: 'var(--navy)' }}
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  )
}
