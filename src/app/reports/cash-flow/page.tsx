import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { TransactionDetail } from './TransactionDetail'
import { CashFlowChart } from './CashFlowChart'
import { ExportButtons } from './ExportButtons'
import { Suspense } from 'react'
import { TCSelector } from '@/components/TCSelector'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type AnyTx = {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  status: string
  expense_type: string | null
  categories: { name: string } | null
  businesses: { name: string } | null
}

type FlowSection = 'operacional' | 'inversion' | 'financiamiento'

// ─────────────────────────────────────────────────────────────────────────────
// Classify a transaction into one of the three CF sections based on its
// category name. Only real cash (status = 'percibido') is counted.
//
// NOTE: if a new category doesn't map correctly, add a rule below.
// ─────────────────────────────────────────────────────────────────────────────
function classifyFlow(categoryName: string | null): FlowSection {
  if (!categoryName) return 'operacional'
  const n = categoryName.toLowerCase()

  // Financing: payment plans, loans, external credit
  if (
    n.includes('financiac') ||
    n.includes('préstamo') ||
    n.includes('prestamo') ||
    n.includes('crédito') ||
    n.includes('credito') ||
    n.includes('deuda')
  ) return 'financiamiento'

  // Investment: fixed assets, equipment, machinery
  // TODO: add categories like "Equipamiento", "Activos Fijos" if they exist
  if (
    n.includes('equip') ||
    n.includes('activo fijo') ||
    n.includes('maquinaria') ||
    n.includes('venta activo')
  ) return 'inversion'

  return 'operacional'
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function sumTxs(txs: AnyTx[]) {
  return txs.reduce((s, t) => s + Number(t.amount), 0)
}

function groupByCategory(txs: AnyTx[]): { name: string; total: number }[] {
  const map: Record<string, number> = {}
  for (const t of txs) {
    const name = (t.categories as { name: string } | null)?.name ?? 'Sin categoría'
    map[name] = (map[name] ?? 0) + Number(t.amount)
  }
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}

function buildFlowData(txs: AnyTx[]) {
  const incomeTxs = txs.filter(t => t.type === 'income')
  const expenseTxs = txs.filter(t => t.type === 'expense')
  const inflows  = groupByCategory(incomeTxs)
  const outflows = groupByCategory(expenseTxs)
  const totalIn  = sumTxs(incomeTxs)
  const totalOut = sumTxs(expenseTxs)
  return { inflows, outflows, totalIn, totalOut, net: totalIn - totalOut }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; business?: string; tcMode?: string; tcValue?: string }>
}) {
  const params   = await searchParams
  const supabase = await createClient()

  const now      = new Date()
  const selectedMonth    = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedBusiness = params.business || 'all'

  const [year, month] = selectedMonth.split('-')
  const dateFrom      = `${selectedMonth}-01`
  const daysInMonth   = new Date(parseInt(year), parseInt(month), 0).getDate()
  const dateTo        = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthLabel = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`

  // ── Businesses ─────────────────────────────────────────────────────────────
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name')
    .order('name')

  const selectedBizObj  = selectedBusiness !== 'all'
    ? businesses?.find(b => String(b.id) === selectedBusiness)
    : null
  const businessLabel   = selectedBizObj?.name ?? 'Todas las empresas'

  // ── Settings (tipo de cambio) ──────────────────────────────────────────────
  const { data: settings } = await supabase.from('settings').select('*')
  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value ?? ''
  const settingsTcRate = parseFloat(settingsMap.current_rate) || 0
  const tcDate = settingsMap.rate_date || ''
  const tcType = settingsMap.rate_type || ''
  const tcRate = params.tcValue ? parseFloat(params.tcValue) : settingsTcRate
  const hasTC  = tcRate > 0

  // ── Fetch all PERCIBIDO transactions up to end of period ───────────────────
  // (includes prior periods to calculate opening balance)
  let query = supabase
    .from('transactions')
    .select('*, categories(name), businesses(name)')
    .eq('status', 'percibido')   // ← ONLY real cash movements
    .lte('date', dateTo)
    .order('date')

  if (selectedBusiness !== 'all') {
    query = query.eq('business_id', parseInt(selectedBusiness))
  }

  const { data: allRaw } = await query
  const all        = (allRaw ?? []) as AnyTx[]
  const priorTxs   = all.filter(t => t.date < dateFrom)
  const periodTxs  = all.filter(t => t.date >= dateFrom)

  // ── Opening balance (cumulative net from all prior percibido data) ─────────
  const openingBalance = priorTxs.reduce((s, t) =>
    s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)

  // ── Classify period transactions into flow sections ────────────────────────
  const withSection = periodTxs.map(t => ({
    ...t,
    section: classifyFlow((t.categories as { name: string } | null)?.name ?? null),
  }))

  const opTxs  = withSection.filter(t => t.section === 'operacional')
  const invTxs = withSection.filter(t => t.section === 'inversion')
  const finTxs = withSection.filter(t => t.section === 'financiamiento')

  const opFlow  = buildFlowData(opTxs)
  const invFlow = buildFlowData(invTxs)
  const finFlow = buildFlowData(finTxs)

  // ── Summary KPIs ───────────────────────────────────────────────────────────
  const totalEntradas  = sumTxs(periodTxs.filter(t => t.type === 'income'))
  const totalSalidas   = sumTxs(periodTxs.filter(t => t.type === 'expense'))
  const variacionNeta  = totalEntradas - totalSalidas
  const saldoFinal     = openingBalance + variacionNeta

  // ── Daily cumulative chart data ────────────────────────────────────────────
  let running = openingBalance
  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const day    = i + 1
    const dayStr = `${year}-${month}-${String(day).padStart(2, '0')}`
    const delta  = periodTxs
      .filter(t => t.date === dayStr)
      .reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)
    running += delta
    return { day, balance: Math.round(running) }
  })

  // ── Formatting ─────────────────────────────────────────────────────────────
  const C_POS   = '#059669'
  const C_NEG   = '#dc2626'
  const C_NAVY  = '#06083f'
  const C_MUTED = '#8b8ec0'
  const C_PURP  = '#6439ff'

  function signColor(n: number) {
    if (n > 0) return C_POS
    if (n < 0) return C_NEG
    return C_MUTED
  }

  /** Always shows a sign-aware formatted value, never '—' */
  function fmtBalance(n: number): string {
    if (n === 0) return '$0'
    return n > 0 ? `$${formatMoney(n)}` : `($${formatMoney(Math.abs(n))})`
  }

  function fmtUSD(ars: number): string {
    if (!hasTC || ars === 0) return '—'
    return `$${formatMoney(Math.round(Math.abs(ars) / tcRate))}`
  }

  // ── Flow section renderer (returns JSX) ───────────────────────────────────
  const flowSections = [
    {
      title:    'I. Actividades Operacionales',
      subtitle: 'Cobros y pagos de la operación regular del negocio',
      netLabel: 'Flujo Neto Operacional',
      flow: opFlow,
    },
    {
      title:    'II. Actividades de Inversión',
      subtitle: 'Compra y venta de activos fijos, equipamiento e inversiones',
      netLabel: 'Flujo Neto de Inversión',
      flow: invFlow,
    },
    {
      title:    'III. Actividades de Financiamiento',
      subtitle: 'Planes de pago, préstamos obtenidos y financiamiento externo',
      netLabel: 'Flujo Neto de Financiamiento',
      flow: finFlow,
    },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: C_MUTED }}>
            Grupo Lubrano
          </p>
          <h1 className="text-2xl font-bold" style={{ color: C_NAVY }}>
            Flujo de Caja
          </h1>
          <p className="text-base font-medium mt-0.5" style={{ color: C_MUTED }}>
            {businessLabel} · {monthLabel}
          </p>
          <p className="text-xs mt-1" style={{ color: '#b0b4d0' }}>
            Solo incluye movimientos de efectivo real (transacciones percibidas/pagadas)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filters form */}
          <form className="flex flex-wrap items-center gap-2">
            <select
              name="business"
              defaultValue={selectedBusiness}
              className="rounded-lg px-3 py-1.5 text-sm border"
              style={{ borderColor: '#e0e0ef', background: '#fafafa', color: C_NAVY }}
            >
              <option value="all">Todas las empresas</option>
              {(businesses ?? []).map(b => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
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
              style={{ background: C_PURP }}
            >
              Filtrar
            </button>
          </form>

          <ExportButtons
            transactions={periodTxs}
            monthLabel={monthLabel}
            businessLabel={businessLabel}
          />
        </div>
      </div>

      {/* Selector TC */}
      <Suspense fallback={null}>
        <TCSelector
          period={selectedMonth}
          settingsTc={settingsTcRate}
          settingsDate={tcDate}
          settingsType={tcType}
        />
      </Suspense>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label:   'Saldo Inicial',
            value:   openingBalance,
            display: fmtBalance(openingBalance),
            color:   C_PURP,
            sub:     'Acumulado al inicio del período',
          },
          {
            label:   'Total Entradas',
            value:   totalEntradas,
            display: `$${formatMoney(totalEntradas)}`,
            color:   C_POS,
            sub:     'Cobros efectivamente recibidos',
          },
          {
            label:   'Total Salidas',
            value:   totalSalidas,
            display: `($${formatMoney(totalSalidas)})`,
            color:   C_NEG,
            sub:     'Pagos efectivamente realizados',
          },
          {
            label:   'Saldo Final',
            value:   saldoFinal,
            display: fmtBalance(saldoFinal),
            color:   signColor(saldoFinal),
            sub:     `Al cierre de ${monthLabel}`,
          },
        ].map(({ label, value, display, color, sub }) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-4 hover:shadow-sm transition"
            style={{ borderColor: '#e8e8f0', borderLeft: `3px solid ${color}` }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: C_MUTED }}>
              {label}
            </p>
            <p className="text-xl font-bold tabular-nums" style={{ color }}>
              {display}
            </p>
            {hasTC && value !== 0 && (
              <p className="text-xs mt-0.5 tabular-nums" style={{ color: C_MUTED }}>
                USD {fmtUSD(value)}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: '#b0b4d0' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── CASH FLOW STATEMENT ── */}
      <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e8e8f0' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: '#f0f0f8' }}>
          <h2 className="font-semibold" style={{ color: C_NAVY }}>
            Estado de Flujo de Caja
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>
            {monthLabel} · Método directo · Solo efectivo real
          </p>
        </div>

        {/* Opening balance row */}
        <div
          className="px-6 py-3 flex justify-between items-center border-b"
          style={{ borderColor: '#f0f0f8', background: '#fafafa' }}
        >
          <span className="text-sm font-medium" style={{ color: C_NAVY }}>
            Saldo al Inicio del Período
          </span>
          <div className="text-right">
            <span className="text-sm font-semibold tabular-nums" style={{ color: C_PURP }}>
              {fmtBalance(openingBalance)}
            </span>
            {hasTC && openingBalance !== 0 && (
              <p className="text-xs" style={{ color: C_MUTED }}>USD {fmtUSD(openingBalance)}</p>
            )}
          </div>
        </div>

        {/* Three sections: Operacional / Inversión / Financiamiento */}
        {flowSections.map(({ title, subtitle, netLabel, flow }) => {
          const hasData = flow.inflows.length > 0 || flow.outflows.length > 0
          return (
            <div key={title} className="border-b" style={{ borderColor: '#f0f0f8' }}>

              {/* Section label */}
              <div className="px-6 py-3" style={{ background: '#f7f7fc' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C_NAVY }}>
                  {title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>{subtitle}</p>
              </div>

              {!hasData ? (
                <div className="px-6 py-3 text-sm" style={{ color: C_MUTED }}>
                  Sin movimientos en este período
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#fafafe' }}>
                      <th className="px-6 py-2 text-left text-xs font-medium" style={{ color: C_MUTED }}>
                        Concepto
                      </th>
                      <th className="px-6 py-2 text-right text-xs font-medium w-44" style={{ color: C_MUTED }}>
                        ARS
                      </th>
                      {hasTC && (
                        <th className="px-6 py-2 text-right text-xs font-medium w-32" style={{ color: C_MUTED }}>
                          USD
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>

                    {/* (+) Inflows */}
                    {flow.inflows.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={hasTC ? 3 : 2}
                            className="px-6 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: C_POS }}
                          >
                            (+) Entradas de efectivo
                          </td>
                        </tr>
                        {flow.inflows.map(c => (
                          <tr key={c.name} className="border-t" style={{ borderColor: '#f4f4fc' }}>
                            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
                              {c.name}
                            </td>
                            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_POS }}>
                              ${formatMoney(c.total)}
                            </td>
                            {hasTC && (
                              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                                {fmtUSD(c.total)}
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr className="border-t" style={{ borderColor: '#e8e8f0' }}>
                          <td className="py-2 pl-6 pr-6 text-xs font-semibold" style={{ color: C_NAVY }}>
                            Subtotal entradas
                          </td>
                          <td className="py-2 px-6 text-right tabular-nums text-sm font-bold" style={{ color: C_POS }}>
                            ${formatMoney(flow.totalIn)}
                          </td>
                          {hasTC && (
                            <td className="py-2 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                              {fmtUSD(flow.totalIn)}
                            </td>
                          )}
                        </tr>
                      </>
                    )}

                    {/* (−) Outflows */}
                    {flow.outflows.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={hasTC ? 3 : 2}
                            className="px-6 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: C_NEG }}
                          >
                            (−) Salidas de efectivo
                          </td>
                        </tr>
                        {flow.outflows.map(c => (
                          <tr key={c.name} className="border-t" style={{ borderColor: '#f4f4fc' }}>
                            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
                              {c.name}
                            </td>
                            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_NEG }}>
                              (${formatMoney(c.total)})
                            </td>
                            {hasTC && (
                              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                                ({fmtUSD(c.total)})
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr className="border-t" style={{ borderColor: '#e8e8f0' }}>
                          <td className="py-2 pl-6 pr-6 text-xs font-semibold" style={{ color: C_NAVY }}>
                            Subtotal salidas
                          </td>
                          <td className="py-2 px-6 text-right tabular-nums text-sm font-bold" style={{ color: C_NEG }}>
                            (${formatMoney(flow.totalOut)})
                          </td>
                          {hasTC && (
                            <td className="py-2 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                              ({fmtUSD(flow.totalOut)})
                            </td>
                          )}
                        </tr>
                      </>
                    )}

                    {/* Net row for this section */}
                    <tr style={{ background: flow.net >= 0 ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)' }}>
                      <td className="py-2.5 px-6 text-sm font-bold" style={{ color: C_NAVY }}>
                        {netLabel}
                      </td>
                      <td className="py-2.5 px-6 text-right tabular-nums text-sm font-bold" style={{ color: signColor(flow.net) }}>
                        {fmtBalance(flow.net)}
                      </td>
                      {hasTC && (
                        <td className="py-2.5 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                          {flow.net !== 0 ? fmtUSD(flow.net) : '—'}
                        </td>
                      )}
                    </tr>

                  </tbody>
                </table>
              )}
            </div>
          )
        })}

        {/* Variación neta */}
        <div
          className="px-6 py-3 flex justify-between items-center border-b"
          style={{ borderColor: '#e0e0ef', background: '#f7f7fc' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: C_NAVY }}>
              Variación Neta de Efectivo
            </p>
            <p className="text-xs" style={{ color: C_MUTED }}>
              Entradas − Salidas del período
            </p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold tabular-nums" style={{ color: signColor(variacionNeta) }}>
              {fmtBalance(variacionNeta)}
            </p>
            {hasTC && variacionNeta !== 0 && (
              <p className="text-xs" style={{ color: C_MUTED }}>USD {fmtUSD(variacionNeta)}</p>
            )}
          </div>
        </div>

        {/* Final balance */}
        <div
          className="px-6 py-5 flex justify-between items-center"
          style={{
            background: saldoFinal >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
          }}
        >
          <div>
            <p className="text-base font-bold" style={{ color: C_NAVY }}>
              Saldo Final de Efectivo
            </p>
            <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>
              Al cierre de {monthLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums" style={{ color: signColor(saldoFinal) }}>
              {fmtBalance(saldoFinal)}
            </p>
            {hasTC && (
              <p className="text-sm mt-1 tabular-nums" style={{ color: C_MUTED }}>
                ≈ USD {saldoFinal !== 0 ? fmtUSD(saldoFinal) : '$0'}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* ── CUMULATIVE CHART ── */}
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e8e8f0' }}>
        <div className="mb-4">
          <h2 className="font-semibold" style={{ color: C_NAVY }}>
            Flujo de Caja Acumulado
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>
            Saldo acumulado día a día durante {monthLabel}
          </p>
        </div>
        <CashFlowChart data={chartData} />
      </div>

      {/* ── NOTE: opening balance source ── */}
      {priorTxs.length === 0 && (
        <div
          className="rounded-xl border px-5 py-3.5 text-sm"
          style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}
        >
          <strong>Nota:</strong> El saldo inicial es $0 porque no hay transacciones percibidas
          registradas en períodos anteriores. A medida que se carguen datos históricos, este
          valor se actualizará automáticamente.
        </div>
      )}

      {/* ── TRANSACTION DETAIL (accordion) ── */}
      <TransactionDetail transactions={periodTxs} />

    </div>
  )
}
