'use client'

/**
 * TCSelector — selector de tipo de cambio (Configuración / Oficial / Blue).
 *
 * Para períodos pasados consulta el TC histórico (Bluelytics).
 * Para el período actual usa solo el TC de Configuración.
 *
 * Al elegir un modo, actualiza los query params tcMode y tcValue en la URL
 * para que el server component los use en sus cálculos.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  /** Período representativo YYYY-MM para buscar TC histórico.
   *  En vistas anuales pasar el último mes del año (ej. "2024-12"). */
  period: string
  /** TC actual de configuración */
  settingsTc: number
  settingsDate?: string | null
  settingsType?: string | null
}

const NOW = new Date()
const CURRENT_PERIOD = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`

export function TCSelector({ period, settingsTc, settingsDate, settingsType }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tcMode = (searchParams.get('tcMode') ?? 'settings') as 'settings' | 'oficial' | 'blue'

  const [historical, setHistorical] = useState<{ oficial: number; blue: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const isPast = period < CURRENT_PERIOD

  useEffect(() => {
    if (!isPast) return
    setLoading(true)
    fetch(`/api/tc-history?period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.oficial || data?.blue) {
          setHistorical({ oficial: data.oficial ?? 0, blue: data.blue ?? 0 })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, isPast])

  const selectMode = useCallback(
    (mode: 'settings' | 'oficial' | 'blue', value: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tcMode', mode)
      params.set('tcValue', String(value))
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const activeValue =
    tcMode === 'oficial' && historical?.oficial ? historical.oficial :
    tcMode === 'blue'    && historical?.blue    ? historical.blue    :
    settingsTc

  const activeLabel =
    tcMode === 'oficial' ? `Oficial · prom. ${period}` :
    tcMode === 'blue'    ? `Blue · prom. ${period}`    :
    `${settingsType ?? 'Config'}${settingsDate ? ` · ${new Date(settingsDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}` : ''}`

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5"
      style={{ background: '#fafaff', borderColor: '#e8e8f0' }}
    >
      {/* Label */}
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>
        TC USD
      </span>

      {loading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#8b8ec0' }} />}

      {/* Botones de modo */}
      <div className="flex gap-1.5 flex-wrap">
        {/* Configuración */}
        <button
          onClick={() => selectMode('settings', settingsTc)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border-2 transition-all ${
            tcMode === 'settings'
              ? 'border-[#6439ff] bg-[rgba(100,57,255,0.08)]'
              : 'border-transparent bg-white hover:bg-gray-50'
          }`}
        >
          <span style={{ color: tcMode === 'settings' ? '#6439ff' : '#4a4a6a' }}>⚙️ Config</span>
          <span className="tabular-nums" style={{ color: '#8b8ec0' }}>
            ${settingsTc.toLocaleString('es-AR')}
          </span>
        </button>

        {/* Oficial — solo para períodos pasados */}
        {isPast && (
          <button
            onClick={() => historical?.oficial && selectMode('oficial', historical.oficial)}
            disabled={!historical?.oficial && !loading}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              tcMode === 'oficial'
                ? 'border-[#2edbc1] bg-[rgba(46,219,193,0.08)]'
                : 'border-transparent bg-white hover:bg-gray-50'
            }`}
          >
            <span style={{ color: tcMode === 'oficial' ? '#1aab96' : '#4a4a6a' }}>🏦 Oficial</span>
            <span className="tabular-nums" style={{ color: '#8b8ec0' }}>
              {loading ? '…' : historical?.oficial ? `$${historical.oficial.toLocaleString('es-AR')}` : 'N/D'}
            </span>
          </button>
        )}

        {/* Blue — solo para períodos pasados */}
        {isPast && (
          <button
            onClick={() => historical?.blue && selectMode('blue', historical.blue)}
            disabled={!historical?.blue && !loading}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              tcMode === 'blue'
                ? 'border-[#6439ff] bg-[rgba(100,57,255,0.08)]'
                : 'border-transparent bg-white hover:bg-gray-50'
            }`}
          >
            <span style={{ color: tcMode === 'blue' ? '#6439ff' : '#4a4a6a' }}>💵 Blue</span>
            <span className="tabular-nums" style={{ color: '#8b8ec0' }}>
              {loading ? '…' : historical?.blue ? `$${historical.blue.toLocaleString('es-AR')}` : 'N/D'}
            </span>
          </button>
        )}
      </div>

      {/* TC activo */}
      <span className="text-[11px] ml-auto whitespace-nowrap" style={{ color: '#8b8ec0' }}>
        Usando{' '}
        <strong style={{ color: '#6439ff' }}>
          ${activeValue.toLocaleString('es-AR')} ARS/USD
        </strong>
        {' '}· {activeLabel}
      </span>
    </div>
  )
}
