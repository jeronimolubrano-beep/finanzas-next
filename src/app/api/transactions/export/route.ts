/**
 * GET /api/transactions/export
 * Exports filtered transactions as an XLSX file.
 * Accepts the same query params as the transactions page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { txToARS } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type        = searchParams.get('type') ?? ''
    const expenseType = searchParams.get('expense_type') ?? ''
    const month       = searchParams.get('month') ?? ''
    const businessId  = searchParams.get('business_id') ?? ''
    const status      = searchParams.get('status') ?? ''
    const categoryId  = searchParams.get('category_id') ?? ''
    const sort        = searchParams.get('sort') ?? 'date_desc'

    const sortField = sort.startsWith('amount') ? 'amount' : 'date'
    const ascending = sort.endsWith('_asc')

    const supabase = await createClient()

    let query = supabase
      .from('transactions')
      .select('*, iva_rate, categories(name), accounts(name), businesses(name)')
      .order(sortField, { ascending })
      .limit(5000)

    if (type && ['income', 'expense'].includes(type))
      query = query.eq('type', type)
    if (expenseType && ['ordinario', 'extraordinario'].includes(expenseType))
      query = query.eq('expense_type', expenseType)
    if (month)
      query = query.gte('date', `${month}-01`).lte('date', `${month}-31`)
    if (businessId)
      query = query.eq('business_id', parseInt(businessId))
    if (status && ['percibido', 'devengado'].includes(status))
      query = query.eq('status', status)
    if (categoryId)
      query = query.eq('category_id', parseInt(categoryId))

    const [{ data: transactions, error }, { data: rateSetting }] = await Promise.all([
      query,
      supabase.from('settings').select('value').eq('key', 'current_rate').single(),
    ])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const fallbackRate = parseFloat((rateSetting as { value?: string } | null)?.value ?? '0') || 1

    // ── Build rows ──────────────────────────────────────────────────────────────
    const rows = (transactions ?? []).map(t => {
      const bizName  = Array.isArray(t.businesses) ? t.businesses[0]?.name : (t.businesses as { name?: string } | null)?.name
      const catName  = Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name?: string } | null)?.name
      const accName  = Array.isArray(t.accounts)   ? t.accounts[0]?.name   : (t.accounts   as { name?: string } | null)?.name

      return {
        Fecha:         t.date,
        Descripcion:   t.description,
        Categoria:     catName ?? '',
        Empresa:       bizName ?? '',
        Cuenta:        accName ?? '',
        Tipo:          t.type === 'income' ? 'Ingreso' : 'Gasto',
        'Tipo de gasto': t.expense_type ?? '',
        Monto:         Number(t.amount),
        Moneda:        t.currency ?? 'ARS',
        'TC utilizado': t.exchange_rate ?? '',
        Estado:        t.status === 'percibido'
                         ? (t.type === 'income' ? 'Cobrado' : 'Pagado')
                         : 'Pendiente',
        IVA:           t.iva_rate ? `${t.iva_rate}%` : '',
        Vencimiento:   t.due_date ?? '',
        Notas:         t.notes ?? '',
      }
    })

    // ── Build filename ──────────────────────────────────────────────────────────
    const parts: string[] = ['transacciones']
    if (month) parts.push(month)
    if (businessId && transactions?.[0]) {
      const biz = Array.isArray(transactions[0].businesses)
        ? transactions[0].businesses[0]?.name
        : (transactions[0].businesses as { name?: string } | null)?.name
      if (biz) parts.push(biz.toLowerCase().replace(/\s+/g, '_'))
    }
    if (type) parts.push(type === 'income' ? 'ingresos' : 'gastos')
    if (expenseType) parts.push(expenseType)
    const filename = `${parts.join('_')}.xlsx`

    // ── Build workbook ──────────────────────────────────────────────────────────
    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 45 }, // Descripcion
      { wch: 20 }, // Categoria
      { wch: 18 }, // Empresa
      { wch: 18 }, // Cuenta
      { wch: 10 }, // Tipo
      { wch: 15 }, // Tipo de gasto
      { wch: 16 }, // Monto
      { wch: 8  }, // Moneda
      { wch: 12 }, // TC
      { wch: 12 }, // Estado
      { wch: 8  }, // IVA
      { wch: 14 }, // Vencimiento
      { wch: 30 }, // Notas
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transacciones')

    // Summary sheet
    const income  = (transactions ?? []).filter(t => t.type === 'income').reduce((s, t) => s + txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate), 0)
    const expense = (transactions ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + txToARS(t.amount, t.currency, t.exchange_rate, fallbackRate), 0)
    const summaryRows = [
      { Concepto: 'Total ingresos (ARS)',  Monto: income  },
      { Concepto: 'Total gastos (ARS)',    Monto: expense },
      { Concepto: 'Resultado neto (ARS)',  Monto: income - expense },
      { Concepto: 'Cantidad de registros', Monto: (transactions ?? []).length },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[transactions/export]', error)
    return NextResponse.json({ error: 'Error inesperado: ' + (error as Error).message }, { status: 500 })
  }
}
