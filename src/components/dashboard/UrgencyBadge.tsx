import { dueDateUrgency, daysUntilDue, formatDateShort } from '@/lib/utils'

interface UrgencyBadgeProps {
  dueDate: string | null
}

export function UrgencyBadge({ dueDate }: UrgencyBadgeProps) {
  if (!dueDate) {
    return <span className="text-xs" style={{ color: '#8b8ec0' }}>Sin vencimiento</span>
  }

  const urgency = dueDateUrgency(dueDate)
  const days = daysUntilDue(dueDate)
  const bg = urgency === 'overdue' ? 'rgba(254,73,98,0.1)'
    : urgency === 'soon' ? 'rgba(245,158,11,0.1)'
    : 'rgba(46,219,193,0.1)'
  const color = urgency === 'overdue' ? '#fe4962'
    : urgency === 'soon' ? '#f59e0b'
    : '#2edbc1'
  const label = days < 0
    ? `Vencido hace ${Math.abs(days)}d`
    : days === 0
    ? 'Vence hoy'
    : `Vence en ${days}d`

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: bg, color }}>
      {formatDateShort(dueDate)} · {label}
    </span>
  )
}
