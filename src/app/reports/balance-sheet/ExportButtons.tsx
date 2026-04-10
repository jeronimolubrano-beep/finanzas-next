'use client'

import { BalanceSheet } from '@/lib/types'
import { Download, Printer } from 'lucide-react'

interface Props {
  balance: BalanceSheet
  monthLabel: string
  businessLabel: string
}

export function ExportButtons({ balance, monthLabel, businessLabel }: Props) {
  const handleCSVExport = () => {
    // Build CSV content
    const rows: string[] = []

    // Header
    rows.push('ESTADO DE SITUACIÓN PATRIMONIAL')
    rows.push(`${businessLabel} - ${monthLabel}`)
    rows.push('')
    rows.push('CONCEPTO,ARS')

    // ASSETS
    rows.push('ACTIVOS,')
    rows.push('Activos Corrientes,')
    rows.push(`Caja,${balance.assets.current.cash.toFixed(2)}`)
    rows.push(`Cuentas por Cobrar,${balance.assets.current.receivables.toFixed(2)}`)
    rows.push(`Subtotal Activos Corrientes,${balance.assets.current.subtotal.toFixed(2)}`)
    rows.push('Activos Fijos,')
    rows.push(`Propiedad, Planta y Equipo,${balance.assets.fixed.ppe.toFixed(2)}`)
    rows.push(`Depreciación Acumulada,${(-balance.assets.fixed.depreciation).toFixed(2)}`)
    rows.push(`Subtotal Activos Fijos,${balance.assets.fixed.subtotal.toFixed(2)}`)
    rows.push(`TOTAL ACTIVOS,${balance.assets.total.toFixed(2)}`)

    rows.push('')

    // LIABILITIES
    rows.push('PASIVOS,')
    rows.push('Pasivos Corrientes,')
    rows.push(`Cuentas por Pagar,${balance.liabilities.current.payables.toFixed(2)}`)
    rows.push(`Impuestos por Pagar,${balance.liabilities.current.taxesPayable.toFixed(2)}`)
    rows.push(`Subtotal Pasivos Corrientes,${balance.liabilities.current.subtotal.toFixed(2)}`)
    rows.push('Pasivos a Largo Plazo,')
    rows.push(`Deudas a Largo Plazo,${balance.liabilities.longTerm.debt.toFixed(2)}`)
    rows.push(`Subtotal Pasivos a Largo Plazo,${balance.liabilities.longTerm.subtotal.toFixed(2)}`)
    rows.push(`TOTAL PASIVOS,${balance.liabilities.total.toFixed(2)}`)

    rows.push('')

    // EQUITY
    rows.push('PATRIMONIO,')
    rows.push(`Capital,${balance.equity.capital.toFixed(2)}`)
    rows.push(`Ganancias Retenidas,${balance.equity.retainedEarnings.toFixed(2)}`)
    rows.push(`TOTAL PATRIMONIO,${balance.equity.total.toFixed(2)}`)
    rows.push(`TOTAL PASIVOS + PATRIMONIO,${balance.totalLiabilitiesEquity.toFixed(2)}`)

    rows.push('')
    rows.push(`Balance cuadra,${balance.isBalanced ? 'SÍ' : 'NO'}`)
    if (!balance.isBalanced) {
      rows.push(`Diferencia,${balance.balanceDifference.toFixed(2)}`)
    }

    // Create CSV with UTF-8 BOM for Excel compatibility
    const csv = '\uFEFF' + rows.map(row => {
      // Escape quotes and wrap cells containing commas
      return row.split(',').map(cell => {
        if (cell.includes(',') || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(',')
    }).join('\n')

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    const filename = `balance-sheet-${businessLabel.replace(/\s+/g, '-')}-${balance.period}.csv`
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCSVExport}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition"
        style={{ background: '#6439ff' }}
        title="Descargar como CSV"
      >
        <Download size={16} />
        <span className="hidden sm:inline">CSV</span>
      </button>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
        style={{ background: '#e8e8f0', color: '#06083f' }}
        title="Imprimir"
      >
        <Printer size={16} />
        <span className="hidden sm:inline">Imprimir</span>
      </button>
    </div>
  )
}
