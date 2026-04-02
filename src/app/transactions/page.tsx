import { createClient } from '@/lib/supabase/server'
import { formatMoney, statusLabel, dueDateUrgency, daysUntilDue, formatDateAR, formatDateShort } from '@/lib/utils'
import Link from 'next/link'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { DeleteButton } from './DeleteButton'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string
    month?: string
    business_id?: string
    status?: string
    category_id?: string
    sort?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const sortParam = params.sort ?? 'date_desc'
  const sortField = sortParam.startsWith('amount') ? 'amount' : 'date'
  const ascending = sortParam.endsWith('_asc')

  let query = supabase
    .from('transactions')
    .select('*, categories(name), accounts(name), businesses(name)')
    .order(sortField, { ascending })
    .limit(200)

  if (params.type && ['income', 'expense'].includes(params.type)) {
    query = query.eq('type', params.type)
  }
  if (params.month) {
    query = query.gte('date', `${params.month}-01`).lte('date', `${params.month}-31`)
  }
  if (params.business_id) {
    query = query.eq('business_id', parseInt(params.business_id))
  }
  if (params.status && ['percibido', 'devengado'].includes(params.status)) {
    query = query.eq('status', params.status)
  }
  if (params.category_id) {
    query = query.eq('category_id', parseInt(params.category_id))
  }

  const { data: transactions } = await query
  const { data: categories } = await supabase.from('categories').select('*').order('type').order('name')
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const tcRate = parseFloat(settingsMap.current_rate) || 0
  const hasTC = tcRate > 0

  function toARS(t: { amount: number | string; currency?: string; exchange_rate?: number | null }): number {
    const amt = Number(t.amount)
    if ((t.currency || 'ARS') === 'USD') {
      const rate = t.exchange_rate || tcRate
      return amt * rate
    }
    return amt
  }

  function toUSD(t: { amount: number | string; currency?: string; exchange_rate?: number | null }): number {
    const amt = Number(t.amount)
    if ((t.currency || 'ARS') === 'ARS') {
      return tcRate > 0 ? amt / tcRate : 0
    }
    return amt
  }

  const totalIncomeARS = (transactions ?? []).filter(t => t.type === 'income').reduce((s, t) => s + toARS(t), 0)
  const totalExpenseARS = (transactions ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + toARS(t), 0)
  const netARS = totalIncomeARS - totalExpenseARS
  const totalIncomeUSD = (transactions ?? []).filter(t => t.type === 'income').reduce((s, t) => s + toUSD(t), 0)
  const totalExpenseUSD = (transactions ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + toUSD(t), 0)
  const netUSD = totalIncomeUSD - totalExpenseUSD

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>Transacciones</h1>
        <Link
          href="/transactions/add"
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          style={{ background: '#6439ff' }}
        >
          <PlusCircle className="w-4 h-4" />
          Agregar
        </Link>
      </div>

      {/* Filtros */}
      <form className="rounded-xl border p-4 mb-6" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#8b8ec0' }}>Tipo</label>
            <select name="type" defaultValue={params.type ?? ''} className="w-full rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
              <option value="">Todos</option>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#8b8ec0' }}>Mes</label>
            <input type="month" name="month" defaultValue={params.month ?? ''} className="w-full rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#8b8ec0' }}>Empresa</label>
            <select name="business_id" defaultValue={params.business_id ?? ''} className="w-full rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
              <option value="">Todas</option>
              {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#8b8ec0' }}>Estado</label>
            <select name="status" defaultValue={params.status ?? ''} className="w-full rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
              <option value="">Todos</option>
              <option value="percibido">Cobrado / Pagado</option>
              <option value="devengado">Pendiente</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#8b8ec0' }}>Ordenar por</label>
            <select name="sort" defaultValue={sortParam} className="w-full rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: '#e8e8f0' }}>
              <option value="date_desc">Más nuevo primero</option>
              <option value="date_asc">Más antiguo primero</option>
              <option value="amount_desc">Mayor monto primero</option>
              <option value="amount_asc">Menor monto primero</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition" style={{ background: '#6439ff' }}>
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f4f4ff' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Descripcion</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Empresa</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Monto ARS</th>
                {hasTC && <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Monto USD</th>}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Tipo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#8b8ec0' }}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f0f0f8' }}>
              {(transactions ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-[#f9f9ff] transition">
                  <td className="px-4 py-3" style={{ color: '#8b8ec0' }}>{formatDateAR(t.date)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--navy)' }}>{t.description}</td>
                  <td className="px-4 py-3" style={{ color: '#8b8ec0' }}>{t.categories?.name ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#8b8ec0' }}>{t.businesses?.name ?? '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                    {t.type === 'income' ? '+' : '-'}${formatMoney(toARS(t))}
                    {t.currency === 'USD' && <span className="text-xs ml-1" style={{ color: '#8b8ec0' }}>(USD)</span>}
                  </td>
                  {hasTC && (
                    <td className="px-4 py-3 text-right text-xs" style={{ color: '#8b8ec0' }}>
                      {t.type === 'income' ? '+' : '-'}USD ${formatMoney(toUSD(t))}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.type === 'income'
                        ? 'text-[#2edbc1]'
                        : 'text-[#fe4962]'
                    }`} style={{ background: t.type === 'income' ? 'rgba(46,219,193,0.1)' : 'rgba(254,73,98,0.1)' }}>
                      {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'devengado' ? 'text-yellow-600' : 'text-[#2edbc1]'
                    }`} style={{ background: t.status === 'devengado' ? 'rgba(245,158,11,0.1)' : 'rgba(46,219,193,0.1)' }}>
                      {statusLabel(t.status, t.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.status === 'devengado' && t.due_date ? (() => {
                      const urgency = dueDateUrgency(t.due_date)
                      const days = daysUntilDue(t.due_date)
                      const bg = urgency === 'overdue' ? 'rgba(254,73,98,0.1)'
                        : urgency === 'soon' ? 'rgba(245,158,11,0.1)'
                        : 'rgba(46,219,193,0.1)'
                      const color = urgency === 'overdue' ? '#fe4962'
                        : urgency === 'soon' ? '#f59e0b'
                        : '#2edbc1'
                      const label = days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? 'Hoy' : `${days}d`
                      return (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: bg, color }}>
                          {formatDateShort(t.due_date)} · {label}
                        </span>
                      )
                    })() : t.status === 'devengado' ? (
                      <span className="text-xs" style={{ color: '#8b8ec0' }}>Sin fecha</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#c8cce0' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/transactions/${t.id}/edit`}
                        className="p-1 transition hover:opacity-70"
                        style={{ color: '#6439ff' }}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <DeleteButton id={t.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {(!transactions || transactions.length === 0) && (
                <tr>
                  <td colSpan={hasTC ? 10 : 9} className="px-4 py-12 text-center" style={{ color: '#8b8ec0' }}>
                    No hay transacciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        {transactions && transactions.length > 0 && (
          <div className="border-t px-4 py-3 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-2 text-sm" style={{ background: '#f4f4ff', borderColor: '#e8e8f0' }}>
            <span className="font-medium" style={{ color: '#8b8ec0' }}>
              {transactions.length} transaccion(es)
            </span>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-[#2edbc1]">+${formatMoney(totalIncomeARS)}</span>
              <span className="font-semibold text-[#fe4962]">-${formatMoney(totalExpenseARS)}</span>
              <span className={`font-bold ${netARS >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                Neto: ${formatMoney(netARS)}
              </span>
            </div>
            {hasTC && (
              <div className="flex items-center gap-4 text-xs" style={{ color: '#8b8ec0' }}>
                <span className="text-[#2edbc1]">+USD ${formatMoney(totalIncomeUSD)}</span>
                <span className="text-[#fe4962]">-USD ${formatMoney(totalExpenseUSD)}</span>
                <span className={`font-semibold ${netUSD >= 0 ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                  Neto: USD ${formatMoney(netUSD)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
