'use client'

import type { PortfolioKPISummary } from '@/lib/iol-types'
import { formatMoney } from '@/lib/utils'

interface Props {
  kpis: PortfolioKPISummary
}

export function PortfolioKPIs({ kpis }: Props) {
  const cards = [
    {
      title: 'Valor Total',
      value: `$${formatMoney(kpis.totalValueARS)}`,
      subtitle: kpis.totalValueUSD != null ? `US$ ${formatMoney(kpis.totalValueUSD)}` : null,
      color: '#2edbc1',
    },
    {
      title: 'P&L Total',
      value: `${kpis.plTotalARS >= 0 ? '+' : ''}$${formatMoney(kpis.plTotalARS)}`,
      subtitle: kpis.plTotalUSD != null
        ? `US$ ${kpis.plTotalUSD >= 0 ? '+' : ''}${formatMoney(kpis.plTotalUSD)}`
        : null,
      color: kpis.plTotalARS >= 0 ? '#2edbc1' : '#fe4962',
    },
    {
      title: 'Rendimiento',
      value: `${kpis.plPercent >= 0 ? '+' : ''}${kpis.plPercent.toFixed(2)}%`,
      subtitle: null,
      color: kpis.plPercent >= 0 ? '#2edbc1' : '#fe4962',
    },
    {
      title: 'Rend. vs Dólar',
      value: kpis.rendimientoVsDolar != null
        ? `${kpis.rendimientoVsDolar >= 0 ? '+' : ''}${kpis.rendimientoVsDolar.toFixed(2)}%`
        : '—',
      subtitle: kpis.rendimientoVsDolar != null
        ? kpis.rendimientoVsDolar >= 0
          ? 'Le ganaste al dólar'
          : 'El dólar ganó'
        : null,
      color: kpis.rendimientoVsDolar != null
        ? kpis.rendimientoVsDolar >= 0 ? '#2edbc1' : '#fe4962'
        : '#8b8ec0',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div
          key={card.title}
          className="rounded-xl p-5 border transition-all hover:scale-[1.02]"
          style={{
            background: 'var(--dash-card)',
            borderColor: 'var(--dash-border)',
            boxShadow: `0 0 15px ${card.color}15`,
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--dash-text, #8b8ec0)' }}>
            {card.title}
          </p>
          <p className="text-xl font-bold tabular-nums" style={{ color: card.color }}>
            {card.value}
          </p>
          {card.subtitle && (
            <p className="text-xs mt-1 tabular-nums" style={{ color: '#6439ff' }}>
              {card.subtitle}
            </p>
          )}
          <div
            className="mt-3 h-[2px] rounded-full"
            style={{ background: `linear-gradient(to right, ${card.color}, transparent)` }}
          />
        </div>
      ))}
    </div>
  )
}
