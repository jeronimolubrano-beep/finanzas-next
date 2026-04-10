'use client'

import { formatMoney, dueDateUrgency } from '@/lib/utils'
import { MarkPaidButton } from '@/app/transactions/pending/MarkPaidButton'
import { UrgencyBadge } from './UrgencyBadge'
import { CheckCircle2 } from 'lucide-react'

interface PendingTableProps {
  items: any[]
  color: 'green' | 'red'
  sign: '+' | '-'
  tcRate: number
  hasTC: boolean
}

export function PendingTable({
  items,
  color,
  sign,
  tcRate,
  hasTC,
}: PendingTableProps) {
  function toUSD(ars: number): string {
    if (!hasTC) return ''
    return formatMoney(ars / tcRate)
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm" style={{ color: '#8b8ec0' }}>
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#c8cce0' }} />
        No hay pendientes en esta sección
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: '#f0f0f8' }}>
      {items.map(t => {
        const urgency = dueDateUrgency(t.due_date)
        const rowBg = urgency === 'overdue' ? 'rgba(254,73,98,0.03)' : ''
        return (
          <div
            key={t.id}
            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-[#f9f9ff] transition"
            style={{ background: rowBg }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: 'var(--navy)' }}>
                {t.description}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                {(t.categories as { name: string } | null)?.name ?? '—'} ·{' '}
                {(t.businesses as { name: string } | null)?.name ?? '—'}
              </p>
              <div className="mt-1">
                <UrgencyBadge dueDate={t.due_date} />
              </div>
            </div>
            <div className="flex items-center gap-3 sm:ml-auto">
              <div className="text-right shrink-0">
                <p
                  className={`font-bold text-sm ${
                    color === 'green' ? 'text-[#2edbc1]' : 'text-[#fe4962]'
                  }`}
                >
                  {sign}${formatMoney(Number(t.amount))}
                </p>
                {hasTC && (
                  <p className="text-xs" style={{ color: '#8b8ec0' }}>
                    USD ${toUSD(Number(t.amount))}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <MarkPaidButton id={t.id} type={t.type} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
