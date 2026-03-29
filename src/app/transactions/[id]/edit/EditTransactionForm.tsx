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

  // Bind action with transaction id
  const updateWithId = updateTransaction.bind(null, transaction.id)

  return (
    <form action={updateWithId} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      {/* Fecha + Tipo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input type="date" name="date" defaultValue={transaction.date} required
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                  className="w-full border rounded-lg px-3 py-2 text-sm" required>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>
      </div>

      {/* Monto + Descripcion */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400">$</span>
            <input type="number" name="amount" step="0.01" min="0.01" required
                   defaultValue={Number(transaction.amount)}
                   className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion <span className="text-red-500">*</span>
          </label>
          <input type="text" name="description" required maxLength={200}
                 defaultValue={transaction.description}
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Categoria + Cuenta */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoria <span className="text-red-500">*</span>
          </label>
          <select name="category_id" required className="w-full border rounded-lg px-3 py-2 text-sm"
                  defaultValue={transaction.category_id ?? ''}>
            {filteredCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cuenta <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <select name="account_id" className="w-full border rounded-lg px-3 py-2 text-sm"
                  defaultValue={transaction.account_id ?? ''}>
            <option value="">Sin especificar</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tipo de gasto (solo para gastos) */}
      {type === 'expense' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de gasto <span className="text-red-500">*</span>
          </label>
          <select name="expense_type" className="w-full border rounded-lg px-3 py-2 text-sm"
                  defaultValue={transaction.expense_type ?? 'ordinario'}>
            <option value="ordinario">Ordinario (recurrente)</option>
            <option value="extraordinario">Extraordinario (puntual)</option>
          </select>
        </div>
      )}

      {/* Estado + Empresa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado <span className="text-red-500">*</span>
          </label>
          <select name="status" required className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={status} onChange={(e) => setStatus(e.target.value as 'percibido' | 'devengado')}>
            <option value="percibido">Cobrado / Pagado</option>
            <option value="devengado">Pendiente</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa <span className="text-red-500">*</span>
          </label>
          <select name="business_id" required className="w-full border rounded-lg px-3 py-2 text-sm"
                  defaultValue={transaction.business_id}>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha de vencimiento (solo para pendientes) */}
      {status === 'devengado' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de vencimiento <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <input type="date" name="due_date"
                 defaultValue={transaction.due_date ?? ''}
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas <span className="text-gray-400 text-xs">(opcional)</span>
        </label>
        <textarea name="notes" rows={2} maxLength={500}
                  defaultValue={transaction.notes ?? ''}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button type="submit"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          <Save className="w-4 h-4" />
          Guardar cambios
        </button>
        <Link href="/transactions"
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </div>
    </form>
  )
}
