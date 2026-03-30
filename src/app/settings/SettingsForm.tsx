'use client'

import { useState, useEffect } from 'react'
import { selectDolarRate } from './actions'
import { Save, DollarSign, RefreshCw, Check, TrendingUp, TrendingDown } from 'lucide-react'

interface DolarRate {
  casa: string
  nombre: string
  compra: number
  venta: number
  fecha: string
}

interface Props {
  currentRate: string
  rateDate: string
  rateType: string
}

const rateLabels: Record<string, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  bolsa: 'MEP (Bolsa)',
  contadoconliqui: 'CCL',
  tarjeta: 'Tarjeta',
}

export function SettingsForm({ currentRate, rateDate, rateType }: Props) {
  const [rates, setRates] = useState<DolarRate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchRates() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dolar')
      if (!res.ok) throw new Error('Error al obtener cotizaciones')
      const data = await res.json()
      setRates(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
  }, [])

  async function handleSelect(rate: DolarRate) {
    setSaving(rate.casa)
    const dateStr = new Date(rate.fecha).toISOString().slice(0, 10)
    await selectDolarRate(
      String(rate.venta),
      dateStr,
      rateLabels[rate.casa] || rate.nombre
    )
    setSaving(null)
    window.location.reload()
  }

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const labelStyle = { color: '#6439ff' }
  const cardStyle = { background: 'var(--card-bg)', borderColor: '#e8e8f0' }

  return (
    <div className="space-y-6">
      {/* TC actual */}
      {currentRate && (
        <div className="rounded-xl border p-5" style={{ ...cardStyle, background: 'rgba(100,57,255,0.05)', borderColor: 'rgba(100,57,255,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5" style={labelStyle} />
            <span className="font-semibold" style={labelStyle}>Tipo de cambio activo</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold" style={{ color: 'var(--navy)' }}>${Number(currentRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="text-sm" style={{ color: '#6439ff' }}>ARS/USD</span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#8b8ec0' }}>
            {rateType && <span className="font-medium">{rateType}</span>}
            {rateDate && <span> — actualizado {rateDate}</span>}
          </p>
        </div>
      )}

      {/* Cotizaciones en vivo */}
      <div className="rounded-xl border overflow-hidden" style={cardStyle}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e8e8f0' }}>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--navy)' }}>Cotizaciones en vivo</h2>
            <p className="text-xs" style={{ color: '#8b8ec0' }}>Fuente: dolarapi.com</p>
          </div>
          <button
            onClick={fetchRates}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm hover:opacity-70 disabled:opacity-50 transition"
            style={{ color: '#6439ff' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm" style={{ background: 'rgba(254,73,98,0.05)', color: '#fe4962' }}>{error}</div>
        )}

        <div className="divide-y" style={{ borderColor: '#f0f0f8' }}>
          {rates.map(rate => {
            const isActive = currentRate === String(rate.venta) && rateType === (rateLabels[rate.casa] || rate.nombre)
            return (
              <div key={rate.casa}
                   className="px-5 py-4 flex items-center justify-between hover:bg-[#f9f9ff] transition"
                   style={{ background: isActive ? 'rgba(100,57,255,0.03)' : '' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: 'var(--navy)' }}>
                      {rateLabels[rate.casa] || rate.nombre}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(100,57,255,0.1)', color: '#6439ff' }}>
                        <Check className="w-3 h-3" /> Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>{formatDate(rate.fecha)}</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#8b8ec0' }}>
                      <TrendingDown className="w-3 h-3" /> Compra
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--navy)' }}>
                      ${rate.compra.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#8b8ec0' }}>
                      <TrendingUp className="w-3 h-3" /> Venta
                    </div>
                    <span className="font-bold" style={{ color: 'var(--navy)' }}>
                      ${rate.venta.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelect(rate)}
                    disabled={saving === rate.casa || isActive}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    style={{
                      background: isActive ? '#f0f0f8' : saving === rate.casa ? 'rgba(100,57,255,0.2)' : '#6439ff',
                      color: isActive ? '#8b8ec0' : saving === rate.casa ? '#6439ff' : 'white',
                      cursor: isActive ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving === rate.casa ? 'Guardando...' : isActive ? 'Seleccionado' : 'Usar este'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {rates.length === 0 && !loading && !error && (
          <div className="px-5 py-8 text-center text-sm" style={{ color: '#8b8ec0' }}>
            Cargando cotizaciones...
          </div>
        )}
      </div>

      {/* Manual override */}
      <details className="rounded-xl border overflow-hidden" style={cardStyle}>
        <summary className="px-5 py-3 text-sm font-medium cursor-pointer hover:bg-[#f9f9ff]" style={{ color: '#8b8ec0' }}>
          Ingresar tipo de cambio manualmente
        </summary>
        <form action={async (formData: FormData) => {
          const rate = formData.get('current_rate') as string
          const date = formData.get('rate_date') as string
          await selectDolarRate(rate, date, 'Manual')
          window.location.reload()
        }} className="px-5 pb-5 pt-2 space-y-3 border-t" style={{ borderColor: '#e8e8f0' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8b8ec0' }}>ARS por 1 USD</label>
              <div className="relative">
                <span className="absolute left-3 top-2" style={{ color: '#8b8ec0' }}>$</span>
                <input type="number" name="current_rate" step="0.01" min="0"
                       placeholder="1400.00"
                       className="w-full rounded-lg pl-7 pr-3 py-2 text-sm border"
                       style={{ borderColor: '#e8e8f0' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8b8ec0' }}>Fecha</label>
              <input type="date" name="rate_date"
                     defaultValue={new Date().toISOString().slice(0, 10)}
                     className="w-full rounded-lg px-3 py-2 text-sm border"
                     style={{ borderColor: '#e8e8f0' }} />
            </div>
          </div>
          <button type="submit"
                  className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition"
                  style={{ background: '#6439ff' }}>
            <Save className="w-3 h-3" />
            Guardar manual
          </button>
        </form>
      </details>
    </div>
  )
}
