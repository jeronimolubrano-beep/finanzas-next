'use client'

import { useState, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { parseExcelCashflow, type ParsedTransaction } from '@/lib/excel-parser'
import { saveImportedTransactions, getCategories, getSettingsExchangeRate } from './actions'
import { formatMoney } from '@/lib/utils'
import { Upload, FileSpreadsheet, FileText, CheckCircle, AlertTriangle, Loader2, Trash2, ArrowLeft, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
}

type Step = 'upload' | 'preview' | 'done'

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [period, setPeriod] = useState('')
  const [exchangeRate, setExchangeRate] = useState(0)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [pdfMode, setPdfMode] = useState<'summary' | 'detail'>('detail')
  const [useAIMode, setUseAIMode] = useState(false)
  const [aiNotes, setAiNotes] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<ParsedTransaction | null>(null)
  const [tcHistorico, setTcHistorico] = useState<{ oficial: number; blue: number } | null>(null)
  const [tcLoading, setTcLoading] = useState(false)
  const [tcMode, setTcMode] = useState<'settings' | 'oficial' | 'blue'>('settings')

  // Cargar categorías y TC al montar
  useEffect(() => {
    getCategories().then(setCategories)
    getSettingsExchangeRate().then(setExchangeRate)
  }, [])

  // Consultar TC histórico cuando cambia el período
  useEffect(() => {
    if (!period) return
    setTcHistorico(null)
    setTcLoading(true)
    fetch(`/api/tc-history?period=${period}`)
      .then(r => r.json())
      .then(data => {
        if (data.oficial || data.blue) setTcHistorico({ oficial: data.oficial, blue: data.blue })
      })
      .catch(() => {})
      .finally(() => setTcLoading(false))
  }, [period])

  // Generar período default (mes anterior)
  useEffect(() => {
    if (!period) {
      const now = new Date()
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const y = prev.getFullYear()
      const m = String(prev.getMonth() + 1).padStart(2, '0')
      setPeriod(`${y}-${m}`)
    }
  }, [period])

  // TC efectivo según modo seleccionado
  const effectiveTC =
    tcMode === 'oficial' && tcHistorico?.oficial ? tcHistorico.oficial :
    tcMode === 'blue'    && tcHistorico?.blue    ? tcHistorico.blue    :
    exchangeRate

  const processFile = useCallback(async (file: File) => {
    if (!period) {
      toast.error('Seleccioná un período primero')
      return
    }

    setLoading(true)
    setFileName(file.name)

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isPdf = ext === 'pdf'

    try {
      if (useAIMode) {
        // ── Modo IA: Claude parsea cualquier PDF o Excel ───────────────────
        const formData = new FormData()
        formData.append('file', file)
        formData.append('period', period)
        formData.append('exchangeRate', String(effectiveTC))
        formData.append('mode', pdfMode)

        const res = await fetch('/api/ai-parse', { method: 'POST', body: formData })
        const result = await res.json()

        if (!res.ok || result.error) {
          toast.error(result.error ?? 'Error al procesar el archivo con IA')
          setLoading(false)
          return
        }

        if (!result.transactions || result.transactions.length === 0) {
          toast.error('Claude no encontró transacciones en el documento')
          setLoading(false)
          return
        }

        if (result.notes) setAiNotes(result.notes)

        // FASE 5: Mostrar advertencia si hay filas omitidas
        if (result.discardedCount && result.discardedCount > 0) {
          const reasons = result.discardReasons?.join('\n• ') || ''
          toast.error(
            `⚠️ Se omitieron ${result.discardedCount} filas sin monto válido`,
            { duration: 5000 }
          )
          if (reasons) {
            setAiNotes(prev =>
              (prev ? prev + '\n\n' : '') + '📋 Omitidas por falta de monto:\n• ' + reasons
            )
          }
        }

        if (result.detectedPeriod && result.detectedPeriod !== period) {
          toast(`Período detectado: ${result.detectedPeriod}`, { icon: '📅' })
        }
        if (result.detectedExchangeRate && result.detectedExchangeRate !== effectiveTC) {
          toast(`TC detectado en el doc: $${result.detectedExchangeRate}`, { icon: '💱' })
        }

        setTransactions(result.transactions)
        setStep('preview')
        toast.success(`✨ Claude extrajo ${result.transactions.length} transacciones`)
      } else if (isPdf) {
        // ── Modo clásico PDF ───────────────────────────────────────────────
        const formData = new FormData()
        formData.append('file', file)
        formData.append('period', period)
        formData.append('exchangeRate', String(effectiveTC))
        formData.append('mode', pdfMode)

        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
        const result = await res.json()

        if (!res.ok || result.error) {
          toast.error(result.error ?? 'Error al procesar el PDF')
          setLoading(false)
          return
        }

        if (!result.transactions || result.transactions.length === 0) {
          toast.error('No se encontraron transacciones en el PDF')
          setLoading(false)
          return
        }

        setTransactions(result.transactions)
        setStep('preview')
        toast.success(`Se parsearon ${result.transactions.length} transacciones del PDF`)
      } else {
        // ── Modo clásico Excel ────────────────────────────────────────────
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: 'array' })
            const parsed = parseExcelCashflow(workbook, period, exchangeRate)

            if (parsed.length === 0) {
              toast.error('No se encontraron transacciones en el archivo')
              setLoading(false)
              return
            }

            setTransactions(parsed)
            setStep('preview')
            toast.success(`Se parsearon ${parsed.length} transacciones`)
          } catch (err) {
            console.error('Error parsing Excel:', err)
            toast.error('Error al leer el archivo Excel')
          }
          setLoading(false)
        }
        reader.readAsArrayBuffer(file)
        return // early return — loading se maneja en onload
      }
    } catch (err) {
      console.error('Error processing file:', err)
      toast.error('Error al procesar el archivo')
    }
    setLoading(false)
  }, [period, effectiveTC, pdfMode, useAIMode])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const toggleTransaction = (id: string) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    )
  }

  const toggleAll = () => {
    const allSelected = transactions.every(t => t.selected)
    setTransactions(prev => prev.map(t => ({ ...t, selected: !allSelected })))
  }

  const updateCategory = (id: string, categoryName: string | null) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, categoryName } : t)
    )
  }

  const removeTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const updateTransaction = (updated: ParsedTransaction) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditingTx(null)
  }

  // Resolver category name → id
  function getCategoryId(categoryName: string | null, type: 'income' | 'expense'): number | null {
    if (!categoryName) return null
    const cat = categories.find(c => c.name === categoryName && c.type === type)
    return cat?.id ?? null
  }

  const handleImport = async () => {
    const selected = transactions.filter(t => t.selected)
    if (selected.length === 0) {
      toast.error('No hay transacciones seleccionadas')
      return
    }

    // Verificar que haya categorías sin asignar
    const noCat = selected.filter(t => !t.categoryName)
    if (noCat.length > 0) {
      const proceed = confirm(
        `Hay ${noCat.length} transacciones sin categoría asignada. ¿Importar de todas formas?`
      )
      if (!proceed) return
    }

    setSaving(true)
    try {
      const toSave = selected.map(t => ({
        date: t.date,
        description: t.description,
        notes: t.notes,
        type: t.type,
        amount: t.amount,
        businessId: t.businessId,
        categoryId: getCategoryId(t.categoryName, t.type),
        expenseType: t.expenseType as 'ordinario' | 'extraordinario',
        currency: t.currency,
        exchangeRate: t.exchangeRate,
      }))

      const result = await saveImportedTransactions(toSave)

      if (result.error) {
        toast.error(result.error)
      } else {
        setImportResult({ inserted: result.inserted ?? 0 })
        setStep('done')
        toast.success(`Se importaron ${result.inserted} transacciones`)
      }
    } catch {
      toast.error('Error al importar transacciones')
    }
    setSaving(false)
  }

  // Resumen de transacciones seleccionadas
  const selected = transactions.filter(t => t.selected)
  const totalIncome = selected.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = selected.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const noCategoryCount = selected.filter(t => !t.categoryName).length

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>Importar datos</h1>
          <p className="text-xs text-gray-500">
            {step === 'upload' && 'Subí un archivo Excel de cashflow o PDF de informe mensual'}
            {step === 'preview' && `${fileName} — ${transactions.length} transacciones parseadas`}
            {step === 'done' && 'Importación completada'}
          </p>
        </div>
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Config */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
                  Período (año-mes)
                </label>
                <input
                  type="month"
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className="rounded-lg px-3 py-2.5 text-sm border"
                  style={{ borderColor: '#e0e0ef', background: '#fafaff' }}
                />
              </div>
            </div>

            {/* Selector TC histórico */}
            <div className="rounded-xl border p-4" style={{ background: '#fafaff', borderColor: '#e8e8f0' }}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>
                  Tipo de cambio para conversión USD
                </p>
                {tcLoading && (
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#8b8ec0' }} />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Settings TC */}
                <button
                  onClick={() => setTcMode('settings')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs transition-all ${
                    tcMode === 'settings' ? 'border-[#6439ff]' : 'border-transparent'
                  }`}
                  style={{ background: tcMode === 'settings' ? 'rgba(100,57,255,0.07)' : '#f0f0f8' }}
                >
                  <span className="font-semibold" style={{ color: tcMode === 'settings' ? '#6439ff' : '#1a1a2e' }}>
                    Configuración
                  </span>
                  {exchangeRate > 0 && (
                    <span className="tabular-nums" style={{ color: '#8b8ec0' }}>
                      ${exchangeRate.toLocaleString('es-AR')}
                    </span>
                  )}
                </button>

                {/* TC Oficial */}
                <button
                  onClick={() => setTcMode('oficial')}
                  disabled={!tcHistorico?.oficial}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    tcMode === 'oficial' ? 'border-[#2edbc1]' : 'border-transparent'
                  }`}
                  style={{ background: tcMode === 'oficial' ? 'rgba(46,219,193,0.07)' : '#f0f0f8' }}
                >
                  <span className="font-semibold" style={{ color: tcMode === 'oficial' ? '#1aab96' : '#1a1a2e' }}>
                    🏦 Oficial BCRA
                  </span>
                  {tcHistorico?.oficial ? (
                    <span className="tabular-nums" style={{ color: '#8b8ec0' }}>
                      ${tcHistorico.oficial.toLocaleString('es-AR')}
                    </span>
                  ) : tcLoading ? (
                    <span style={{ color: '#8b8ec0' }}>...</span>
                  ) : (
                    <span style={{ color: '#ccc' }}>N/D</span>
                  )}
                </button>

                {/* TC Blue */}
                <button
                  onClick={() => setTcMode('blue')}
                  disabled={!tcHistorico?.blue}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    tcMode === 'blue' ? 'border-[#6439ff]' : 'border-transparent'
                  }`}
                  style={{ background: tcMode === 'blue' ? 'rgba(100,57,255,0.07)' : '#f0f0f8' }}
                >
                  <span className="font-semibold" style={{ color: tcMode === 'blue' ? '#6439ff' : '#1a1a2e' }}>
                    💵 Blue
                  </span>
                  {tcHistorico?.blue ? (
                    <span className="tabular-nums" style={{ color: '#8b8ec0' }}>
                      ${tcHistorico.blue.toLocaleString('es-AR')}
                    </span>
                  ) : tcLoading ? (
                    <span style={{ color: '#8b8ec0' }}>...</span>
                  ) : (
                    <span style={{ color: '#ccc' }}>N/D</span>
                  )}
                </button>
              </div>

              {/* TC efectivo */}
              {effectiveTC > 0 && (
                <p className="text-xs mt-2.5" style={{ color: '#8b8ec0' }}>
                  TC a usar:{' '}
                  <strong style={{ color: '#6439ff' }}>
                    ${effectiveTC.toLocaleString('es-AR')} ARS/USD
                  </strong>
                </p>
              )}
            </div>
          </div>

          {/* Toggle Modo IA */}
          <div
            className="rounded-xl border p-4 transition-all"
            style={{
              background: useAIMode ? 'rgba(100,57,255,0.05)' : '#fafaff',
              borderColor: useAIMode ? '#6439ff' : '#e8e8f0',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">✨</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: useAIMode ? '#6439ff' : '#1a1a2e' }}>
                    Modo IA — Importación inteligente con Claude
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                    Claude lee el documento y extrae las transacciones automáticamente,
                    sin importar el formato. Funciona con PDF y Excel.
                  </p>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => setUseAIMode(v => !v)}
                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                style={{ background: useAIMode ? '#6439ff' : '#d1d5db' }}
                aria-pressed={useAIMode}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: useAIMode ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
            {useAIMode && (
              <div className="mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2"
                style={{ background: 'rgba(100,57,255,0.08)', color: '#6439ff' }}>
                <span>💡</span>
                <span>
                  El modo IA puede tardar 10–30 segundos según el tamaño del documento.
                  Revisá las transacciones en el paso siguiente antes de importar.
                </span>
              </div>
            )}
          </div>

          {/* Modo PDF */}
          <div className="rounded-xl border p-4" style={{ background: '#fafaff', borderColor: '#e8e8f0' }}>
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#8b8ec0' }}>
              {useAIMode ? 'Detalle de extracción (aplica en Modo IA también)' : 'Modo de importación PDF'}
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setPdfMode('detail')}
                className={`flex-1 min-w-[200px] rounded-xl p-3 text-left border-2 transition-all ${
                  pdfMode === 'detail' ? 'border-[#6439ff]' : 'border-transparent'
                }`}
                style={{ background: pdfMode === 'detail' ? 'rgba(100,57,255,0.06)' : '#f0f0f8' }}
              >
                <p className="text-sm font-semibold" style={{ color: pdfMode === 'detail' ? '#6439ff' : '#1a1a2e' }}>
                  📋 Detallado
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                  Cada transacción individual (sueldos, proveedores, servicios, extraordinarios con fecha)
                </p>
              </button>
              <button
                onClick={() => setPdfMode('summary')}
                className={`flex-1 min-w-[200px] rounded-xl p-3 text-left border-2 transition-all ${
                  pdfMode === 'summary' ? 'border-[#6439ff]' : 'border-transparent'
                }`}
                style={{ background: pdfMode === 'summary' ? 'rgba(100,57,255,0.06)' : '#f0f0f8' }}
              >
                <p className="text-sm font-semibold" style={{ color: pdfMode === 'summary' ? '#6439ff' : '#1a1a2e' }}>
                  📊 Resumido
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
                  Solo subtotales por categoría (Proveedores, Sueldos, Servicios…) — menos registros
                </p>
              </button>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              dragActive ? 'border-[#6439ff] bg-[#6439ff]/5' : 'border-gray-300 hover:border-[#6439ff]/50'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#6439ff' }} />
                <p className="text-sm font-medium" style={{ color: '#4a4a6a' }}>Procesando archivo...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(100,57,255,0.1)' }}>
                  <Upload className="w-8 h-8" style={{ color: '#6439ff' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>
                    Arrastrá el archivo acá
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    o hacé click para seleccionar — .xlsx / .xls / .pdf
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4" style={{ background: '#fafaff', borderColor: '#e8e8f0' }}>
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#2edbc1' }} />
                <div className="text-xs space-y-1" style={{ color: '#5b5c8c' }}>
                  <p className="font-semibold" style={{ color: '#1a1a2e' }}>Excel — Cashflow mensual</p>
                  <p>Hoja &quot;CASHFLOW&quot; con estructura estándar:</p>
                  <p>• Cols A-D: Fecha, Concepto, F.Pago, Info</p>
                  <p>• Cols E-P: EML / SADIA / ÑANCUL / IBC</p>
                  <p>• Genera transacciones individuales</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: '#fafaff', borderColor: '#e8e8f0' }}>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#fe4962' }} />
                <div className="text-xs space-y-1" style={{ color: '#5b5c8c' }}>
                  <p className="font-semibold" style={{ color: '#1a1a2e' }}>PDF — Informe mensual</p>
                  <p>Informe de ingresos/egresos con detalle:</p>
                  <p>• Desglose por empresa (SADIA/GUEMES/PDA/ÑANCUL/EML)</p>
                  <p>• Gastos extraordinarios con fecha</p>
                  <p>• TC auto-detectado del documento</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Banner de notas de IA */}
          {useAIMode && aiNotes && (
            <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
              style={{ background: 'rgba(100,57,255,0.06)', borderColor: '#c4b5fd', color: '#4a2fbf' }}>
              <span className="text-base flex-shrink-0">✨</span>
              <div>
                <p className="font-semibold text-xs uppercase mb-1" style={{ color: '#6439ff' }}>
                  Observaciones de Claude
                </p>
                <p className="text-xs" style={{ color: '#4a2fbf' }}>{aiNotes}</p>
              </div>
            </div>
          )}
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4" style={{ background: '#fafaff', borderColor: '#e8e8f0' }}>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-gray-500">Seleccionadas</p>
              <p className="text-lg font-bold" style={{ color: '#1a1a2e' }}>
                {selected.length} <span className="text-sm font-normal text-gray-400">/ {transactions.length}</span>
              </p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-gray-500">Ingresos</p>
              <p className="text-lg font-bold" style={{ color: '#2edbc1' }}>${formatMoney(totalIncome)}</p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-gray-500">Gastos</p>
              <p className="text-lg font-bold" style={{ color: '#fe4962' }}>${formatMoney(totalExpense)}</p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-gray-500">Neto</p>
              <p className="text-lg font-bold" style={{ color: totalIncome - totalExpense >= 0 ? '#2edbc1' : '#fe4962' }}>
                {totalIncome - totalExpense >= 0 ? '+' : ''}${formatMoney(totalIncome - totalExpense)}
              </p>
            </div>
            {noCategoryCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-xs font-medium text-yellow-600">{noCategoryCount} sin categoría</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setStep('upload'); setTransactions([]) }}
              className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
              style={{ borderColor: '#e0e0ef', color: '#4a4a6a' }}
            >
              ← Volver
            </button>
            <button
              onClick={toggleAll}
              className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
              style={{ borderColor: '#e0e0ef', color: '#4a4a6a' }}
            >
              {transactions.every(t => t.selected) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleImport}
              disabled={saving || selected.length === 0}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#6439ff' }}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </span>
              ) : (
                `Importar ${selected.length} transacciones`
              )}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#e8e8f0' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f0f0ff' }}>
                  <th className="px-3 py-2.5 text-left w-10">
                    <input
                      type="checkbox"
                      checked={transactions.every(t => t.selected)}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: '#4a4a6a' }}>Fecha</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: '#4a4a6a' }}>Descripción</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: '#4a4a6a' }}>Empresa</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: '#4a4a6a' }}>Tipo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: '#4a4a6a' }}>Categoría</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: '#4a4a6a' }}>Monto</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold" style={{ color: '#4a4a6a' }}>$</th>
                  <th className="px-3 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const bgColor = !tx.selected
                    ? '#f8f8fc'
                    : !tx.categoryName
                    ? 'rgba(245,158,11,0.05)'
                    : tx.type === 'income'
                    ? 'rgba(46,219,193,0.04)'
                    : 'rgba(254,73,98,0.04)'

                  const applicableCategories = categories.filter(c => c.type === tx.type)

                  return (
                    <tr
                      key={tx.id}
                      className="border-t hover:bg-gray-50/50 transition"
                      style={{ borderColor: '#f0f0f8', background: bgColor, opacity: tx.selected ? 1 : 0.5 }}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={tx.selected}
                          onChange={() => toggleTransaction(tx.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#4a4a6a' }}>
                        {tx.date.split('-').reverse().join('/')}
                      </td>
                      <td className="px-3 py-2" style={{ color: '#1a1a2e' }}>
                        <div className="text-xs font-medium truncate max-w-[250px]" title={tx.description}>
                          {tx.description}
                        </div>
                        {tx.notes && (
                          <div className="text-[10px] text-gray-400 truncate max-w-[250px]" title={tx.notes}>
                            {tx.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: tx.businessName === 'EML' ? 'rgba(100,57,255,0.1)' :
                                           tx.businessName === 'SADIA' ? 'rgba(46,219,193,0.1)' :
                                           tx.businessName === 'ÑANCUL' ? 'rgba(245,158,11,0.1)' :
                                           'rgba(139,142,192,0.1)',
                                color: tx.businessName === 'EML' ? '#6439ff' :
                                       tx.businessName === 'SADIA' ? '#1aab96' :
                                       tx.businessName === 'ÑANCUL' ? '#d97706' :
                                       '#5b5c8c',
                              }}>
                          {tx.businessName}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium"
                              style={{ color: tx.type === 'income' ? '#2edbc1' : '#fe4962' }}>
                          {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={tx.categoryName ?? ''}
                          onChange={e => updateCategory(tx.id, e.target.value || null)}
                          className="text-xs rounded-lg px-2 py-1 border w-full max-w-[180px]"
                          style={{
                            borderColor: tx.categoryName ? '#e0e0ef' : '#f59e0b',
                            background: tx.categoryName ? '#fff' : '#fffbeb',
                            color: '#1a1a2e',
                          }}
                        >
                          <option value="">Sin categoría</option>
                          {applicableCategories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs font-semibold tabular-nums"
                              style={{ color: tx.type === 'income' ? '#2edbc1' : '#fe4962' }}>
                          {tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] font-medium" style={{ color: tx.currency === 'USD' ? '#6439ff' : '#8b8ec0' }}>
                          {tx.currency}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTx({ ...tx })}
                            className="p-1 rounded hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
                          </button>
                          <button
                            onClick={() => removeTransaction(tx.id)}
                            className="p-1 rounded hover:bg-red-50 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editingTx && (
        <EditModal
          tx={editingTx}
          categories={categories}
          onSave={updateTransaction}
          onClose={() => setEditingTx(null)}
        />
      )}

      {/* STEP 3: Done */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(46,219,193,0.1)' }}>
            <CheckCircle className="w-10 h-10" style={{ color: '#2edbc1' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1a2e' }}>
            Importación exitosa
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Se importaron <strong>{importResult?.inserted ?? 0}</strong> transacciones del período {period}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setTransactions([]); setFileName(''); setImportResult(null) }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border hover:bg-gray-50 transition"
              style={{ borderColor: '#e0e0ef', color: '#4a4a6a' }}
            >
              Importar otro archivo
            </button>
            <Link
              href="/transactions"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: '#6439ff' }}
            >
              Ver transacciones
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal de edición ────────────────────────────────────────────────────────

const BUSINESSES = [
  { id: 1, name: 'SADIA'  },
  { id: 1, name: 'GUEMES' },
  { id: 1, name: 'PDA'    },
  { id: 2, name: 'ÑANCUL' },
  { id: 4, name: 'EML'    },
]

function EditModal({
  tx,
  categories,
  onSave,
  onClose,
}: {
  tx: ParsedTransaction
  categories: { id: number; name: string; type: 'income' | 'expense' }[]
  onSave: (t: ParsedTransaction) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ParsedTransaction>({ ...tx })

  const set = <K extends keyof ParsedTransaction>(key: K, value: ParsedTransaction[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const applicableCategories = categories.filter(c => c.type === draft.type)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,30,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl"
        style={{ background: '#fff', border: '1px solid #e0e0ef' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#f0f0f8' }}>
          <h2 className="text-sm font-bold" style={{ color: '#1a1a2e' }}>Editar transacción</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Fecha</label>
              <input
                type="date"
                value={draft.date}
                onChange={e => set('date', e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Tipo</label>
              <select
                value={draft.type}
                onChange={e => {
                  setDraft(prev => ({ ...prev, type: e.target.value as 'income' | 'expense', categoryName: null }))
                }}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              >
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Descripción</label>
            <input
              type="text"
              value={draft.description}
              onChange={e => set('description', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border"
              style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Notas</label>
            <input
              type="text"
              value={draft.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border"
              style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              placeholder="Opcional"
            />
          </div>

          {/* Monto + Moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Monto</label>
              <input
                type="number"
                value={draft.amount}
                onChange={e => set('amount', parseFloat(e.target.value) || 0)}
                min={0}
                step={1}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Moneda</label>
              <select
                value={draft.currency}
                onChange={e => set('currency', e.target.value as 'ARS' | 'USD')}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* TC (solo si USD) */}
          {draft.currency === 'USD' && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Tipo de cambio</label>
              <input
                type="number"
                value={draft.exchangeRate ?? ''}
                onChange={e => set('exchangeRate', parseFloat(e.target.value) || null)}
                min={0}
                step={1}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
                placeholder="ARS por USD"
              />
            </div>
          )}

          {/* Empresa + Tipo gasto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Empresa</label>
              <select
                value={draft.businessName ?? ''}
                onChange={e => {
                  const biz = BUSINESSES.find(b => b.name === e.target.value)
                  if (biz) setDraft(prev => ({ ...prev, businessName: biz.name, businessId: biz.id }))
                }}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              >
                <option value="">— Sin empresa —</option>
                {BUSINESSES.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Tipo de gasto</label>
              <select
                value={draft.expenseType ?? 'ordinario'}
                onChange={e => set('expenseType', e.target.value as 'ordinario' | 'extraordinario')}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: '#e0e0ef', color: '#1a1a2e' }}
              >
                <option value="ordinario">Ordinario</option>
                <option value="extraordinario">Extraordinario</option>
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4a4a6a' }}>Categoría</label>
            <select
              value={draft.categoryName ?? ''}
              onChange={e => set('categoryName', e.target.value || null)}
              className="w-full rounded-lg px-3 py-2 text-sm border"
              style={{
                borderColor: draft.categoryName ? '#e0e0ef' : '#f59e0b',
                background: draft.categoryName ? '#fff' : '#fffbeb',
                color: '#1a1a2e',
              }}
            >
              <option value="">Sin categoría</option>
              {applicableCategories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: '#f0f0f8' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
            style={{ borderColor: '#e0e0ef', color: '#4a4a6a' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: '#6439ff' }}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
