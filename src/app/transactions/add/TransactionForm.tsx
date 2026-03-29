'use client'

import { useState } from 'react'
import { addTransaction } from './actions'
import { Category, Account, Business } from '@/lib/types'
import { Save, List } from 'lucide-react'
import Link from 'next/link'

interface Props {
  categories: Category[]
  accounts: Account[]
  businesses: Business[]
  today: string
}

export function TransactionForm({ categories, accounts, businesses, today }: Props) {
  const [type, setType] = useState<'income' | 'expense'>('expense')

  const filteredCategories = categories.filter(c => c.type === type)

  return (
    <form action={addTransaction} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      {/* Fecha + Tipo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input type="date" name="date" defaultValue={today} required
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
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400">$</span>
            <input type="number" name="amount" step="0.01" min="0.01" required
                   placeholder="0.00"
                   className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" />
          </div>
        </div>
        <div className="col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion <span className="text-red-500">*</span>
          </label>
          <input type="text" name="description" required maxLength={200}
                 placeholder="Ej: Sueldo marzo, Supermercado Coto"
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Categoria + Cuenta */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoria <span className="text-red-500">*</span>
          </label>
          <select name="category_id" required className="w-full border rounded-lg px-3 py-2 text-sm">
            {filteredCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cuenta <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <select name="account_id" className="w-full border rounded-lg px-3 py-2 text-sm">
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
          <select name="expense_type" className="w-full border rounded-lg px-3 py-2 text-sm">
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
          <select name="status" required className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="percibido">Percibido (cobrado/pagado)</option>
            <option value="devengado">Devengado (pendiente)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa <span className="text-red-500">*</span>
          </label>
          <select name="business_id" required className="w-full border rounded-lg px-3 py-2 text-sm">
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas <span className="text-gray-400 text-xs">(opcional)</span>
        </label>
        <textarea name="notes" rows={2} maxLength={500}
                  placeholder="Detalle adicional..."
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button type="submit"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          <Save className="w-4 h-4" />
          Guardar
        </button>
        <Link href="/transactions"
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
          <List className="w-4 h-4" />
          Ver todas
        </Link>
      </div>
    </form>
  )
}
