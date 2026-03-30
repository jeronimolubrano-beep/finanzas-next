'use client'

import { useState } from 'react'
import { Camera, Loader2, Save, RotateCcw } from 'lucide-react'
import { Category, Account, Business } from '@/lib/types'
import { addTransaction } from '../add/actions'

interface OcrResult {
  date: string
  description: string
  amount: string
  type: 'income' | 'expense'
  category: string | null
  expense_type: string | null
  account: string | null
}

interface Props {
  categories: Category[]
  accounts: Account[]
  businesses: Business[]
}

export function OcrUploader({ categories, accounts, businesses }: Props) {
  const [loading, setLoading] = useState(false)
  const [ocrData, setOcrData] = useState<OcrResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [type, setType] = useState<'income' | 'expense'>('expense')

  const filteredCategories = categories.filter(c => c.type === type)

  function findCategoryId(suggestedName: string | null): string {
    if (!suggestedName) return filteredCategories[0]?.id?.toString() || ''
    const lower = suggestedName.toLowerCase()
    const match = filteredCategories.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
    return match ? match.id.toString() : filteredCategories[0]?.id?.toString() || ''
  }

  function findAccountId(suggestedName: string | null): string {
    if (!suggestedName) return ''
    const lower = suggestedName.toLowerCase()
    const match = accounts.find(a => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()))
    return match ? match.id.toString() : ''
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setLoading(true)
    setError(null)
    setOcrData(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al procesar imagen')
      }
      const data: OcrResult = await res.json()
      setOcrData(data)
      setType(data.type)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setOcrData(null)
    setPreview(null)
    setError(null)
  }

  const labelClass = "block text-sm font-medium mb-1"
  const inputClass = "w-full rounded-lg px-3 py-2 text-sm border"
  const inputStyle = { borderColor: '#e8e8f0' }
  const labelStyle = { color: 'var(--navy)' }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {!ocrData && (
        <div className="rounded-xl border p-8" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition"
                 style={{ borderColor: '#6439ff' }}>
            {loading ? (
              <>
                <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: '#6439ff' }} />
                <span className="text-sm" style={{ color: '#8b8ec0' }}>Procesando imagen con Claude Vision...</span>
              </>
            ) : (
              <>
                <Camera className="w-10 h-10 mb-3" style={{ color: '#8b8ec0' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Click para subir imagen</span>
                <span className="text-xs mt-1" style={{ color: '#8b8ec0' }}>JPG, PNG o WebP</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleFileChange}
                   className="hidden" disabled={loading} />
          </label>

          {error && (
            <div className="mt-4 text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(254,73,98,0.05)', color: '#fe4962' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Preview + Form de revision */}
      {ocrData && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image preview */}
          {preview && (
            <div className="rounded-xl border p-4 overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
              <img src={preview} alt="Ticket" className="w-full rounded-lg" />
            </div>
          )}

          {/* Form pre-filled */}
          <form action={addTransaction} className="rounded-xl border p-6 space-y-4" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
            <h2 className="font-semibold mb-2" style={{ color: 'var(--navy)' }}>Revisar y confirmar</h2>

            <div>
              <label className={labelClass} style={labelStyle}>Fecha</label>
              <input type="date" name="date" defaultValue={ocrData.date} required
                     className={inputClass} style={inputStyle} />
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Tipo</label>
              <select name="type" value={type}
                      onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                      className={inputClass} style={inputStyle}>
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-2" style={{ color: '#8b8ec0' }}>$</span>
                <input type="number" name="amount" step="0.01" min="0.01" required
                       defaultValue={ocrData.amount}
                       className={inputClass} style={{ ...inputStyle, paddingLeft: '1.75rem' }} />
              </div>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Descripcion</label>
              <input type="text" name="description" required maxLength={200}
                     defaultValue={ocrData.description}
                     className={inputClass} style={inputStyle} />
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>
                Categoria
                {ocrData.category && (
                  <span className="ml-2 text-xs font-normal" style={{ color: '#6439ff' }}>
                    (sugerida: {ocrData.category})
                  </span>
                )}
              </label>
              <select name="category_id" required className={inputClass} style={inputStyle}
                      defaultValue={findCategoryId(ocrData.category)}>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>
                Cuenta
                {ocrData.account && (
                  <span className="ml-2 text-xs font-normal" style={{ color: '#6439ff' }}>
                    (sugerida: {ocrData.account})
                  </span>
                )}
              </label>
              <select name="account_id" className={inputClass} style={inputStyle}
                      defaultValue={findAccountId(ocrData.account)}>
                <option value="">Sin especificar</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {type === 'expense' && (
              <div>
                <label className={labelClass} style={labelStyle}>
                  Tipo de gasto
                  {ocrData.expense_type && (
                    <span className="ml-2 text-xs font-normal" style={{ color: '#6439ff' }}>
                      (sugerido: {ocrData.expense_type})
                    </span>
                  )}
                </label>
                <select name="expense_type" className={inputClass} style={inputStyle}
                        defaultValue={ocrData.expense_type || 'ordinario'}>
                  <option value="ordinario">Ordinario (recurrente)</option>
                  <option value="extraordinario">Extraordinario (puntual)</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>Estado</label>
                <select name="status" required className={inputClass} style={inputStyle}>
                  <option value="percibido">Cobrado / Pagado</option>
                  <option value="devengado">Pendiente</option>
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Empresa</label>
                <select name="business_id" required className={inputClass} style={inputStyle}>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Notas</label>
              <textarea name="notes" rows={2} maxLength={500}
                        placeholder="Detalle adicional..."
                        className={inputClass} style={inputStyle} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit"
                      className="flex items-center gap-2 text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                      style={{ background: '#6439ff' }}>
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button type="button" onClick={reset}
                      className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#f4f4ff] transition"
                      style={{ borderColor: '#e8e8f0', color: '#8b8ec0' }}>
                <RotateCcw className="w-4 h-4" />
                Otra imagen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
