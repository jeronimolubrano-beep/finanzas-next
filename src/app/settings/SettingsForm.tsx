'use client'

import { useState } from 'react'
import { saveExchangeRate } from './actions'
import { Save, DollarSign } from 'lucide-react'

interface Props {
  currentRate: string
  rateDate: string
}

export function SettingsForm({ currentRate, rateDate }: Props) {
  const [saved, setSaved] = useState(false)

  async function handleSubmit(formData: FormData) {
    await saveExchangeRate(formData)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
        <DollarSign className="w-4 h-4" />
        <span>Configura el tipo de cambio ARS/USD para tus transacciones en dolares</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de cambio (ARS por 1 USD)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-400">$</span>
          <input type="number" name="current_rate" step="0.01" min="0"
                 defaultValue={currentRate}
                 placeholder="Ej: 1200.00"
                 className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha del tipo de cambio
        </label>
        <input type="date" name="rate_date"
               defaultValue={rateDate}
               className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {currentRate && rateDate && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
          TC actual: <strong>${currentRate} ARS/USD</strong> al {rateDate}
        </div>
      )}

      <div className="pt-2">
        <button type="submit"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          <Save className="w-4 h-4" />
          Guardar
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">
          Tipo de cambio actualizado correctamente
        </div>
      )}
    </form>
  )
}
