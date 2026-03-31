'use client'

import { Download, Printer } from 'lucide-react'

interface Tx {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  status: string
  categories: { name: string } | null
  businesses: { name: string } | null
}

interface Props {
  transactions: Tx[]
  monthLabel: string
  businessLabel: string
}

export function ExportButtons({ transactions, monthLabel, businessLabel }: Props) {
  const handleCSV = () => {
    const header = ['Fecha', 'Descripción', 'Empresa', 'Categoría', 'Tipo', 'Monto ARS', 'Estado']
    const rows = transactions.map(t => [
      t.date,
      t.description,
      (t.businesses as { name: string } | null)?.name ?? '',
      (t.categories as { name: string } | null)?.name ?? '',
      t.type === 'income' ? 'Ingreso' : 'Egreso',
      t.type === 'expense' ? `-${t.amount}` : String(t.amount),
      t.status,
    ])

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flujo-caja-${businessLabel.replace(/\s+/g, '-')}-${monthLabel.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCSV}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border hover:bg-gray-50 transition"
        style={{ borderColor: '#e0e0ef', color: '#06083f' }}
      >
        <Download className="w-3.5 h-3.5" />
        Exportar CSV
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border hover:bg-gray-50 transition"
        style={{ borderColor: '#e0e0ef', color: '#06083f' }}
      >
        <Printer className="w-3.5 h-3.5" />
        Imprimir
      </button>
    </div>
  )
}
