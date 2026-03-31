import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { TransactionDetail } from './TransactionDetail'

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const selectedMonth = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = selectedMonth.split('-')
  const dateFrom = `${selectedMonth}-01`
  const dateTo = `${selectedMonth}-31`

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`

  // Fetch transacciones + categorías + empresas
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, categories(name), businesses(name)')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date')

  const txs = transactions ?? []

  // Tipo de cambio
  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const tcRate = parseFloat(settingsMap.current_rate) || 0
  const hasTC = tcRate > 0

  // ── Separación ordinario / extraordinario ──
  const ordIncome  = txs.filter(t => t.type === 'income'  && t.expense_type !== 'extraordinario')
  const extIncome  = txs.filter(t => t.type === 'income'  && t.expense_type === 'extraordinario')
  const ordExpense = txs.filter(t => t.type === 'expense' && t.expense_type !== 'extraordinario')
  const extExpense = txs.filter(t => t.type === 'expense' && t.expense_type === 'extraordinario')

  // ── Helpers ──
  type AnyTx = typeof txs[number]
  function sum(items: AnyTx[]) {
    return items.reduce((s, t) => s + Number(t.amount), 0)
  }

  function groupByCategory(items: AnyTx[]): { name: string; total: number }[] {
    const map: Record<string, number> = {}
    for (const t of items) {
      const name = (t.categories as { name: string } | null)?.name ?? 'Sin categoría'
      map[name] = (map[name] ?? 0) + Number(t.amount)
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }

  function groupByBusiness(items: AnyTx[]): { name: string; total: number }[] {
    const map: Record<string, number> = {}
    for (const t of items) {
      const name = (t.businesses as { name: string } | null)?.name ?? 'Sin empresa'
      map[name] = (map[name] ?? 0) + Number(t.amount)
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }

  // KPIs principales
  const totalOrdIncome  = sum(ordIncome)
  const totalOrdExpense = sum(ordExpense)
  const resultadoOperativo = totalOrdIncome - totalOrdExpense
  const totalExtIncome  = sum(extIncome)
  const totalExtExpense = sum(extExpense)
  const netNoRecurrentes = totalExtIncome - totalExtExpense
  const saldoFinal = resultadoOperativo + netNoRecurrentes

  // Grupos para las tablas
  const incomeByCategory  = groupByCategory(ordIncome)
  const expenseByCategory = groupByCategory(ordExpense)

  // Empresas presentes en el período
  const allBusinessNames = Array.from(new Set(txs.map(t =>
    (t.businesses as { name: string } | null)?.name ?? 'Sin empresa'
  ))).sort()

  // Por empresa: resultados clave
  const bizResults = allBusinessNames.map(biz => {
    const bizTxs = txs.filter(t => (t.businesses as { name: string } | null)?.name === biz)
    const bOrdInc = bizTxs.filter(t => t.type === 'income'  && t.expense_type !== 'extraordinario')
    const bExtInc = bizTxs.filter(t => t.type === 'income'  && t.expense_type === 'extraordinario')
    const bOrdExp = bizTxs.filter(t => t.type === 'expense' && t.expense_type !== 'extraordinario')
    const bExtExp = bizTxs.filter(t => t.type === 'expense' && t.expense_type === 'extraordinario')
    const bOrdIncTotal = sum(bOrdInc)
    const bOrdExpTotal = sum(bOrdExp)
    const bResultOp = bOrdIncTotal - bOrdExpTotal
    const bExtNet = sum(bExtInc) - sum(bExtExp)
    return {
      name: biz,
      ordIncome: bOrdIncTotal,
      ordExpense: bOrdExpTotal,
      resultadoOp: bResultOp,
      extNet: bExtNet,
      saldo: bResultOp + bExtNet,
    }
  })

  // Por empresa y categoría (gastos ordinarios)
  const catNames = expenseByCategory.map(c => c.name)
  const bizExpByCat = allBusinessNames.map(biz => {
    const bizOrdExp = txs.filter(t =>
      t.type === 'expense' &&
      t.expense_type !== 'extraordinario' &&
      (t.businesses as { name: string } | null)?.name === biz
    )
    const bycat = groupByCategory(bizOrdExp)
    const map: Record<string, number> = {}
    for (const c of bycat) map[c.name] = c.total
    return { name: biz, byCat: map, total: sum(bizOrdExp) }
  })

  // ── Formateadores ──
  /** Formato contable: gastos entre paréntesis */
  function fmtARS(n: number, isExpense = false): string {
    if (n === 0) return '—'
    const f = `$${formatMoney(n)}`
    return isExpense ? `(${f})` : f
  }

  /** Formato compacto en miles/millones para grilla */
  function fmtK(n: number): string {
    if (n === 0) return '—'
    const abs = Math.abs(n)
    let s: string
    if (abs >= 1_000_000) s = `$${(abs / 1_000_000).toFixed(2)}M`
    else if (abs >= 1_000) s = `$${(abs / 1_000).toFixed(0)}K`
    else s = `$${abs.toFixed(0)}`
    return n < 0 ? `(${s})` : s
  }

  function fmtUSD(ars: number): string {
    if (!hasTC || ars === 0) return '—'
    return `$${formatMoney(ars / tcRate)}`
  }

  // Colores semánticos
  const colorPositive = '#059669'  // verde oscuro
  const colorNegative = '#dc2626'  // rojo
  const colorNavy = '#06083f'
  const colorMuted = '#8b8ec0'

  function resultColor(n: number) {
    if (n > 0) return colorPositive
    if (n < 0) return colorNegative
    return colorMuted
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: colorMuted }}>
            Grupo Lubrano
          </p>
          <h1 className="text-2xl font-bold" style={{ color: colorNavy }}>
            Estado de Flujo de Caja
          </h1>
          <p className="text-base font-medium mt-0.5" style={{ color: colorMuted }}>
            {monthLabel}
            {hasTC && (
              <span className="ml-3 text-xs font-normal">
                TC: ${tcRate.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={selectedMonth}
            className="rounded-lg px-3 py-1.5 text-sm border"
            style={{ borderColor: '#e0e0ef', background: '#fafafa' }}
          />
          <button
            type="submit"
            className="text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
            style={{ background: '#6439ff' }}
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* ── SECCIÓN 1: KPI SUMMARY ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Resultado Operativo',
            value: resultadoOperativo,
            sub: 'Ingresos – Gastos ordinarios',
          },
          {
            label: 'Ítems No Recurrentes',
            value: netNoRecurrentes,
            sub: 'Extraordinarios neto',
          },
          {
            label: 'Saldo del Mes',
            value: saldoFinal,
            sub: 'Resultado final del período',
            large: true,
          },
        ].map(({ label, value, sub, large }) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-4"
            style={{
              borderColor: '#e8e8f0',
              borderLeft: `3px solid ${resultColor(value)}`,
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: colorMuted }}>
              {label}
            </p>
            <p className={`font-bold tabular-nums ${large ? 'text-2xl' : 'text-xl'}`}
               style={{ color: resultColor(value) }}>
              {value >= 0 ? '' : ''}
              {value >= 0 ? `$${formatMoney(value)}` : `($${formatMoney(Math.abs(value))})`}
            </p>
            {hasTC && (
              <p className="text-xs mt-0.5 tabular-nums" style={{ color: colorMuted }}>
                USD {fmtUSD(Math.abs(value))}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: '#b0b4d0' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── SECCIÓN 2: ESTADO DE FLUJO DE CAJA (P&L) ── */}
      <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e8e8f0' }}>

        {/* INGRESOS OPERATIVOS */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: colorMuted }}>
            Ingresos Operativos
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="pb-1.5 text-left text-xs font-medium" style={{ color: colorMuted }}></th>
                <th className="pb-1.5 text-right text-xs font-medium w-40" style={{ color: colorMuted }}>ARS</th>
                {hasTC && <th className="pb-1.5 text-right text-xs font-medium w-32" style={{ color: colorMuted }}>USD</th>}
                <th className="pb-1.5 text-right text-xs font-medium w-16" style={{ color: colorMuted }}>%</th>
              </tr>
            </thead>
            <tbody>
              {incomeByCategory.map(c => (
                <tr key={c.name} className="border-t" style={{ borderColor: '#f4f4fc' }}>
                  <td className="py-1.5 pl-2 text-sm" style={{ color: colorNavy }}>{c.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-sm font-medium" style={{ color: colorNavy }}>
                    ${formatMoney(c.total)}
                  </td>
                  {hasTC && (
                    <td className="py-1.5 text-right tabular-nums text-xs" style={{ color: colorMuted }}>
                      {fmtUSD(c.total)}
                    </td>
                  )}
                  <td className="py-1.5 text-right text-xs" style={{ color: colorMuted }}>
                    {totalOrdIncome > 0 ? `${((c.total / totalOrdIncome) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              {incomeByCategory.length === 0 && (
                <tr><td colSpan={hasTC ? 4 : 3} className="py-2 pl-2 text-sm" style={{ color: colorMuted }}>Sin ingresos operativos</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t" style={{ borderColor: '#d0d4f0' }}>
                <td className="pt-2.5 pb-3 pl-2 text-sm font-bold" style={{ color: colorNavy }}>
                  Total Ingresos Operativos
                </td>
                <td className="pt-2.5 pb-3 text-right tabular-nums text-sm font-bold" style={{ color: '#059669' }}>
                  ${formatMoney(totalOrdIncome)}
                </td>
                {hasTC && (
                  <td className="pt-2.5 pb-3 text-right tabular-nums text-xs font-medium" style={{ color: colorMuted }}>
                    {fmtUSD(totalOrdIncome)}
                  </td>
                )}
                <td className="pt-2.5 pb-3 text-right text-xs font-bold" style={{ color: colorMuted }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="h-px mx-6" style={{ background: '#e8e8f0' }} />

        {/* GASTOS OPERATIVOS */}
        <div className="px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: colorMuted }}>
            Gastos Operativos
          </p>
          <table className="w-full text-sm">
            <tbody>
              {expenseByCategory.map(c => (
                <tr key={c.name} className="border-t" style={{ borderColor: '#f4f4fc' }}>
                  <td className="py-1.5 pl-2 text-sm" style={{ color: colorNavy }}>{c.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-sm font-medium w-40" style={{ color: colorNegative }}>
                    (${formatMoney(c.total)})
                  </td>
                  {hasTC && (
                    <td className="py-1.5 text-right tabular-nums text-xs w-32" style={{ color: colorMuted }}>
                      ({fmtUSD(c.total)})
                    </td>
                  )}
                  <td className="py-1.5 text-right text-xs w-16" style={{ color: colorMuted }}>
                    {totalOrdExpense > 0 ? `${((c.total / totalOrdExpense) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              {expenseByCategory.length === 0 && (
                <tr><td colSpan={hasTC ? 4 : 3} className="py-2 pl-2 text-sm" style={{ color: colorMuted }}>Sin gastos operativos</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t" style={{ borderColor: '#d0d4f0' }}>
                <td className="pt-2.5 pb-1 pl-2 text-sm font-bold" style={{ color: colorNavy }}>
                  Total Gastos Operativos
                </td>
                <td className="pt-2.5 pb-1 text-right tabular-nums text-sm font-bold" style={{ color: colorNegative }}>
                  (${formatMoney(totalOrdExpense)})
                </td>
                {hasTC && (
                  <td className="pt-2.5 pb-1 text-right tabular-nums text-xs font-medium" style={{ color: colorMuted }}>
                    ({fmtUSD(totalOrdExpense)})
                  </td>
                )}
                <td className="pt-2.5 pb-1 text-right text-xs font-bold" style={{ color: colorMuted }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RESULTADO OPERATIVO */}
        <div className="mx-6 mb-4 rounded-lg px-4 py-3" style={{ background: '#f4f4fc', border: '1px solid #e0e0ef' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorMuted }}>Resultado Operativo (NOI)</p>
              <p className="text-xs mt-0.5" style={{ color: '#b0b4d0' }}>Ingresos operativos – Gastos operativos</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums" style={{ color: resultColor(resultadoOperativo) }}>
                {resultadoOperativo >= 0
                  ? `$${formatMoney(resultadoOperativo)}`
                  : `($${formatMoney(Math.abs(resultadoOperativo))})`
                }
              </p>
              {hasTC && (
                <p className="text-xs" style={{ color: colorMuted }}>
                  USD {fmtUSD(Math.abs(resultadoOperativo))}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="h-px mx-6" style={{ background: '#e8e8f0' }} />

        {/* ÍTEMS NO RECURRENTES */}
        <div className="px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: colorMuted }}>
            Ítems No Recurrentes
          </p>
          <table className="w-full text-sm">
            <tbody>
              {/* Ingresos extraordinarios */}
              <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
                <td className="py-1.5 pl-2" style={{ color: colorNavy }}>Ingresos extraordinarios</td>
                <td className="py-1.5 text-right tabular-nums font-medium w-40" style={{ color: totalExtIncome > 0 ? '#059669' : colorMuted }}>
                  {totalExtIncome > 0 ? `$${formatMoney(totalExtIncome)}` : '—'}
                </td>
                {hasTC && (
                  <td className="py-1.5 text-right tabular-nums text-xs w-32" style={{ color: colorMuted }}>
                    {totalExtIncome > 0 ? fmtUSD(totalExtIncome) : '—'}
                  </td>
                )}
                <td className="w-16" />
              </tr>
              {/* Gastos extraordinarios */}
              <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
                <td className="py-1.5 pl-2" style={{ color: colorNavy }}>Gastos extraordinarios</td>
                <td className="py-1.5 text-right tabular-nums font-medium w-40" style={{ color: totalExtExpense > 0 ? colorNegative : colorMuted }}>
                  {totalExtExpense > 0 ? `($${formatMoney(totalExtExpense)})` : '—'}
                </td>
                {hasTC && (
                  <td className="py-1.5 text-right tabular-nums text-xs w-32" style={{ color: colorMuted }}>
                    {totalExtExpense > 0 ? `(${fmtUSD(totalExtExpense)})` : '—'}
                  </td>
                )}
                <td className="w-16" />
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t" style={{ borderColor: '#d0d4f0' }}>
                <td className="pt-2.5 pb-1 pl-2 font-bold" style={{ color: colorNavy }}>
                  Total No Recurrentes
                </td>
                <td className="pt-2.5 pb-1 text-right tabular-nums font-bold w-40" style={{ color: resultColor(netNoRecurrentes) }}>
                  {netNoRecurrentes === 0 ? '—' : netNoRecurrentes > 0
                    ? `$${formatMoney(netNoRecurrentes)}`
                    : `($${formatMoney(Math.abs(netNoRecurrentes))})`
                  }
                </td>
                {hasTC && (
                  <td className="pt-2.5 pb-1 text-right tabular-nums text-xs w-32" style={{ color: colorMuted }}>
                    {netNoRecurrentes !== 0 ? `${netNoRecurrentes < 0 ? '(' : ''}${fmtUSD(Math.abs(netNoRecurrentes))}${netNoRecurrentes < 0 ? ')' : ''}` : '—'}
                  </td>
                )}
                <td className="w-16" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SALDO FINAL */}
        <div
          className="px-6 py-4 border-t"
          style={{
            borderColor: '#e0e0ef',
            background: saldoFinal >= 0 ? 'rgba(5,150,105,0.04)' : 'rgba(220,38,38,0.04)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorMuted }}>
                Saldo Neto del Período
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#b0b4d0' }}>
                {monthLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums" style={{ color: resultColor(saldoFinal) }}>
                {saldoFinal >= 0
                  ? `$${formatMoney(saldoFinal)}`
                  : `($${formatMoney(Math.abs(saldoFinal))})`
                }
              </p>
              {hasTC && (
                <p className="text-xs mt-0.5" style={{ color: colorMuted }}>
                  USD {fmtUSD(Math.abs(saldoFinal))}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: DESGLOSE POR EMPRESA ── */}
      {bizResults.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e8e8f0' }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: '#e8e8f0', background: '#fafafa' }}>
            <p className="text-sm font-semibold" style={{ color: colorNavy }}>Desglose por empresa</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f4f4ff' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: colorMuted }}></th>
                  {bizResults.map(b => (
                    <th key={b.name} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: colorNavy }}>
                      {b.name}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide" style={{ color: colorNavy, borderLeft: '1px solid #e0e0ef' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Ingresos operativos */}
                <tr className="border-t" style={{ borderColor: '#f0f0f8' }}>
                  <td className="px-4 py-2 text-xs" style={{ color: colorNavy }}>Ingr. Operativos</td>
                  {bizResults.map(b => (
                    <td key={b.name} className="px-4 py-2 text-right tabular-nums text-xs font-medium" style={{ color: b.ordIncome > 0 ? colorNavy : colorMuted }}>
                      {b.ordIncome > 0 ? `$${formatMoney(b.ordIncome)}` : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#059669', borderLeft: '1px solid #f0f0f8' }}>
                    ${formatMoney(totalOrdIncome)}
                  </td>
                </tr>
                {/* Gastos operativos */}
                <tr className="border-t" style={{ borderColor: '#f0f0f8' }}>
                  <td className="px-4 py-2 text-xs" style={{ color: colorNavy }}>Gast. Operativos</td>
                  {bizResults.map(b => (
                    <td key={b.name} className="px-4 py-2 text-right tabular-nums text-xs font-medium" style={{ color: b.ordExpense > 0 ? colorNegative : colorMuted }}>
                      {b.ordExpense > 0 ? `(${fmtK(b.ordExpense)})` : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-bold" style={{ color: colorNegative, borderLeft: '1px solid #f0f0f8' }}>
                    ({fmtK(totalOrdExpense)})
                  </td>
                </tr>
                {/* Resultado operativo */}
                <tr className="border-t" style={{ borderColor: '#d0d4f0', background: '#f8f8fd' }}>
                  <td className="px-4 py-2 text-xs font-bold" style={{ color: colorNavy }}>Resultado Op.</td>
                  {bizResults.map(b => (
                    <td key={b.name} className="px-4 py-2 text-right tabular-nums text-xs font-bold" style={{ color: resultColor(b.resultadoOp) }}>
                      {b.resultadoOp >= 0 ? fmtK(b.resultadoOp) : `(${fmtK(Math.abs(b.resultadoOp))})`}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-bold" style={{ color: resultColor(resultadoOperativo), borderLeft: '1px solid #e0e0ef' }}>
                    {resultadoOperativo >= 0 ? fmtK(resultadoOperativo) : `(${fmtK(Math.abs(resultadoOperativo))})`}
                  </td>
                </tr>
                {/* Ítems no recurrentes */}
                <tr className="border-t" style={{ borderColor: '#f0f0f8' }}>
                  <td className="px-4 py-2 text-xs" style={{ color: colorNavy }}>No Recurrentes</td>
                  {bizResults.map(b => (
                    <td key={b.name} className="px-4 py-2 text-right tabular-nums text-xs font-medium" style={{ color: b.extNet !== 0 ? resultColor(b.extNet) : colorMuted }}>
                      {b.extNet === 0 ? '—' : b.extNet > 0 ? fmtK(b.extNet) : `(${fmtK(Math.abs(b.extNet))})`}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-medium" style={{ color: netNoRecurrentes !== 0 ? resultColor(netNoRecurrentes) : colorMuted, borderLeft: '1px solid #f0f0f8' }}>
                    {netNoRecurrentes === 0 ? '—' : netNoRecurrentes > 0 ? fmtK(netNoRecurrentes) : `(${fmtK(Math.abs(netNoRecurrentes))})`}
                  </td>
                </tr>
                {/* Saldo neto */}
                <tr className="border-t" style={{ borderColor: '#d0d4f0', background: '#f4f4ff' }}>
                  <td className="px-4 py-2.5 text-xs font-bold" style={{ color: colorNavy }}>Saldo del Mes</td>
                  {bizResults.map(b => (
                    <td key={b.name} className="px-4 py-2.5 text-right tabular-nums text-xs font-bold" style={{ color: resultColor(b.saldo) }}>
                      {b.saldo >= 0 ? fmtK(b.saldo) : `(${fmtK(Math.abs(b.saldo))})`}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold" style={{ color: resultColor(saldoFinal), borderLeft: '1px solid #e0e0ef' }}>
                    {saldoFinal >= 0 ? fmtK(saldoFinal) : `(${fmtK(Math.abs(saldoFinal))})`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 4: GASTOS OPERATIVOS POR EMPRESA Y CATEGORÍA ── */}
      {bizResults.length > 0 && catNames.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e8e8f0' }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: '#e8e8f0', background: '#fafafa' }}>
            <p className="text-sm font-semibold" style={{ color: colorNavy }}>Gastos operativos por empresa y categoría</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f4f4ff' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: colorMuted }}>Categoría</th>
                  {bizExpByCat.map(b => (
                    <th key={b.name} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: colorNavy }}>
                      {b.name}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide" style={{ color: colorNavy, borderLeft: '1px solid #e0e0ef' }}>Total</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: colorMuted }}>%</th>
                </tr>
              </thead>
              <tbody>
                {catNames.map(cat => {
                  const catTotal = expenseByCategory.find(c => c.name === cat)?.total ?? 0
                  return (
                    <tr key={cat} className="border-t" style={{ borderColor: '#f0f0f8' }}>
                      <td className="px-4 py-2 text-xs" style={{ color: colorNavy }}>{cat}</td>
                      {bizExpByCat.map(b => {
                        const val = b.byCat[cat] ?? 0
                        return (
                          <td key={b.name} className="px-4 py-2 text-right tabular-nums text-xs" style={{ color: val > 0 ? colorNegative : colorMuted }}>
                            {val > 0 ? `(${fmtK(val)})` : '—'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold" style={{ color: colorNegative, borderLeft: '1px solid #f0f0f8' }}>
                        ({fmtK(catTotal)})
                      </td>
                      <td className="px-4 py-2 text-right text-xs" style={{ color: colorMuted }}>
                        {totalOrdExpense > 0 ? `${((catTotal / totalOrdExpense) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t" style={{ borderColor: '#d0d4f0', background: '#f8f8fd' }}>
                  <td className="px-4 py-2.5 text-xs font-bold" style={{ color: colorNavy }}>Total</td>
                  {bizExpByCat.map(b => (
                    <td key={b.name} className="px-4 py-2.5 text-right tabular-nums text-xs font-bold" style={{ color: b.total > 0 ? colorNegative : colorMuted }}>
                      {b.total > 0 ? `(${fmtK(b.total)})` : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold" style={{ color: colorNegative, borderLeft: '1px solid #e0e0ef' }}>
                    ({fmtK(totalOrdExpense)})
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: colorMuted }}>100%</td>
                </tr>
                <tr className="border-t" style={{ borderColor: '#f0f0f8' }}>
                  <td className="px-4 py-1.5 text-xs" style={{ color: colorMuted }}>%</td>
                  {bizExpByCat.map(b => (
                    <td key={b.name} className="px-4 py-1.5 text-right text-xs" style={{ color: colorMuted }}>
                      {totalOrdExpense > 0 ? `${((b.total / totalOrdExpense) * 100).toFixed(1)}%` : '—'}
                    </td>
                  ))}
                  <td style={{ borderLeft: '1px solid #f0f0f8' }} />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 5: DETALLE DE TRANSACCIONES (COLAPSABLE) ── */}
      <TransactionDetail transactions={txs as Parameters<typeof TransactionDetail>[0]['transactions']} />

    </div>
  )
}
