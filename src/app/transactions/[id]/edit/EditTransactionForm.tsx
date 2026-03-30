'use client'

import { useState } from 'react'
import { updateTransaction } from './actions'
import { Category, Account, Business, Transaction } from '@/lib/types'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  transaction: Transaction
  categories: Category[]
  accounts: Account[]
  businesses: Business[]
}

export function EditTransactionForm({ transaction, categories, accounts, businesses }: Props) {
  const [type, setType] = useState<'income' | 'expense'>(transaction.type)
  const [status, setStatus] = useState<'percibido' | 'devengado'>(transaction.status)
  const filteredCategories = categories.filter(c => c.type === type)

  const updateWithId = updateTransaction.bind(null, transaction.id)

  const labelClass = "block text-sm font-medium mb-1"
  const inputClass = "w-full rounded-lg px-3 py-2 text-sm border"
  const inputStyle = { borderColor: '#e8e8f0' }
  const labelStyle = { color: 'var(--navy)' }

  return (
    <form action={updateWithId} className="rounded-xl border p-6 space-y-4" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
      {/* Fecha + Tipo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Fecha <span className="text-[#fe4962]">*</span>
          </label>
          <input type="date" name="date" defaultValue={transaction.date} required className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Tipo <span className="text-[#fe4962]">*</span>
          </label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                  className={inputClass} style={inputStyle} required>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>
      </div>

      {/* Monto + Descripcion */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Monto <span className="text-[#fe4962]">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2" style={{ color: '#8b8ec0' }}>$</span>
            <input type="number" name="amount" step="0.01" min="0.01" required
                   defaultValue={Number(transaction.amount)}
                   className={inputClass} style={{ ...inputStyle, paddingLeft: '1.75rem' }} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Descripcion <span className="text-[#fe4962]">*</span>
          </label>
          <input type="text" name="description" required maxLength={200}
                 defaultValue={transaction.description}
                 className={inputClass} style={inputStyle} />
        </div>
      </div>

      {/* Categoria + Cuenta */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Categoria <span className="text-[#fe4962]">*</span>
          </label>
          <select name="category_id" required className={inputClass} style={inputStyle}
                  defaultValue={transaction.category_id ?? ''}>
            {filteredCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Cuenta <span className="text-xs" style={{ color: '#8b8ec0' }}>(opcional)</span>
          </label>
          <select name="account_id" className={inputClass} style={inputStyle}
                  defaultValue={transaction.account_id ?? ''}>
            <option value="">Sin especificar</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tipo de gasto */}
      {type === 'expense' && (
        <div>
          <label className={labelClass} style={labelStyle}>
            Tipo de gasto <span className="text-[#fe4962]">*</span>
          </label>
          <select name="expense_type" className={inputClass} style={inputStyle}
                  defaultValue={transaction.expense_type ?? 'ordinario'}>
            <option value="ordinario">Ordinario (recurrente)</option>
            <option value="extraordinario">Extraordinario (puntual)</option>
          </select>
        </div>
      )}

      {/* Estado + Empresa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Estado <span className="text-[#fe4962]">*</span>
          </label>
          <select name="status" required className={inputClass} style={inputStyle}
                  value={status} onChange={(e) => setStatus(e.target.value as 'percibido' | 'devengado')}>
            <option value="percibido">Cobrado / Pagado</option>
            <option value="devengado">Pendiente</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Empresa <span className="text-[#fe4962]">*</span>
          </label>
          <select name="business_id" required className={inputClass} style={inputStyle}
                  defaultValue={transaction.business_id}>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha de vencimiento */}
      {status === 'devengado' && (
        <div>
          <label className={labelClass} style={labelStyle}>
            Fecha de vencimiento <span className="text-xs" style={{ color: '#8b8ec0' }}>(opcional)</span>
          </label>
          <input type="date" name="due_date"
                 defaultValue={transaction.due_date ?? ''}
                 className={inputClass} style={inputStyle} />
        </div>
      )}

      {/* Notas */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Notas <span className="text-xs" style={{ color: '#8b8ec0' }}>(opcional)</span>
        </label>
        <textarea name="notes" rows={2} maxLength={500}
                  defaultValue={transaction.notes ?? ''}
                  className={inputClass} style={inputStyle} />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button type="submit"
                className="flex items-center gap-2 text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                style={{ background: '#6439ff' }}>
          <Save className="w-4 h-4" />
          Guardar cambios
        </button>
        <Link href="/transactions"
              className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#f4f4ff] transition"
              style={{ borderColor: '#e8e8f0', color: '#8b8ec0' }}>
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </div>
    </form>
  )
}
