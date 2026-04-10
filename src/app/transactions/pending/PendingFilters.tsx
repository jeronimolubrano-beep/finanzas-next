'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Calendar, X } from 'lucide-react'

type QuickFilter = 'all' | 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'this-month' | 'custom'

const QUICK_FILTERS: { key: QuickFilter; label: string; color: string; activeColor: string }[] = [
  { key: 'all',        label: 'Todos',           color: '#8b8ec0', activeColor: '#6439ff' },
  { key: 'overdue',    label: 'Vencidos',         color: '#8b8ec0', activeColor: '#fe4962' },
  { key: 'today',      label: 'Hoy',              color: '#8b8ec0', activeColor: '#2edbc1' },
  { key: 'tomorrow',   label: 'Mañana',           color: '#8b8ec0', activeColor: '#f59e0b' },
  { key: 'this-week',  label: 'Esta semana',      color: '#8b8ec0', activeColor: '#8b6fff' },
  { key: 'next-week',  label: 'Próxima semana',   color: '#8b8ec0', activeColor: '#06b6d4' },
  { key: 'this-month', label: 'Este mes',         color: '#8b8ec0', activeColor: '#ec4899' },
]

export function PendingFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentFilter = (searchParams.get('filter') as QuickFilter) || 'all'
  const currentFrom = searchParams.get('from') || ''
  const currentTo = searchParams.get('to') || ''
  const [showCustom, setShowCustom] = useState(!!(currentFrom || currentTo))
  const [fromDate, setFromDate] = useState(currentFrom)
  const [toDate, setToDate] = useState(currentTo)

  function applyQuickFilter(key: QuickFilter) {
    const params = new URLSearchParams()
    params.set('filter', key)
    setShowCustom(false)
    setFromDate('')
    setToDate('')
    router.push(`/transactions/pending?${params.toString()}`)
  }

  function applyCustomRange() {
    if (!fromDate && !toDate) return
    const params = new URLSearchParams()
    params.set('filter', 'custom')
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    router.push(`/transactions/pending?${params.toString()}`)
  }

  function clearCustom() {
    setFromDate('')
    setToDate('')
    setShowCustom(false)
    router.push('/transactions/pending?filter=all')
  }

  const isCustomActive = currentFilter === 'custom'

  return (
    <div className="mb-6 space-y-3">
      {/* Quick filter pills */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map(f => {
          const isActive = currentFilter === f.key && !isCustomActive
          return (
            <button
              key={f.key}
              onClick={() => applyQuickFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive ? f.activeColor : 'var(--card-bg)',
                color: isActive ? 'white' : '#8b8ec0',
                border: `1px solid ${isActive ? f.activeColor : '#e8e8f0'}`,
              }}
            >
              {f.label}
            </button>
          )
        })}

        {/* Custom range toggle */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
          style={{
            background: isCustomActive || showCustom ? '#6439ff' : 'var(--card-bg)',
            color: isCustomActive || showCustom ? 'white' : '#8b8ec0',
            border: `1px solid ${isCustomActive || showCustom ? '#6439ff' : '#e8e8f0'}`,
          }}
        >
          <Calendar className="w-3.5 h-3.5" />
          Rango personalizado
        </button>
      </div>

      {/* Custom date range panel */}
      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border"
             style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8b8ec0' }}>
              Desde
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm border"
              style={{ background: '#f4f4fb', borderColor: '#e8e8f0', color: 'var(--navy)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8b8ec0' }}>
              Hasta
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm border"
              style={{ background: '#f4f4fb', borderColor: '#e8e8f0', color: 'var(--navy)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={applyCustomRange}
              disabled={!fromDate && !toDate}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-40"
              style={{ background: '#6439ff' }}
            >
              Buscar
            </button>
            <button
              onClick={clearCustom}
              className="p-1.5 rounded-lg text-sm transition"
              style={{ color: '#8b8ec0' }}
              title="Limpiar filtro"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active custom range label */}
          {isCustomActive && (
            <p className="w-full text-xs mt-1" style={{ color: '#6439ff' }}>
              Mostrando vencimientos
              {currentFrom ? ` desde ${currentFrom}` : ''}
              {currentTo ? ` hasta ${currentTo}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
