'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PositionGroup, PortfolioPosition } from '@/lib/iol-types'
import { formatMoney } from '@/lib/utils'

interface Props {
  groups: PositionGroup[]
  onTickerClick: (position: PortfolioPosition) => void
}

export function PositionsTable({ groups, onTickerClick }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(groups.map(g => g.tipo)))

  const toggle = (tipo: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div
        className="rounded-xl border p-10 text-center"
        style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
      >
        <p className="text-sm" style={{ color: '#8b8ec0' }}>
          No hay posiciones en tu cartera
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
    >
      {groups.map(group => {
        const isOpen = expanded.has(group.tipo)
        const plColor = group.subtotalPL >= 0 ? '#2edbc1' : '#fe4962'

        return (
          <div key={group.tipo}>
            {/* Group Header */}
            <button
              onClick={() => toggle(group.tipo)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/5 transition-colors border-b"
              style={{ borderColor: 'var(--dash-border)' }}
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#8b8ec0' }} />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#8b8ec0' }} />
              )}

              <span className="text-sm font-semibold text-white flex-1">
                {group.label}
              </span>

              <span className="text-xs tabular-nums" style={{ color: '#8b8ec0' }}>
                {group.positions.length} {group.positions.length === 1 ? 'posición' : 'posiciones'}
              </span>

              <span className="text-xs font-medium tabular-nums w-28 text-right" style={{ color: '#d0d4f0' }}>
                ${formatMoney(group.subtotalARS)}
              </span>

              <span className="text-xs font-semibold tabular-nums w-28 text-right" style={{ color: plColor }}>
                {group.subtotalPL >= 0 ? '+' : ''}${formatMoney(group.subtotalPL)}
              </span>

              <span className="text-xs font-medium tabular-nums w-16 text-right" style={{ color: plColor }}>
                {group.subtotalPLPercent >= 0 ? '+' : ''}{group.subtotalPLPercent.toFixed(1)}%
              </span>
            </button>

            {/* Position Rows */}
            {isOpen && (
              <div>
                {/* Table Header */}
                <div
                  className="grid grid-cols-[1fr_80px_100px_100px_100px_100px_80px] gap-2 px-5 py-2 text-[10px] font-semibold uppercase"
                  style={{ color: '#5b5c8c', background: 'rgba(100,57,255,0.04)' }}
                >
                  <div>Instrumento</div>
                  <div className="text-right">Cantidad</div>
                  <div className="text-right">Precio</div>
                  <div className="text-right">PPC</div>
                  <div className="text-right">Valorizado</div>
                  <div className="text-right">P&L $</div>
                  <div className="text-right">Var %</div>
                </div>

                {group.positions.map(pos => {
                  const posPlColor = pos.plARS >= 0 ? '#2edbc1' : '#fe4962'
                  const varColor = pos.variacionDiaria >= 0 ? '#2edbc1' : '#fe4962'

                  return (
                    <button
                      key={pos.simbolo}
                      onClick={() => onTickerClick(pos)}
                      className="w-full grid grid-cols-[1fr_80px_100px_100px_100px_100px_80px] gap-2 px-5 py-2.5 text-left hover:bg-white/5 transition-colors border-b"
                      style={{ borderColor: 'rgba(51,59,114,0.3)' }}
                    >
                      <div>
                        <span className="text-xs font-semibold text-white">{pos.simbolo}</span>
                        <span className="text-[10px] ml-2 truncate" style={{ color: '#8b8ec0' }}>
                          {pos.descripcion.substring(0, 30)}
                        </span>
                      </div>
                      <div className="text-xs tabular-nums text-right" style={{ color: '#d0d4f0' }}>
                        {pos.cantidad.toLocaleString('es-AR')}
                      </div>
                      <div className="text-xs tabular-nums text-right" style={{ color: '#d0d4f0' }}>
                        ${formatMoney(pos.precioActual)}
                      </div>
                      <div className="text-xs tabular-nums text-right" style={{ color: '#8b8ec0' }}>
                        ${formatMoney(pos.ppc)}
                      </div>
                      <div className="text-xs tabular-nums text-right font-medium" style={{ color: '#d0d4f0' }}>
                        ${formatMoney(pos.valorizadoARS)}
                      </div>
                      <div className="text-xs tabular-nums text-right font-semibold" style={{ color: posPlColor }}>
                        {pos.plARS >= 0 ? '+' : ''}${formatMoney(pos.plARS)}
                      </div>
                      <div className="text-xs tabular-nums text-right font-medium" style={{ color: varColor }}>
                        {pos.variacionDiaria >= 0 ? '+' : ''}{pos.variacionDiaria.toFixed(2)}%
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
