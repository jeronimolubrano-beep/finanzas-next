'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, DollarSign } from 'lucide-react'

interface Props {
  /** "YYYY-MM" for a single month, "YYYY" for a full year (auto-expands to YYYY-01/YYYY-12) */
  period: string
  rateType: string
  label: string
}

export function InlineFxLoader({ period, rateType, label }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Determine from/to from period string
  const isYear = /^\d{4}$/.test(period)
  const from   = isYear ? `${period}-01` : period
  const to     = isYear ? `${period}-12` : period

  async function handleLoad() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fx-rates/backfill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rate_type: rateType, from, to }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
         style={{ background: 'rgba(100,57,255,0.04)', borderColor: 'rgba(100,57,255,0.18)' }}>
      <DollarSign className="w-4 h-4 flex-shrink-0" style={{ color: '#6439ff' }} />
      <span className="text-sm" style={{ color: '#8b8ec0' }}>
        Sin TC histórico para <strong style={{ color: '#06083f' }}>{label}</strong>
        {' '}({rateType === 'blue' ? 'Blue' : 'Oficial'})
      </span>
      <button
        onClick={handleLoad}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition hover:opacity-80 disabled:opacity-50"
        style={{ borderColor: '#6439ff', color: '#6439ff', background: 'white' }}
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Cargando...' : 'Cargar ahora'}
      </button>
      {error && (
        <span className="text-xs" style={{ color: '#fe4962' }}>Error: {error}</span>
      )}
    </div>
  )
}
