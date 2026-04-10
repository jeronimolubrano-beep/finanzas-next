'use client'

import { useState, useEffect, useCallback } from 'react'
import { addTransaction } from './actions'
import { Category, Account, Business } from '@/lib/types'
import { Save, List, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  categories: Category[]
  accounts: Account[]
  businesses: Business[]
  today: string
}

// Tasas de IVA en Argentina
const IVA_PRESETS = [
  { label: 'Sin IVA', value: 0 },
  { label: '21%', value: 21 },
  { label: '10,5%', value: 10.5 },
] as const

type TcStatus = 'loading' | 'ok' | 'no-data' | 'error'

export function TransactionForm({ categories, accounts, businesses, today }: Props) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [status, setStatus] = useState<'percibido' | 'devengado'>('percibido')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')

  // ── Feature 2: TC dinámico por fecha ──────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [tcRate, setTcRate] = useState<number | null>(null)
  const [tcStatus, setTcStatus] = useState<TcStatus>('loading')
  const [tcDateLabel, setTcDateLabel] = useState<string>('hoy')

  // ── Feature 1: IVA ─────────────────────────────────────────────────────────
  // ivaRate = 0 significa "sin IVA", 21 o 10.5 son tasas reales
  const [ivaRate, setIvaRate] = useState<number>(0)
  const [amount, setAmount] = useState<string>('') // controlado para back-calcular IVA

  // Back-cálculo: extrae el IVA del monto final
  // Fórmula: IVA = total × tasa / (100 + tasa)
  const parsedAmount = parseFloat(amount) || 0
  const ivaAmount =
    ivaRate > 0 && parsedAmount > 0
      ? parsedAmount * ivaRate / (100 + ivaRate)
      : null
  const baseImponible =
    ivaAmount !== null ? parsedAmount - ivaAmount : null

  // ── Lógica TC por fecha ────────────────────────────────────────────────────
  const fetchTC = useCallback(async (date: string) => {
    setTcStatus('loading')
    setTcRate(null)
    try {
      if (date === today) {
        // Hoy → usar endpoint existente de dolarapi.com
        const res = await fetch('/api/dolar')
        if (!res.ok) throw new Error('dolar api error')
        const rates = await res.json()
        const oficial = rates.find((r: { casa: string }) => r.casa === 'oficial')
        if (oficial) {
          setTcRate(oficial.venta)
          setTcDateLabel('hoy')
          setTcStatus('ok')
        } else {
          setTcStatus('error')
        }
      } else {
        // Histórico → usar nuevo endpoint Bluelytics
        const res = await fetch(`/api/dolar-historico?day=${date}`)
        if (res.status === 404) {
          // Fin de semana o feriado — es esperado, no un error
          setTcStatus('no-data')
          return
        }
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        const [y, m, d] = date.split('-')
        setTcRate(data.oficial_venta)
        setTcDateLabel(`${d}/${m}/${y}`)
        setTcStatus('ok')
      }
    } catch {
      setTcStatus('error')
    }
  }, [today])

  // Fetch inicial al montar
  useEffect(() => {
    fetchTC(today)
  }, [fetchTC, today])

  // Re-fetch cuando cambia la fecha
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setSelectedDate(newDate)
    if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      fetchTC(newDate)
    }
  }

  const filteredCategories = categories.filter(c => c.type === type)

  const labelClass = 'block text-sm font-medium mb-1'
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm border'
  const inputStyle = { borderColor: '#e8e8f0' }
  const labelStyle = { color: 'var(--navy)' }

  return (
    <form action={addTransaction} className="rounded-xl border p-6 space-y-4" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>

      {/* ── Fecha + Tipo ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Fecha <span className="text-[#fe4962]">*</span>
          </label>
          <input
            type="date"
            name="date"
            value={selectedDate}
            onChange={handleDateChange}
            required
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Tipo <span className="text-[#fe4962]">*</span>
          </label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense')}
            className={inputClass}
            style={inputStyle}
            required
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>
      </div>

      {/* ── Monto + Moneda ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Monto <span className="text-[#fe4962]">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2" style={{ color: '#8b8ec0' }}>$</span>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              style={{ ...inputStyle, paddingLeft: '1.75rem' }}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Moneda</label>
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')}
            className={inputClass}
            style={inputStyle}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* ── Feature 1: Campo IVA — solo para expenses ── */}
      {type === 'expense' && (
        <div
          className="rounded-lg p-3 border space-y-2"
          style={{ background: 'rgba(6,8,63,0.03)', borderColor: '#e8e8f0' }}
        >
          {/* Selector de tasa */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0" style={{ color: 'var(--navy)' }}>
              Tasa IVA
            </label>
            <div className="flex gap-2">
              {IVA_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setIvaRate(p.value)}
                  className="px-3 py-1 rounded-lg text-xs font-medium border transition"
                  style={
                    ivaRate === p.value
                      ? { background: '#6439ff', color: '#fff', borderColor: '#6439ff' }
                      : { background: '#fff', color: '#8b8ec0', borderColor: '#e8e8f0' }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desglose back-calculado — solo si hay tasa y monto */}
          {ivaAmount !== null && parsedAmount > 0 && (
            <div className="flex justify-between text-xs pt-1 border-t" style={{ borderColor: '#eeeef8' }}>
              <div className="space-y-0.5">
                <div style={{ color: '#8b8ec0' }}>
                  Base imponible:{' '}
                  <span className="font-semibold tabular-nums" style={{ color: '#06083f' }}>
                    ${baseImponible!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ color: '#8b8ec0' }}>
                  IVA {ivaRate}%:{' '}
                  <span className="font-semibold tabular-nums" style={{ color: '#6439ff' }}>
                    ${ivaAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="text-right" style={{ color: '#8b8ec0' }}>
                Total:{' '}
                <span className="font-bold tabular-nums" style={{ color: '#06083f' }}>
                  ${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Hidden input — guarda la tasa (0 = sin IVA) */}
          <input
            type="hidden"
            name="iva_rate"
            value={ivaRate > 0 ? String(ivaRate) : ''}
          />
        </div>
      )}

      {/* ── Descripcion ── */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Descripcion <span className="text-[#fe4962]">*</span>
        </label>
        <input
          type="text"
          name="description"
          required
          maxLength={200}
          placeholder="Ej: Sueldo marzo, Supermercado Coto"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* ── Feature 2: TC dinámico por fecha ── */}
      <div
        className="rounded-lg p-3 border"
        style={{ background: 'rgba(100,57,255,0.05)', borderColor: 'rgba(100,57,255,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium" style={{ color: '#6439ff' }}>
              TC oficial venta ({tcDateLabel}):
            </span>
            {tcStatus === 'loading' && (
              <span className="inline-flex items-center gap-1" style={{ color: '#8b8ec0' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Consultando...
              </span>
            )}
            {tcStatus === 'ok' && tcRate !== null && (
              <span className="font-bold" style={{ color: 'var(--navy)' }}>
                ${tcRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            )}
            {tcStatus === 'no-data' && (
              <span className="text-xs" style={{ color: '#f59e0b' }}>
                Sin datos (feriado o fin de semana)
              </span>
            )}
            {tcStatus === 'error' && (
              <span className="text-xs" style={{ color: '#dc2626' }}>
                Error al consultar — se guardará sin TC
              </span>
            )}
          </div>
          {currency === 'USD' && tcStatus === 'ok' && tcRate !== null && (
            <span className="text-xs" style={{ color: '#6439ff' }}>Se guardará con este TC</span>
          )}
        </div>
        <input type="hidden" name="exchange_rate" value={tcRate ?? ''} />
      </div>

      {/* ── Categoria + Cuenta ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Categoria <span className="text-[#fe4962]">*</span>
          </label>
          <select name="category_id" required className={inputClass} style={inputStyle}>
            {filteredCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Cuenta <span className="text-xs" style={{ color: '#8b8ec0' }}>(opcional)</span>
          </label>
          <select name="account_id" className={inputClass} style={inputStyle}>
            <option value="">Sin especificar</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tipo de gasto ── */}
      {type === 'expense' && (
        <div>
          <label className={labelClass} style={labelStyle}>
            Tipo de gasto <span className="text-[#fe4962]">*</span>
          </label>
          <select name="expense_type" className={inputClass} style={inputStyle}>
            <option value="ordinario">Ordinario (recurrente)</option>
            <option value="extraordinario">Extraordinario (puntual)</option>
          </select>
        </div>
      )}

      {/* ── Estado + Empresa ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Estado <span className="text-[#fe4962]">*</span>
          </label>
          <select
            name="status"
            required
            className={inputClass}
            style={inputStyle}
            value={status}
            onChange={(e) => setStatus(e.target.value as 'percibido' | 'devengado')}
          >
            <option value="percibido">Cobrado / Pagado</option>
            <option value="devengado">Pendiente</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Empresa <span className="text-[#fe4962]">*</span>
          </label>
          <select name="business_id" required className={inputClass} style={inputStyle}>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Fecha de vencimiento ── */}
      {status === 'devengado' && (
        <div>
          <label className={labelClass} style={labelStyle}>
            Fecha de vencimiento{' '}
            <span className="text-xs" style={{ color: '#8b8ec0' }}>(opcional)</span>
          </label>
          <input type="date" name="due_date" className={inputClass} style={inputStyle} />
        </div>
      )}

      {/* ── Notas ── */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Notas <span className="text-xs" style={{ color: '#8b8ec0' }}>(opcional)</span>
        </label>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Detalle adicional..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* ── Botones ── */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex items-center gap-2 text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          style={{ background: '#6439ff' }}
        >
          <Save className="w-4 h-4" />
          Guardar
        </button>
        <Link
          href="/transactions"
          className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#f4f4ff] transition"
          style={{ borderColor: '#e8e8f0', color: '#8b8ec0' }}
        >
          <List className="w-4 h-4" />
          Ver todas
        </Link>
      </div>
    </form>
  )
}
