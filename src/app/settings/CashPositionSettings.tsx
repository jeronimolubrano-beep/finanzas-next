'use client'

import { useState } from 'react'
import { formatMoney0 } from '@/lib/utils'
import { upsertCashPosition } from './actions'
import { Wallet, Check } from 'lucide-react'

interface Business {
  id: number
  name: string
}

interface CashPosition {
  business_id: number | null
  amount_ars: number
  recorded_at: string
}

interface Props {
  businesses: Business[]
  positions: CashPosition[]  // latest position per business
}

function BusinessCashRow({
  business,
  currentAmount,
  currentDate,
}: {
  business: Business | null   // null = consolidado
  currentAmount: number
  currentDate: string | null
}) {
  const [value, setValue] = useState(currentAmount === 0 ? '' : String(currentAmount))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = business ? business.name : 'Consolidado / Sin empresa'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(value.replace(/,/g, '').replace(/\./g, '')) || 0
    if (num < 0) { setError('El monto no puede ser negativo'); return }
    setSaving(true); setError(null)
    try {
      await upsertCashPosition(business?.id ?? null, num)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b last:border-0"
         style={{ borderColor: '#f0f0f8' }}>
      {/* Business name */}
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>{label}</p>
        {currentDate && (
          <p className="text-xs mt-0.5" style={{ color: '#a0a0c0' }}>
            Último registro: {currentDate} · ${formatMoney0(currentAmount)}
          </p>
        )}
        {!currentDate && (
          <p className="text-xs mt-0.5" style={{ color: '#c4c4d8' }}>Sin registro</p>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSave} className="flex items-center gap-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: '#8b8ec0' }}>$</span>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="0"
            className="pl-7 pr-3 py-2 rounded-lg border text-sm font-semibold text-right outline-none focus:ring-2 focus:ring-[#6439ff]/30"
            style={{ borderColor: '#e8e8f0', width: '140px', color: 'var(--navy)' }}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: saved ? '#2edbc1' : '#6439ff' }}
        >
          {saved
            ? <><Check className="w-4 h-4" /> Guardado</>
            : saving
              ? 'Guardando...'
              : 'Guardar'}
        </button>
      </form>

      {error && (
        <p className="text-xs w-full" style={{ color: '#fe4962' }}>{error}</p>
      )}
    </div>
  )
}

export function CashPositionSettings({ businesses, positions }: Props) {
  // Build map: business_id → latest position
  const posMap: Record<string, CashPosition> = {}
  for (const p of positions) {
    const key = p.business_id === null ? 'null' : String(p.business_id)
    posMap[key] = p
  }

  return (
    <div className="rounded-xl border overflow-hidden"
         style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b"
           style={{ borderColor: '#e8e8f0', background: '#f9f9ff' }}>
        <Wallet className="w-5 h-5" style={{ color: '#6439ff' }} />
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--navy)' }}>Posición de Caja</h2>
          <p className="text-xs" style={{ color: '#8b8ec0' }}>
            Ingresá el saldo actual de caja por empresa para calcular el Runway
          </p>
        </div>
      </div>

      {/* Rows */}
      <div>
        {businesses.map(b => {
          const pos = posMap[String(b.id)]
          return (
            <BusinessCashRow
              key={b.id}
              business={b}
              currentAmount={pos ? Number(pos.amount_ars) : 0}
              currentDate={pos?.recorded_at ?? null}
            />
          )
        })}
        {businesses.length === 0 && (
          <div className="px-5 py-6 text-center text-sm" style={{ color: '#a0a0c0' }}>
            No hay empresas configuradas. Agregá empresas para registrar posiciones de caja.
          </div>
        )}
      </div>
    </div>
  )
}
