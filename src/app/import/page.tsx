'use client'

import { useState, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { parseExcelCashflow, type ParsedTransaction } from '@/lib/excel-parser'
import { saveImportedTransactions, getCategories } from './actions'
import { formatMoney } from '@/lib/utils'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Trash2, ArrowLeft } from 'lucide-react'
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
  const [exchangeRate, setExchangeRate] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Cargar categorías al montar
  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

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

  const processFile = useCallback((file: File) => {
    if (!period) {
      toast.error('Seleccioná un período primero')
      return
    }

    setLoading(true)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const rate = parseFloat(exchangeRate) || 0
        const parsed = parseExcelCashflow(workbook, period, rate)

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
  }, [period, exchangeRate])

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
          <h1 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>Importar Excel</h1>
          <p className="text-xs text-gray-500">
            {step === 'upload' && 'Subí un archivo de cashflow mensual'}
            {step === 'preview' && `${fileName} — ${transactions.length} transacciones parseadas`}
            {step === 'done' && 'Importación completada'}
          </p>
        </div>
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
                Período (año-mes)
              </label>
              <input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border"
                style={{ borderColor: '#e0e0ef', background: '#fafaff' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a4a6a' }}>
                Tipo de cambio USD (opcional)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej: 1200"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border"
                style={{ borderColor: '#e0e0ef', background: '#fafaff' }}
              />
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
              accept=".xlsx,.xls"
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
                    Arrastrá el archivo Excel acá
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    o hacé click para seleccionar — .xlsx / .xls
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <div className="rounded-xl border p-4" style={{ background: '#fafaff', borderColor: '#e8e8f0' }}>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#6439ff' }} />
              <div className="text-xs space-y-1" style={{ color: '#5b5c8c' }}>
                <p className="font-semibold" style={{ color: '#1a1a2e' }}>Formato esperado</p>
                <p>El archivo debe tener una hoja &quot;CASHFLOW&quot; con la estructura estándar del grupo:</p>
                <p>• Columnas A-D: Fecha, Concepto, F.Pago, Info Adicional</p>
                <p>• Columnas E-G: EML (Debe/Haber/Saldo)</p>
                <p>• Columnas H-J: SADIA (Debe/Haber/Saldo)</p>
                <p>• Columnas K-M: ÑANCUL (Debe/Haber/Saldo)</p>
                <p>• Columnas N-P: IBC (Debe/Haber/Saldo)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
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
                  <th className="px-3 py-2.5 w-10"></th>
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
                        <button
                          onClick={() => removeTransaction(tx.id)}
                          className="p-1 rounded hover:bg-red-50 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
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
