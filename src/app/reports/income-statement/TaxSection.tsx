'use client'

import { useState, useEffect } from 'react'
import { formatMoney0 } from '@/lib/utils'
import { X, Percent, Receipt } from 'lucide-react'

export interface CategoryBreakdown {
  name: string
  catType: 'income' | 'expense'
  income: number
  expense: number
}

interface Props {
  totalNet: number
  categoryBreakdown: CategoryBreakdown[]
  selectedYear: number
}

export function TaxSection({ totalNet, categoryBreakdown, selectedYear }: Props) {
  const [taxRate, setTaxRate] = useState(35)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('pl_tax_rate')
    if (saved) setTaxRate(parseFloat(saved))
  }, [])

  const handleTaxRateChange = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val))
    setTaxRate(clamped)
    localStorage.setItem('pl_tax_rate', String(clamped))
  }

  const taxableIncome = Math.max(totalNet, 0)
  const taxAmount = taxableIncome * (taxRate / 100)
  const netAfterTax = totalNet - taxAmount

  const fmt = (n: number) => `$${formatMoney0(Math.abs(n))}`

  return (
    <>
      {/* ── Tax summary block ─────────────────────────────── */}
      <div
        className="mt-6 rounded-xl border overflow-hidden"
        style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 py-3 border-b"
          style={{ borderColor: '#e8e8f0', background: '#f9f9ff' }}
        >
          <Receipt className="w-4 h-4" style={{ color: '#6439ff' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#4a4a6a' }}>
            Resultado después de impuestos — {selectedYear}
          </h3>
        </div>

        <div className="divide-y" style={{ '--tw-divide-opacity': '1', borderColor: '#f0f0f8' } as React.CSSProperties}>
          {/* Resultado antes de impuestos */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm font-medium" style={{ color: '#4a4a6a' }}>
              Resultado antes de impuestos
            </span>
            <span
              className={`font-bold tabular-nums text-base ${
                totalNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'
              }`}
            >
              {totalNet >= 0 ? '+' : '-'}{fmt(totalNet)}
            </span>
          </div>

          {/* Tasa de impuesto */}
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" style={{ color: '#4a4a6a' }}>
                Tasa de impuesto
              </span>
              <div
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 border"
                style={{ borderColor: '#d4d0ff', background: '#f4f0ff' }}
              >
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => handleTaxRateChange(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-10 text-sm font-bold text-right bg-transparent outline-none"
                  style={{ color: '#6439ff' }}
                />
                <Percent className="w-3.5 h-3.5 shrink-0" style={{ color: '#6439ff' }} />
              </div>
            </div>
            <span className="text-sm tabular-nums" style={{ color: '#8b8ec0' }}>
              {taxRate.toFixed(1)}%
            </span>
          </div>

          {/* Monto de impuesto — doble click */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium" style={{ color: '#4a4a6a' }}>
                Monto de impuesto
              </span>
              <button
                onClick={() => setShowModal(true)}
                className="text-xs px-2 py-0.5 rounded-full transition hover:opacity-80"
                style={{ background: 'rgba(100,57,255,0.1)', color: '#6439ff' }}
                title="Ver detalle por categoría"
              >
                ver detalle
              </button>
            </div>
            <span
              className="font-bold tabular-nums text-[#fe4962] cursor-pointer hover:underline underline-offset-2"
              onDoubleClick={() => setShowModal(true)}
              title="Doble click para ver detalle por categoría"
            >
              {taxAmount > 0 ? `-${fmt(taxAmount)}` : '$0'}
            </span>
          </div>

          {/* Resultado neto after tax */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ background: '#f4f4ff' }}
          >
            <span className="font-bold text-sm" style={{ color: '#1a1a2e' }}>
              Resultado neto (after tax)
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                netAfterTax >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'
              }`}
            >
              {netAfterTax >= 0 ? '+' : '-'}{fmt(netAfterTax)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Modal detalle por categoría ───────────────────── */}
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
                  Detalle de impuestos por categoría
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                  Tasa aplicada: {taxRate}% · Año {selectedYear}
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
                <thead
                  className="sticky top-0"
                  style={{ background: '#f4f4ff' }}
                >
                  <tr>
                    <th
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: '#8b8ec0' }}
                    >
                      Categoría
                    </th>
                    <th
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                      style={{ color: '#8b8ec0' }}
                    >
                      Neto
                    </th>
                    <th
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                      style={{ color: '#8b8ec0' }}
                    >
                      Tasa
                    </th>
                    <th
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                      style={{ color: '#8b8ec0' }}
                    >
                      Impuesto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown
                    .filter(c => c.income > 0 || c.expense > 0)
                    .sort((a, b) => (b.income - b.expense) - (a.income - a.expense))
                    .map((cat, i) => {
                      const catNet = cat.income - cat.expense
                      const catTaxBase = Math.max(catNet, 0)
                      const catTax = catTaxBase * (taxRate / 100)
                      return (
                        <tr
                          key={i}
                          style={{ borderTop: '1px solid #f0f0f8' }}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium" style={{ color: '#1a1a2e' }}>
                              {cat.name}
                            </span>
                            <span
                              className="ml-2 text-xs px-1.5 py-0.5 rounded"
                              style={{
                                background:
                                  cat.catType === 'income'
                                    ? 'rgba(46,219,193,0.1)'
                                    : 'rgba(254,73,98,0.1)',
                                color:
                                  cat.catType === 'income' ? '#2edbc1' : '#fe4962',
                              }}
                            >
                              {cat.catType === 'income' ? 'ingreso' : 'gasto'}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-medium ${
                              catNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'
                            }`}
                          >
                            {catNet >= 0 ? '+' : '-'}{fmt(catNet)}
                          </td>
                          <td
                            className="px-4 py-3 text-right tabular-nums text-sm"
                            style={{ color: '#8b8ec0' }}
                          >
                            {catTaxBase > 0 ? `${taxRate}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#fe4962]">
                            {catTax > 0 ? `-${fmt(catTax)}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e0e0ef', background: '#f9f9ff' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: '#1a1a2e' }}>
                      Total
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold tabular-nums ${
                        totalNet >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'
                      }`}
                    >
                      {totalNet >= 0 ? '+' : '-'}{fmt(totalNet)}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-bold"
                      style={{ color: '#8b8ec0' }}
                    >
                      {taxRate}%
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-[#fe4962]">
                      {taxAmount > 0 ? `-${fmt(taxAmount)}` : '$0'}
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
