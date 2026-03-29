import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string
  color: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'cyan' | 'orange'
  subtitle?: string
  usdValue?: string
}

const colorMap = {
  green:  { border: 'border-l-green-500',  text: 'text-green-600' },
  red:    { border: 'border-l-red-500',    text: 'text-red-600' },
  blue:   { border: 'border-l-blue-500',   text: 'text-blue-600' },
  yellow: { border: 'border-l-yellow-500', text: 'text-yellow-600' },
  purple: { border: 'border-l-purple-500', text: 'text-purple-600' },
  cyan:   { border: 'border-l-cyan-500',   text: 'text-cyan-600' },
  orange: { border: 'border-l-orange-500', text: 'text-orange-600' },
}

export function KPICard({ title, value, color, subtitle, usdValue }: KPICardProps) {
  const c = colorMap[color]

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border-l-4 p-4', c.border)}>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={cn('text-xl font-bold', c.text)}>{value}</p>
      {usdValue && <p className="text-xs text-blue-500 mt-0.5">USD {usdValue}</p>}
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
