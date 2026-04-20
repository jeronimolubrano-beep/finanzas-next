'use client'

import { useState, useTransition } from 'react'
import { saveReportCurrencySettings } from './actions'
import { DollarSign, BarChart3, RefreshCw, Check } from 'lucide-react'

const RATE_TYPES = [
  { value: 'oficial', label: 'Oficial (BCRA)' },
  { value: 'blue',    label: 'Blue (paralelo)' },
]

interface Props {
  usdMode:    boolean
  rateType:   string
  monthCount: number
}

export function ReportCurrencySettings({ usdMode, rateType, monthCount }: Props) {
  const [mode, setMode]   = useState(usdMode)
  const [type, setType]   = useState(rateType || 'oficial')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Backfill state
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)
  const [bYear, setBYear]     = useState(String(currentYear))
  const [bType, setBType]     = useState('oficial')
  const [bLoading, setBLoading] = useState(false)
  const [bResult, setBResult]   = useState<string | null>(null)
  const [bError, setBError]     = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('reports_usd_mode',  String(mode))
    fd.set('reports_rate_type', type)
    startTransition(async () => {
      await saveReportCurrencySettings(fd)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  async function handleBackfill(e: React.FormEvent) {
    e.preventDefault()
    setBLoading(true); setBResult(null); setBError(null)
    try {
      const res = await fetch('/api/fx-rates/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate_type: bType,
          from: `${bYear}-01`,
          to:   `${bYear}-12`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setBResult(
        `✓ ${data.processed_count} mes(es) procesados` +
        (data.skipped_count ? ` · ${data.skipped_count} sin datos` : '')
      )
    } catch (err) {
      setBError((err as Error).message)
    } finally {
      setBLoading(false)
    }
  }

  const cardStyle = { background: 'var(--card-bg)', borderColor: '#e8e8f0' }

  return (
    <div className="space-y-4">

      {/* ── Preferencias de reportes ── */}
      <div className="rounded-xl border overflow-hidden" style={cardStyle}>
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: '#e8e8f0' }}>
          <BarChart3 className="w-5 h-5" style={{ color: '#6439ff' }} />
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--navy)' }}>Moneda de reportes</h2>
            <p className="text-xs" style={{ color: '#8b8ec0' }}>
              {monthCount > 0
                ? `${monthCount} mes(es) con TC histórico en la base de datos`
                : 'Sin TC histórico guardado — cargalo más abajo'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          {/* Toggle USD mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Mostrar reportes en USD</p>
              <p className="text-xs" style={{ color: '#8b8ec0' }}>
                Convierte los montos usando el TC promedio mensual histórico
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMode(v => !v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: mode ? '#6439ff' : '#d1d5db' }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: mode ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
              />
            </button>
          </div>

          {/* Rate type selector */}
          {mode && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--navy)' }}>
                Tipo de cambio
              </label>
              <div className="flex gap-2">
                {RATE_TYPES.map(rt => (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => setType(rt.value)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition"
                    style={
                      type === rt.value
                        ? { background: '#6439ff', color: '#fff', borderColor: '#6439ff' }
                        : { background: 'transparent', color: '#8b8ec0', borderColor: '#e8e8f0' }
                    }
                  >
                    {rt.label}
                  </button>
                ))}
              </div>
              {monthCount === 0 && (
                <p className="text-xs mt-2 text-amber-600">
                  ⚠ No hay TC histórico. Los reportes mostrarán un botón para cargar los datos.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            style={{ background: '#6439ff' }}
          >
            {saved
              ? <><Check className="w-4 h-4" /> Guardado</>
              : isPending
                ? 'Guardando...'
                : <><DollarSign className="w-4 h-4" /> Guardar preferencias</>
            }
          </button>
        </form>
      </div>

      {/* ── Cargar TC histórico ── */}
      <details className="rounded-xl border overflow-hidden" style={cardStyle}>
        <summary className="px-5 py-3 text-sm font-medium cursor-pointer hover:bg-[#f9f9ff]"
                  style={{ color: '#8b8ec0' }}>
          Cargar TC histórico por año
        </summary>

        <form onSubmit={handleBackfill} className="px-5 pb-5 pt-3 space-y-3 border-t" style={{ borderColor: '#e8e8f0' }}>
          <p className="text-xs" style={{ color: '#8b8ec0' }}>
            Descarga las cotizaciones diarias de Bluelytics y guarda el promedio y cierre mensual de cada mes del año.
            Solo necesitás ejecutarlo una vez por año histórico.
          </p>

          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8b8ec0' }}>Tipo</label>
              <select
                value={bType}
                onChange={e => setBType(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e8e8f0' }}
              >
                {RATE_TYPES.map(rt => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8b8ec0' }}>Año</label>
              <select
                value={bYear}
                onChange={e => setBYear(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e8e8f0' }}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={bLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: '#6439ff', color: '#6439ff' }}
          >
            <RefreshCw className={`w-4 h-4 ${bLoading ? 'animate-spin' : ''}`} />
            {bLoading ? `Cargando ${bYear}...` : `Cargar TC de ${bYear}`}
          </button>

          {bResult && (
            <p className="text-sm font-medium" style={{ color: '#059669' }}>{bResult}</p>
          )}
          {bError && (
            <p className="text-sm" style={{ color: '#fe4962' }}>Error: {bError}</p>
          )}
        </form>
      </details>
    </div>
  )
}
