'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/utils'
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Tx {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

interface Props {
  name: string
  total: number
  txs: Tx[]
  type: 'income' | 'expense'
  showUSD: boolean
  usdRate: number | null
  colSpan: number
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function CategoryDrilldownRow({ name, total, txs, type, showUSD, usdRate, colSpan }: Props) {
  const [open, setOpen] = useState(false)

  const isIncome = type === 'income'
  const C_POS = '#059669'
  const C_NEG = '#dc2626'
  const C_NAVY = '#06083f'
  const C_MUTED = '#8b8ec0'
  const color = isIncome ? C_POS : C_NEG

  const fmtUSD = (ars: number) => {
    if (!showUSD || !usdRate) return null
    return `$${formatMoney(Math.round(ars / usdRate))}`
  }

  // Sort txs by date descending
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <tr className="border-t hover:bg-[#f7f7fd] transition group" style={{ borderColor: '#f4f4fc' }}>
        {/* Clickable category name */}
        <td className="py-1.5 pl-10 pr-6 text-sm">
          <button
            onClick={() => setOpen(true)}
            className="text-left group-hover:underline decoration-dotted underline-offset-2 transition cursor-pointer"
            style={{ color: C_NAVY }}
            title="Ver detalle de transacciones"
          >
            {name}
            <span className="ml-1.5 opacity-0 group-hover:opacity-60 text-xs transition" style={{ color: C_MUTED }}>
              ({txs.length})
            </span>
          </button>
        </td>

        <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color }}>
          {isIncome ? `$${formatMoney(total)}` : `($${formatMoney(total)})`}
        </td>

        {showUSD && (
          <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
            {fmtUSD(total) ? (isIncome ? fmtUSD(total) : `(${fmtUSD(total)})`) : '—'}
          </td>
        )}
      </tr>

      {/* Modal */}
      {open && (
        <tr>
          <td colSpan={colSpan} className="p-0">
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(6,8,63,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
            >
              <div
                className="rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                style={{ background: '#fff' }}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#f0f0f8' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      {isIncome
                        ? <ArrowUpRight className="w-4 h-4" style={{ color: C_POS }} />
                        : <ArrowDownRight className="w-4 h-4" style={{ color: C_NEG }} />
                      }
                      <h2 className="font-bold text-base" style={{ color: C_NAVY }}>{name}</h2>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>
                      {txs.length} transacción{txs.length !== 1 ? 'es' : ''} ·{' '}
                      <span className="font-semibold" style={{ color }}>
                        {isIncome ? '+' : '−'}${formatMoney(total)}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Transaction list */}
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10" style={{ background: '#f9f9ff' }}>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase" style={{ color: C_MUTED }}>
                          Fecha
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase" style={{ color: C_MUTED }}>
                          Concepto
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase" style={{ color: C_MUTED }}>
                          Monto
                        </th>
                        {showUSD && (
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase" style={{ color: C_MUTED }}>
                            USD
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((tx, i) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-[#f9f9ff] transition"
                          style={{ borderTop: i > 0 ? '1px solid #f4f4fc' : undefined }}
                        >
                          <td className="px-4 py-2.5 text-xs tabular-nums whitespace-nowrap" style={{ color: C_MUTED }}>
                            {fmtDate(tx.date)}
                          </td>
                          <td className="px-4 py-2.5 text-sm" style={{ color: C_NAVY }}>
                            {tx.description || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold whitespace-nowrap"
                              style={{ color }}>
                            {isIncome
                              ? `$${formatMoney(tx.amount)}`
                              : `($${formatMoney(tx.amount)})`
                            }
                          </td>
                          {showUSD && (
                            <td className="px-4 py-2.5 text-right tabular-nums text-xs whitespace-nowrap"
                                style={{ color: C_MUTED }}>
                              {fmtUSD(tx.amount) ?? '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {/* Footer total */}
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #e0e0ef', background: isIncome ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)' }}>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: C_NAVY }} colSpan={2}>
                          Total
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color }}>
                          {isIncome ? `$${formatMoney(total)}` : `($${formatMoney(total)})`}
                        </td>
                        {showUSD && (
                          <td className="px-4 py-3 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                            {fmtUSD(total) ? (isIncome ? fmtUSD(total) : `(${fmtUSD(total)})`) : '—'}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
