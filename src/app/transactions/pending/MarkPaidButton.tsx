'use client'

import { markAsPaid } from './actions'
import { CheckCircle } from 'lucide-react'
import { useState } from 'react'

export function MarkPaidButton({ id, type }: { id: number; type: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm(`¿Marcar como ${type === 'income' ? 'cobrado' : 'pagado'}?`)) return
    setLoading(true)
    await markAsPaid(id)
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-50"
      style={{ background: '#2edbc1' }}
    >
      <CheckCircle className="w-3.5 h-3.5" />
      {loading ? 'Guardando...' : type === 'income' ? 'Cobrado' : 'Pagado'}
    </button>
  )
}
