'use client'

import { useState } from 'react'
import { formatMoney0 } from '@/lib/utils'
import { X, Percent } from 'lucide-react'

export interface CategoryBreakdown {
  name: string
  catType: 'income' | 'expense'
  income: number
  expense: number
  ivaByRate?: Record<number, number>
}

interface Props {
  totalNet: number           // kept in props for compat — no longer displayed
  categoryBreakdown: CategoryBreakdown[]
  selectedYear: number
}

export function TaxSection({ categoryBreakdown, selectedYear }: Props) {
  const [showModal, setShowModal] = useState(false)

  // Aggregate IVA by rate across all categories
  const ivaByRate: Record<number, number> = {}
  let totalIVA = 0
  for (const cat of categoryBreakdown) {
    if (cat.ivaByRate) {
      for (const [rate, amount] of Object.entries(cat.ivaByRate)) {
        const rateNum = parseFloat(rate)
        ivaByRate[rateNum] = (ivaByRate[rateNum] ?? 0) + amount
        totalIVA += amount
      }
    }
  }

  // Categories that have any IVA, for the modal detail
  const catsWithIva = categoryBreakdown.filter(
    c => c.ivaByRate && Object.keys(c.ivaByRate).length > 0
  )

  if (totalIVA === 0) return null

  const fmt = (n: number) => `$${formatMoney0(Math.abs(n))}`

  return (
    <>
      {/* ── IVA Summary ── */}
      <div
        className="mt-6 rounded-xl border overflow-hidden"
        style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: '#e8e8f0', background: '#f9f9ff' }}
        >
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#4a4a6a' }}>
              Resumen de IVA — {selectedYear}
            </h3>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs px-2.5 py-1 rounded-full transition hover:opacity-80"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}
          >
            ver detalle
          </button>
        </div>

        <div className="divide-y" style={{ borderColor: '#f0f0f8' }}>
          {/* IVA por tasa */}
          {Object.entries(ivaByRate)
            .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
            .map(([rate, amount]) => (
              <div key={rate} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium" style={{ color: '#4a4a6a' }}>
                  IVA {parseFloat(rate).toFixed(1)}%
                </span>
                <span className="font-bold tabular-nums text-[#f59e0b]">
                  {fmt(amount)}
                </span>
              </div>
            ))}

          {/* Total IVA */}
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ background: '#fffbf0' }}
          >
            <span className="font-bold text-sm" style={{ color: '#4a4a6a' }}>Total IVA</span>
            <span className="text-lg font-bold tabular-nums text-[#f59e0b]">
              {fmt(totalIVA)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Modal: IVA por concepto ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,30,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            className="rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            style={{ background: 'var(--card-bg)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: '#e8e8f0' }}
            >
              <div>
                <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                  Detalle de IVA por concepto
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                  Año {selectedYear} · IVA calculado sobre monto de gastos
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: '#f4f4ff' }}>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: '#8b8ec0' }}>Concepto</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                        style={{ color: '#8b8ec0' }}>Tasa</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                        style={{ color: '#8b8ec0' }}>IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {catsWithIva.map((cat, i) =>
                    Object.entries(cat.ivaByRate ?? {})
                      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
                      .map(([rate, amount]) => (
                        <tr key={`${i}-${rate}`} style={{ borderTop: '1px solid #f0f0f8' }}>
                          <td className="px-4 py-3">
                            <span className="font-medium" style={{ color: '#1a1a2e' }}>
                              {cat.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm"
                              style={{ color: '#8b8ec0' }}>
                            {parseFloat(rate).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#f59e0b]">
                            {fmt(amount)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e0e0ef', background: '#fffbf0' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: '#1a1a2e' }}>Total</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-[#f59e0b]">
                      {fmt(totalIVA)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
