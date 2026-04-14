'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import type { PortfolioPosition } from '@/lib/iol-types'
import type { IOLOperacion } from '@/lib/iol-types'
import { formatMoney } from '@/lib/utils'

interface Props {
  position: PortfolioPosition
  onClose: () => void
  getOperaciones: (simbolo: string) => Promise<IOLOperacion[]>
}

export function TickerDetailModal({ position, onClose, getOperaciones }: Props) {
  const [operaciones, setOperaciones] = useState<IOLOperacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOperaciones(position.simbolo)
      .then(ops => {
        // Ordenar por fecha descendente
        ops.sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime())
        setOperaciones(ops)
      })
      .finally(() => setLoading(false))
  }, [position.simbolo, getOperaciones])

  const compras = operaciones.filter(o => o.tipo === 'Compra')
  const ventas = operaciones.filter(o => o.tipo === 'Venta')
  const totalComisiones = operaciones.reduce((s, o) => {
    // IOL no siempre incluye comisiones como campo separado,
    // se puede calcular como diferencia entre monto y montoOperado
    return s
  }, 0)

  const plColor = position.plARS >= 0 ? '#2edbc1' : '#fe4962'
  const PlIcon = position.plARS >= 0 ? TrendingUp : TrendingDown

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,8,63,0.8)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#1a1f4e', border: '1px solid #333b72' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#333b72' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${plColor}15` }}
            >
              <PlIcon className="w-5 h-5" style={{ color: plColor }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{position.simbolo}</h2>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>{position.descripcion}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-white">
                ${formatMoney(position.precioActual)}
              </p>
              <p className="text-xs tabular-nums" style={{ color: position.variacionDiaria >= 0 ? '#2edbc1' : '#fe4962' }}>
                {position.variacionDiaria >= 0 ? '+' : ''}{position.variacionDiaria.toFixed(2)}% hoy
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition">
              <X className="w-4 h-4" style={{ color: '#8b8ec0' }} />
            </button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b" style={{ borderColor: '#333b72' }}>
          <div>
            <p className="text-[10px] uppercase font-medium" style={{ color: '#5b5c8c' }}>Precio Prom. Compra</p>
            <p className="text-sm font-semibold tabular-nums text-white">${formatMoney(position.ppc)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-medium" style={{ color: '#5b5c8c' }}>P&L Total</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: plColor }}>
              {position.plARS >= 0 ? '+' : ''}${formatMoney(position.plARS)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-medium" style={{ color: '#5b5c8c' }}>Operaciones</p>
            <p className="text-sm font-semibold text-white">
              {compras.length} compra{compras.length !== 1 ? 's' : ''} / {ventas.length} venta{ventas.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Operations Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2" style={{ color: '#8b8ec0' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando operaciones...</span>
            </div>
          ) : operaciones.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: '#8b8ec0' }}>
              No se encontraron operaciones
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left" style={{ color: '#5b5c8c' }}>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Tipo</th>
                  <th className="pb-2 font-semibold text-right">Cantidad</th>
                  <th className="pb-2 font-semibold text-right">Precio</th>
                  <th className="pb-2 font-semibold text-right">Monto</th>
                  <th className="pb-2 font-semibold text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map(op => {
                  const fecha = new Date(op.fechaOrden)
                  const fechaStr = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  const isCompra = op.tipo === 'Compra'

                  return (
                    <tr
                      key={op.numero}
                      className="border-t"
                      style={{ borderColor: 'rgba(51,59,114,0.3)' }}
                    >
                      <td className="py-2 tabular-nums" style={{ color: '#d0d4f0' }}>{fechaStr}</td>
                      <td className="py-2">
                        <span
                          className="px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: isCompra ? 'rgba(46,219,193,0.1)' : 'rgba(254,73,98,0.1)',
                            color: isCompra ? '#2edbc1' : '#fe4962',
                          }}
                        >
                          {op.tipo}
                        </span>
                      </td>
                      <td className="py-2 tabular-nums text-right" style={{ color: '#d0d4f0' }}>
                        {(op.cantidadOperada || op.cantidad).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2 tabular-nums text-right" style={{ color: '#d0d4f0' }}>
                        ${formatMoney(op.precioOperado || op.precio)}
                      </td>
                      <td className="py-2 tabular-nums text-right font-medium" style={{ color: '#d0d4f0' }}>
                        ${formatMoney(op.montoOperado || op.monto)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-[10px]" style={{ color: '#5b5c8c' }}>
                          {op.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer - USD info */}
        {position.costoUSD != null && position.valorActualUSD != null && (
          <div className="px-6 py-3 border-t flex items-center gap-4 text-xs" style={{ borderColor: '#333b72', color: '#8b8ec0' }}>
            <span>
              Costo USD: <strong style={{ color: '#6439ff' }}>US$ {formatMoney(position.costoUSD)}</strong>
            </span>
            <span>
              Valor USD: <strong style={{ color: '#6439ff' }}>US$ {formatMoney(position.valorActualUSD)}</strong>
            </span>
            <span>
              P&L USD:{' '}
              <strong style={{ color: (position.plUSD ?? 0) >= 0 ? '#2edbc1' : '#fe4962' }}>
                US$ {(position.plUSD ?? 0) >= 0 ? '+' : ''}{formatMoney(position.plUSD ?? 0)}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
