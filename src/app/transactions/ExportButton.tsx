'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

interface Props {
  params: {
    type?: string
    expense_type?: string
    month?: string
    business_id?: string
    status?: string
    category_id?: string
    sort?: string
  }
}

export function ExportButton({ params }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (params.type)         p.set('type',         params.type)
      if (params.expense_type) p.set('expense_type', params.expense_type)
      if (params.month)        p.set('month',        params.month)
      if (params.business_id)  p.set('business_id',  params.business_id)
      if (params.status)       p.set('status',       params.status)
      if (params.category_id)  p.set('category_id',  params.category_id)
      if (params.sort)         p.set('sort',         params.sort)

      const res = await fetch(`/api/transactions/export?${p.toString()}`)
      if (!res.ok) throw new Error('Error al exportar')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const cd   = res.headers.get('Content-Disposition') ?? ''
      const name = cd.match(/filename="(.+)"/)?.[1] ?? 'transacciones.xlsx'
      a.href     = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('No se pudo exportar: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80 transition disabled:opacity-50"
      style={{ borderColor: '#6439ff', color: '#6439ff', background: 'transparent' }}
      title="Exportar a Excel"
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exportando…' : 'Excel'}
    </button>
  )
}
