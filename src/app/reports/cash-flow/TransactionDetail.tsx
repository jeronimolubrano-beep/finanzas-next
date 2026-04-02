'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatMoney, formatDateAR, statusLabel } from '@/lib/utils'

interface Tx {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  status: string
  expense_type: string | null
  categories: { name: string } | null
  businesses: { name: string } | null
}

type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

export function TransactionDetail({ transactions }: { transactions: Tx[] }) {
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('date_desc')

  const sorted = [...transactions].sort((a, b) => {
    if (sort === 'date_desc') return b.date.localeCompare(a.date)
    if (sort === 'date_asc')  return a.date.localeCompare(b.date)
    if (sort === 'amount_desc') return Number(b.amount) - Number(a.amount)
    return Number(a.amount) - Number(b.amount)
  })

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e8e8f0' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
        style={{ background: '#fafafa', borderBottom: open ? '1px solid #e8e8f0' : 'none' }}
      >
        <span className="text-sm font-semibold" style={{ color: '#06083f' }}>
          Detalle de transacciones
          <span className="ml-2 text-xs font-normal" style={{ color: '#8b8ec0' }}>
            ({transactions.length} registros)
          </span>
        </span>
        {open
          ? <ChevronUp className="w-4 h-4" style={{ color: '#8b8ec0' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: '#8b8ec0' }} />
        }
      </button>

      {open && (
        <>
          {/* Sort control */}
          <div className="px-5 py-2 border-b flex items-center gap-2" style={{ borderColor: '#f0f0f8', background: '#fafafe' }}>
            <span className="text-xs" style={{ color: '#8b8ec0' }}>Ordenar por:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="rounded-lg px-2 py-1 text-xs border"
              style={{ borderColor: '#e8e8f0', color: '#06083f' }}
            >
              <option value="date_desc">Más nuevo primero</option>
              <option value="date_asc">Más antiguo primero</option>
              <option value="amount_desc">Mayor monto primero</option>
              <option value="amount_asc">Menor monto primero</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f4f4ff' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Fecha</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Descripción</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Empresa</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Categoría</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Tipo</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Monto</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.id} className="border-t hover:bg-gray-50/50 transition" style={{ borderColor: '#f0f0f8' }}>
                    <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: '#8b8ec0' }}>
                      {formatDateAR(t.date)}
                    </td>
                    <td className="px-4 py-2 text-xs max-w-[280px] truncate" style={{ color: '#06083f' }} title={t.description}>
                      {t.description}
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: '#8b8ec0' }}>
                      {(t.businesses as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: '#8b8ec0' }}>
                      {(t.categories as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        t.expense_type === 'extraordinario'
                          ? 'bg-orange-50 text-orange-600'
                          : t.type === 'income'
                          ? 'bg-teal-50 text-teal-600'
                          : 'bg-red-50 text-red-500'
                      }`}>
                        {t.expense_type === 'extraordinario' ? 'Extraord.' : t.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-right text-xs font-semibold tabular-nums ${
                      t.type === 'income' ? 'text-[#2edbc1]' : 'text-[#fe4962]'
                    }`}>
                      {t.type === 'income' ? '' : '('}${formatMoney(Number(t.amount))}{t.type === 'expense' ? ')' : ''}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.status === 'devengado'
                          ? 'bg-yellow-50 text-yellow-600'
                          : 'bg-teal-50 text-teal-600'
                      }`}>
                        {statusLabel(t.status, t.type)}
                      </span>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#8b8ec0' }}>
                      Sin transacciones en este período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
