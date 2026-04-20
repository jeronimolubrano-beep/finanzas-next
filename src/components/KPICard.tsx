import { cn } from '@/lib/utils'

export interface DeltaBadge {
  pct: number        // percentage change (can be negative)
  isPositive: boolean // true = green (good), false = red (bad)
}

interface KPICardProps {
  title: string
  value: string
  color: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'cyan' | 'orange'
  subtitle?: string
  usdValue?: string
  dark?: boolean
  delta?: DeltaBadge
}

const lightColors = {
  green:  { accent: '#2edbc1', bg: 'rgba(46,219,193,0.08)', text: 'text-[#2edbc1]' },
  red:    { accent: '#fe4962', bg: 'rgba(254,73,98,0.08)',  text: 'text-[#fe4962]' },
  blue:   { accent: '#6439ff', bg: 'rgba(100,57,255,0.08)', text: 'text-[#6439ff]' },
  yellow: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: 'text-yellow-500' },
  purple: { accent: '#8b6fff', bg: 'rgba(139,111,255,0.08)', text: 'text-[#8b6fff]' },
  cyan:   { accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  text: 'text-cyan-500' },
  orange: { accent: '#f97316', bg: 'rgba(249,115,22,0.08)', text: 'text-orange-500' },
}

const darkColors = {
  green:  { accent: '#2edbc1', glow: 'rgba(46,219,193,0.15)' },
  red:    { accent: '#fe4962', glow: 'rgba(254,73,98,0.15)' },
  blue:   { accent: '#6439ff', glow: 'rgba(100,57,255,0.15)' },
  yellow: { accent: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
  purple: { accent: '#8b6fff', glow: 'rgba(139,111,255,0.15)' },
  cyan:   { accent: '#06b6d4', glow: 'rgba(6,182,212,0.15)' },
  orange: { accent: '#f97316', glow: 'rgba(249,115,22,0.15)' },
}

function DeltaChip({ delta }: { delta: DeltaBadge }) {
  const arrow = delta.pct >= 0 ? '▲' : '▼'
  const color = delta.isPositive ? '#2edbc1' : '#fe4962'
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums"
          style={{ color }}>
      {arrow} {Math.abs(delta.pct).toFixed(1)}% vs mes ant.
    </span>
  )
}

export function KPICard({ title, value, color, subtitle, usdValue, dark = false, delta }: KPICardProps) {
  if (dark) {
    const dc = darkColors[color]
    return (
      <div
        className="rounded-xl p-4 border transition-all hover:scale-[1.02] min-w-0"
        style={{
          background: 'var(--dash-card)',
          borderColor: 'var(--dash-border)',
          boxShadow: `0 0 20px ${dc.glow}`,
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--dash-text)' }}>
          {title}
        </p>
        <p className="text-base sm:text-xl lg:text-2xl font-bold leading-tight break-words" style={{ color: dc.accent }}>{value}</p>
        {usdValue && (
          <p className="text-xs mt-1 font-medium" style={{ color: '#6439ff' }}>USD {usdValue}</p>
        )}
        {delta && <div className="mt-1"><DeltaChip delta={delta} /></div>}
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>{subtitle}</p>
        )}
        <div className="mt-3 h-0.5 rounded-full" style={{ background: `linear-gradient(to right, ${dc.accent}, transparent)` }} />
      </div>
    )
  }

  const lc = lightColors[color]
  return (
    <div
      className="rounded-xl p-4 border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md min-w-0"
      style={{ borderLeft: `3px solid ${lc.accent}` }}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{title}</p>
      <p className={cn('text-sm sm:text-base lg:text-xl font-bold leading-tight break-words', lc.text)}>{value}</p>
      {usdValue && <p className="text-xs mt-0.5 font-medium" style={{ color: '#6439ff' }}>USD {usdValue}</p>}
      {delta && <div className="mt-1"><DeltaChip delta={delta} /></div>}
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
