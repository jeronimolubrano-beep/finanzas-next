'use client'

import { useRef, useState } from 'react'
import { ShieldCheck, X, Upload, AlertTriangle, CheckCircle, Info, Wrench } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface SuggestedFix {
  op: 'insert' | 'delete' | 'update_amount' | 'update_business' | 'none'
  // insert
  date?: string; description?: string; amount?: number; type?: string
  business_id?: number; currency?: string; status?: string; expense_type?: string
  // delete / update_business
  ids?: number[]
  // update_amount
  id?: number
  // update_business
  // update_amount / insert
  // none
  reason?: string
}

interface Inconsistency {
  tipo: 'faltante_en_db' | 'extra_en_db' | 'monto_diferente' | 'empresa_incorrecta' | 'consolidado'
  severidad: 'alta' | 'media' | 'baja'
  descripcion_informe: string | null
  empresa_informe: string | null
  monto_informe: number | null
  db_ids: number[]
  monto_db: number | null
  diferencia: number | null
  detalle: string
  suggested_fix?: SuggestedFix | null
}

interface VerifyResult {
  resumen: string
  totales_informe: { total_ingresos: number; total_gastos_ordinarios: number; total_gastos_extraordinarios: number }
  totales_db: { total_ingresos: number; total_gastos: number }
  inconsistencias: Inconsistency[]
  db_transaction_count: number
  month: string
}

interface ApplyFixResult {
  index: number; op: string; ok: boolean; message: string; inserted_id?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function diffColor(d: number | null) {
  if (d == null) return ''
  return Math.abs(d) <= 1 ? 'text-gray-400' : d < 0 ? 'text-[#fe4962]' : 'text-yellow-500'
}

const TIPO_LABEL: Record<string, string> = {
  faltante_en_db: 'Faltante en DB',
  extra_en_db: 'Extra en DB',
  monto_diferente: 'Monto ≠',
  empresa_incorrecta: 'Empresa ≠',
  consolidado: 'Consolidado',
}

const OP_LABEL: Record<string, string> = {
  insert: 'Crear transacción',
  delete: 'Eliminar',
  update_amount: 'Corregir monto',
  update_business: 'Corregir empresa',
  none: 'Sin cambio',
}

const SEV_FILTER = ['todos', 'alta', 'media', 'baja'] as const
type SevFilter = typeof SEV_FILTER[number]

function canApply(fix?: SuggestedFix | null): boolean {
  return !!fix && fix.op !== 'none'
}

// ── Component ────────────────────────────────────────────────────────────────

export function VerifyButton({ month }: { month?: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [filter, setFilter] = useState<SevFilter>('todos')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [applyResults, setApplyResults] = useState<ApplyFixResult[] | null>(null)

  if (!month) return null

  // ── File handling ──────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelected(new Set())
    setApplyResults(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('month', month!)
      const res = await fetch('/api/verify', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      const order = { alta: 0, media: 1, baja: 2 }
      data.inconsistencias?.sort((a: Inconsistency, b: Inconsistency) =>
        (order[a.severidad] ?? 2) - (order[b.severidad] ?? 2))
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Apply fixes ────────────────────────────────────────────────────────────
  async function handleApply() {
    if (!result || selected.size === 0) return
    setApplying(true)
    setApplyResults(null)
    try {
      const fixes = [...selected].map(i => result.inconsistencias[i].suggested_fix!)
      const res = await fetch('/api/verify/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixes, month: result.month }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al aplicar cambios')
      setApplyResults(data.results)
      // r.index = position in the fixes array = position in [...selected]
      // Keep only the ones that failed so the user can retry or dismiss them
      const successPositions = new Set(
        (data.results as ApplyFixResult[]).filter(r => r.ok).map(r => r.index)
      )
      const sortedSelected = [...selected]
      const newSelected = new Set<number>()
      sortedSelected.forEach((realIdx, pos) => {
        if (!successPositions.has(pos)) newSelected.add(realIdx)
      })
      setSelected(newSelected)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const visible = result
    ? (filter === 'todos' ? result.inconsistencias : result.inconsistencias.filter(i => i.severidad === filter))
    : []

  // Indices in result.inconsistencias that are currently visible
  const visibleIndices = result
    ? result.inconsistencias.reduce<number[]>((acc, inc, i) => {
        if (filter === 'todos' || inc.severidad === filter) acc.push(i)
        return acc
      }, [])
    : []

  const counts = result ? {
    alta: result.inconsistencias.filter(i => i.severidad === 'alta').length,
    media: result.inconsistencias.filter(i => i.severidad === 'media').length,
    baja: result.inconsistencias.filter(i => i.severidad === 'baja').length,
  } : null

  const applicableVisible = visibleIndices.filter(i => canApply(result?.inconsistencias[i].suggested_fix))
  const allVisibleSelected = applicableVisible.length > 0 && applicableVisible.every(i => selected.has(i))

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(prev => { const s = new Set(prev); applicableVisible.forEach(i => s.delete(i)); return s })
    } else {
      setSelected(prev => new Set([...prev, ...applicableVisible]))
    }
  }

  function toggleOne(idx: number) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(idx) ? s.delete(idx) : s.add(idx)
      return s
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition hover:bg-[#f4f4ff] disabled:opacity-50"
        style={{ borderColor: '#6439ff', color: '#6439ff' }}
        title={`Verificar informe de ${month}`}
      >
        {loading
          ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : <ShieldCheck className="w-4 h-4" />}
        {loading ? 'Analizando...' : 'Verificar informe'}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      {/* Error toast */}
      {error && !result && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-white border border-[#fe4962] rounded-xl shadow-lg px-4 py-3 max-w-sm">
          <AlertTriangle className="w-5 h-5 text-[#fe4962] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#fe4962]">Error en verificación</p>
            <p className="text-xs text-gray-500 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      )}

      {/* Results modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" style={{ background: 'rgba(15,15,40,0.65)' }}>
          <div className="w-full max-w-6xl rounded-2xl shadow-2xl mb-8" style={{ background: 'var(--card-bg, #fff)' }}>

            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: '#e8e8f0' }}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--navy)' }}>
                  <ShieldCheck className="w-5 h-5" style={{ color: '#6439ff' }} />
                  Verificación {result.month.slice(5)}/{result.month.slice(0, 4)}
                </h2>
                <p className="text-sm mt-1" style={{ color: '#8b8ec0' }}>{result.resumen}</p>
              </div>
              <button onClick={() => { setResult(null); setFilter('todos'); setSelected(new Set()); setApplyResults(null) }}
                className="p-1 rounded-lg hover:bg-gray-100 ml-4 flex-shrink-0">
                <X className="w-5 h-5" style={{ color: '#8b8ec0' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Severidad Alta', value: counts!.alta, color: counts!.alta > 0 ? '#fe4962' : '#2edbc1' },
                  { label: 'Severidad Media', value: counts!.media, color: counts!.media > 0 ? '#f59e0b' : '#2edbc1' },
                  { label: 'Severidad Baja', value: counts!.baja, color: '#8b8ec0' },
                  { label: 'Tx en DB', value: result.db_transaction_count, color: '#6439ff' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border p-3 text-center" style={{ borderColor: '#e8e8f0' }}>
                    <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Totals comparison */}
              {(result.totales_informe || result.totales_db) && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e8e8f0' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#f4f4ff' }}>
                        {['Concepto', 'Informe', 'Base de Datos', 'Diferencia'].map(h => (
                          <th key={h} className={`px-4 py-2 text-xs font-semibold uppercase ${h === 'Concepto' ? 'text-left' : 'text-right'}`} style={{ color: '#8b8ec0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: '#f0f0f8' }}>
                      {[
                        { label: 'Ingresos', inf: result.totales_informe?.total_ingresos, db: result.totales_db?.total_ingresos },
                        { label: 'Gastos Ordinarios', inf: result.totales_informe?.total_gastos_ordinarios, db: result.totales_db?.total_gastos },
                      ].map(row => {
                        const diff = (row.db ?? 0) - (row.inf ?? 0)
                        return (
                          <tr key={row.label}>
                            <td className="px-4 py-2 font-medium text-sm" style={{ color: 'var(--navy)' }}>{row.label}</td>
                            <td className="px-4 py-2 text-right text-sm" style={{ color: '#8b8ec0' }}>${fmt(row.inf)}</td>
                            <td className="px-4 py-2 text-right text-sm" style={{ color: '#8b8ec0' }}>${fmt(row.db)}</td>
                            <td className={`px-4 py-2 text-right text-sm font-semibold ${diffColor(diff)}`}>${fmt(diff)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Apply results banner */}
              {applyResults && (
                <div className={`rounded-xl p-4 border ${applyResults.every(r => r.ok) ? 'border-[#2edbc1] bg-[rgba(46,219,193,0.06)]' : 'border-yellow-300 bg-yellow-50'}`}>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--navy)' }}>
                    Resultado: {applyResults.filter(r => r.ok).length} aplicados, {applyResults.filter(r => !r.ok).length} fallidos
                  </p>
                  <div className="space-y-1">
                    {applyResults.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        {r.ok
                          ? <CheckCircle className="w-3.5 h-3.5 text-[#2edbc1] flex-shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-[#fe4962] flex-shrink-0 mt-0.5" />}
                        <span style={{ color: r.ok ? '#2edbc1' : '#fe4962' }}>{r.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No issues */}
              {result.inconsistencias.length === 0 && (
                <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: 'rgba(46,219,193,0.08)', border: '1px solid rgba(46,219,193,0.3)' }}>
                  <CheckCircle className="w-5 h-5 text-[#2edbc1] flex-shrink-0" />
                  <p className="text-sm font-medium text-[#2edbc1]">Sin inconsistencias — las transacciones coinciden con el informe.</p>
                </div>
              )}

              {/* Inconsistencies table */}
              {result.inconsistencias.length > 0 && (
                <>
                  {/* Filter + select-all + apply button row */}
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Info className="w-4 h-4 flex-shrink-0" style={{ color: '#8b8ec0' }} />
                      {SEV_FILTER.map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition ${filter === s ? 'text-white border-[#6439ff]' : 'border-[#e8e8f0] hover:bg-[#f4f4ff]'}`}
                          style={filter === s ? { background: '#6439ff' } : { color: '#8b8ec0' }}>
                          {s === 'todos' ? `Todos (${result.inconsistencias.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts![s as keyof typeof counts]})`}
                        </button>
                      ))}
                    </div>

                    {/* Apply button */}
                    {selected.size > 0 && (
                      <button
                        onClick={handleApply}
                        disabled={applying}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        style={{ background: '#6439ff' }}
                      >
                        {applying
                          ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Wrench className="w-4 h-4" />}
                        {applying ? 'Aplicando...' : `Aplicar ${selected.size} cambio${selected.size > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e8e8f0' }}>
                    <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0" style={{ background: '#f4f4ff' }}>
                          <tr>
                            {/* Select-all checkbox */}
                            <th className="px-3 py-2 w-8">
                              {applicableVisible.length > 0 && (
                                <input type="checkbox" checked={allVisibleSelected}
                                  onChange={toggleAll}
                                  className="rounded cursor-pointer accent-[#6439ff]"
                                  title="Seleccionar todos los aplicables" />
                              )}
                            </th>
                            {['Sev.', 'Tipo', 'Ítem del informe', 'Empresa', 'Informe', 'DB', 'Dif.', 'Fix propuesto', 'Detalle'].map(h => (
                              <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase ${['Informe', 'DB', 'Dif.'].includes(h) ? 'text-right' : 'text-left'}`} style={{ color: '#8b8ec0' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: '#f0f0f8' }}>
                          {visible.map((inc, visPos) => {
                            const realIdx = visibleIndices[visPos]
                            const applicable = canApply(inc.suggested_fix)
                            const isSelected = selected.has(realIdx)
                            const applyRes = applyResults?.find(r => r.index === [...selected].indexOf(realIdx))

                            return (
                              <tr key={realIdx}
                                className={`hover:bg-[#f9f9ff] transition ${isSelected ? 'bg-[#f4f4ff]' : ''}`}>
                                {/* Checkbox */}
                                <td className="px-3 py-2.5 text-center">
                                  {applicable && (
                                    <input type="checkbox" checked={isSelected}
                                      onChange={() => toggleOne(realIdx)}
                                      className="rounded cursor-pointer accent-[#6439ff]" />
                                  )}
                                </td>

                                {/* Severity */}
                                <td className="px-3 py-2.5">
                                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                    inc.severidad === 'alta' ? 'text-[#fe4962] bg-[rgba(254,73,98,0.1)]'
                                    : inc.severidad === 'media' ? 'text-yellow-600 bg-yellow-50'
                                    : 'text-gray-500 bg-gray-100'}`}>
                                    {inc.severidad}
                                  </span>
                                </td>

                                {/* Type */}
                                <td className="px-3 py-2.5">
                                  <span className="text-xs px-1.5 py-0.5 rounded border" style={{ borderColor: '#e8e8f0', color: '#6439ff' }}>
                                    {TIPO_LABEL[inc.tipo] ?? inc.tipo}
                                  </span>
                                </td>

                                {/* Item name */}
                                <td className="px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--navy)', maxWidth: '160px' }}>
                                  <div className="truncate" title={inc.descripcion_informe ?? ''}>{inc.descripcion_informe ?? '—'}</div>
                                  {inc.db_ids?.length > 0 && (
                                    <div className="text-[10px] mt-0.5" style={{ color: '#8b8ec0' }}>IDs: {inc.db_ids.join(', ')}</div>
                                  )}
                                </td>

                                {/* Company */}
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#8b8ec0' }}>{inc.empresa_informe ?? '—'}</td>

                                {/* Amounts */}
                                <td className="px-3 py-2.5 text-right text-xs font-mono" style={{ color: '#8b8ec0' }}>
                                  {inc.monto_informe != null ? `$${fmt(inc.monto_informe)}` : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right text-xs font-mono" style={{ color: '#8b8ec0' }}>
                                  {inc.monto_db != null ? `$${fmt(inc.monto_db)}` : '—'}
                                </td>
                                <td className={`px-3 py-2.5 text-right text-xs font-mono font-semibold ${diffColor(inc.diferencia)}`}>
                                  {inc.diferencia != null ? `$${fmt(inc.diferencia)}` : '—'}
                                </td>

                                {/* Suggested fix */}
                                <td className="px-3 py-2.5 text-xs" style={{ maxWidth: '140px' }}>
                                  {inc.suggested_fix?.op === 'none' ? (
                                    <span style={{ color: '#8b8ec0' }}>{inc.suggested_fix.reason ?? 'Sin cambio'}</span>
                                  ) : inc.suggested_fix ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                      style={{ background: 'rgba(100,57,255,0.08)', color: '#6439ff' }}>
                                      {OP_LABEL[inc.suggested_fix.op] ?? inc.suggested_fix.op}
                                      {inc.suggested_fix.op === 'update_amount' && inc.suggested_fix.amount != null &&
                                        ` → $${fmt(inc.suggested_fix.amount)}`}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#c8cce0' }}>—</span>
                                  )}
                                </td>

                                {/* Detail */}
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#8b8ec0', maxWidth: '220px' }}>
                                  {inc.detalle}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs" style={{ color: '#8b8ec0' }}>
                  {selected.size > 0
                    ? `${selected.size} cambio${selected.size > 1 ? 's' : ''} seleccionado${selected.size > 1 ? 's' : ''}`
                    : 'Seleccioná los cambios que querés aplicar usando los checkboxes'}
                </p>
                <button onClick={() => fileRef.current?.click()} disabled={loading || applying}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:bg-[#f4f4ff] disabled:opacity-50"
                  style={{ borderColor: '#6439ff', color: '#6439ff' }}>
                  <Upload className="w-3.5 h-3.5" />
                  Verificar otro archivo
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  )
}
