import { createClient } from '@/lib/supabase/server'
import { BudgetTable } from './BudgetTable'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; business_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Determine selected month (YYYY-MM)
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedMonth = params.month || defaultMonth
  const [yearStr, monthStr] = selectedMonth.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  // Business filter
  const businessIdParam = params.business_id
  const businessId = businessIdParam ? parseInt(businessIdParam) : null

  // Prev/next month navigation
  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]

  const navParam = (m: string) => {
    const base = `?month=${m}`
    return businessIdParam ? `${base}&business_id=${businessIdParam}` : base
  }

  // Parallel fetches
  const [
    { data: businesses },
    { data: categories },
    { data: budgets },
    { data: templates },
    { data: txs },
  ] = await Promise.all([
    supabase.from('businesses').select('id, name').order('name'),

    supabase.from('categories').select('id, name, type').order('type').order('name'),

    (() => {
      let q = supabase
        .from('budgets')
        .select('category_id, amount_ars')
        .eq('year', year)
        .eq('month', month)
      if (businessId !== null) {
        q = q.eq('business_id', businessId)
      } else {
        q = q.is('business_id', null)
      }
      return q
    })(),

    (() => {
      let q = supabase
        .from('budget_templates')
        .select('category_id, amount_ars')
        .eq('active', true)
      if (businessId !== null) {
        q = q.eq('business_id', businessId)
      } else {
        q = q.is('business_id', null)
      }
      return q
    })(),

    (() => {
      const dateFrom = `${yearStr}-${monthStr}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const dateTo = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`
      let q = supabase
        .from('transactions')
        .select('type, amount, category_id')
        .gte('date', dateFrom)
        .lte('date', dateTo)
      if (businessId !== null) {
        q = q.eq('business_id', businessId)
      }
      return q
    })(),
  ])

  // Build actuals map: category_id → { income, expense }
  type ActualsMap = Record<number, { income: number; expense: number }>
  const actuals: ActualsMap = {}
  for (const t of txs ?? []) {
    if (!t.category_id) continue
    const cid = t.category_id as number
    if (!actuals[cid]) actuals[cid] = { income: 0, expense: 0 }
    if (t.type === 'income') actuals[cid].income += Number(t.amount)
    else actuals[cid].expense += Number(t.amount)
  }

  // Budget map: category_id → amount_ars
  const budgetMap: Record<number, number> = {}
  for (const b of budgets ?? []) {
    budgetMap[b.category_id as number] = Number(b.amount_ars)
  }

  // Template map: category_id → amount_ars
  const templateMap: Record<number, number> = {}
  for (const tpl of templates ?? []) {
    templateMap[tpl.category_id as number] = Number(tpl.amount_ars)
  }

  return (
    <div className="container mx-auto px-4 max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Presupuesto</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b8ec0' }}>
            Budget vs Actuals por categoría
          </p>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <Link
            href={navParam(prevMonth)}
            className="p-2 rounded-lg border transition hover:bg-gray-50"
            style={{ borderColor: '#e8e8f0' }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: '#8b8ec0' }} />
          </Link>
          <span className="text-sm font-semibold px-3 py-2 rounded-lg border"
                style={{ color: 'var(--navy)', borderColor: '#e8e8f0', minWidth: '140px', textAlign: 'center' }}>
            {monthNames[month - 1]} {year}
          </span>
          <Link
            href={navParam(nextMonth)}
            className="p-2 rounded-lg border transition hover:bg-gray-50"
            style={{ borderColor: '#e8e8f0' }}
          >
            <ChevronRight className="w-4 h-4" style={{ color: '#8b8ec0' }} />
          </Link>
        </div>
      </div>

      {/* Business filter pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`?month=${selectedMonth}`}
          className="text-xs px-3 py-1.5 rounded-full border font-medium transition"
          style={
            businessId === null
              ? { background: '#6439ff', color: '#fff', borderColor: '#6439ff' }
              : { color: '#8b8ec0', borderColor: '#e8e8f0' }
          }
        >
          Consolidado
        </Link>
        {(businesses ?? []).map(b => (
          <Link
            key={b.id}
            href={`?month=${selectedMonth}&business_id=${b.id}`}
            className="text-xs px-3 py-1.5 rounded-full border font-medium transition"
            style={
              businessId === b.id
                ? { background: '#6439ff', color: '#fff', borderColor: '#6439ff' }
                : { color: '#8b8ec0', borderColor: '#e8e8f0' }
            }
          >
            {b.name}
          </Link>
        ))}
      </div>

      {/* Main table */}
      <BudgetTable
        categories={categories ?? []}
        budgetMap={budgetMap}
        templateMap={templateMap}
        actuals={actuals}
        businessId={businessId}
        year={year}
        month={month}
      />
    </div>
  )
}
