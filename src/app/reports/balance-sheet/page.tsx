import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { getBalanceSheet, getConsolidatedBalanceSheet, calculateBalanceRatios } from './actions'
import { BalanceSheetTable } from './BalanceSheetTable'
import { BalanceRatios } from './BalanceRatios'
import { ExportButtons } from './ExportButtons'
import { getReportFxSettings, getMonthlyRate } from '@/lib/fx'
import { DollarSign } from 'lucide-react'
import { InlineFxLoader } from '@/components/InlineFxLoader'

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; business?: string }>
}) {
  const params   = await searchParams
  const supabase = await createClient()

  const now      = new Date()
  const selectedMonth    = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedBusiness = params.business || 'all'

  const [year, month] = selectedMonth.split('-')
  const daysInMonth   = new Date(parseInt(year), parseInt(month), 0).getDate()
  const dateEnd       = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

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
  const businessLabel   = selectedBizObj?.name ?? 'Consolidado'

  // ── Report FX settings (closing rate for stock items) ─────────────────────
  const { usdMode: fxUsdMode, rateType: fxRateType } = await getReportFxSettings()
  const fxClosingRate = fxUsdMode
    ? await getMonthlyRate(parseInt(year), parseInt(month), fxRateType, 'closing')
    : null
  const effectiveTcRate = fxClosingRate ?? 0
  const effectiveHasTC  = fxUsdMode && effectiveTcRate > 0

  // ── Fetch Balance Sheet ────────────────────────────────────────────────────
  const balance = selectedBusiness === 'all'
    ? await getConsolidatedBalanceSheet(selectedMonth)
    : await getBalanceSheet(parseInt(selectedBusiness), selectedMonth)

  const ratios = balance ? await calculateBalanceRatios(balance) : null

  // ── Color scheme ───────────────────────────────────────────────────────────
  const C_POS   = '#059669'
  const C_NEG   = '#dc2626'
  const C_NAVY  = '#06083f'
  const C_MUTED = '#8b8ec0'
  const C_PURP  = '#6439ff'
  const C_WARN  = '#f59e0b'

  function signColor(n: number) {
    if (n > 0) return C_POS
    if (n < 0) return C_NEG
    return C_MUTED
  }

  function fmtBalance(n: number): string {
    if (n === 0) return '$0'
    return n > 0 ? `$${formatMoney(n)}` : `($${formatMoney(Math.abs(n))})`
  }

  function fmtUSD(ars: number): string {
    if (!effectiveHasTC || ars === 0) return '—'
    return `$${formatMoney(Math.round(Math.abs(ars) / effectiveTcRate))}`
  }

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
            Balance
          </h1>
          <p className="text-base font-medium mt-0.5" style={{ color: C_MUTED }}>
            {businessLabel} · {monthLabel}
          </p>
          <p className="text-xs mt-1" style={{ color: '#b0b4d0' }}>
            Activos = Pasivos + Patrimonio (accrual accounting)
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
              <option value="all">Consolidado</option>
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

          {balance && (
            <ExportButtons
              balance={balance}
              monthLabel={monthLabel}
              businessLabel={businessLabel}
            />
          )}
        </div>
      </div>

      {/* USD mode indicator / loader */}
      {fxUsdMode && effectiveHasTC && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm"
             style={{ background: 'rgba(100,57,255,0.05)', borderColor: 'rgba(100,57,255,0.2)', color: '#6439ff' }}>
          <DollarSign className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Modo USD activo</span>
          <span className="text-xs" style={{ color: '#8b8ec0' }}>
            · TC {fxRateType === 'blue' ? 'Blue' : 'Oficial'} cierre {selectedMonth}
            {` · $${effectiveTcRate.toLocaleString('es-AR')}`}
          </span>
        </div>
      )}
      {fxUsdMode && !effectiveHasTC && (
        <InlineFxLoader
          period={selectedMonth}
          rateType={fxRateType}
          label={monthLabel}
        />
      )}

      {/* ── BALANCE VALIDATION ALERT ── */}
      {balance && (
        <div
          className="rounded-xl border px-5 py-3.5 flex justify-between items-center"
          style={{
            borderColor: balance.isBalanced ? '#d1fae5' : '#fee2e2',
            background: balance.isBalanced ? '#f0fdf4' : '#fef2f2',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold" style={{ color: balance.isBalanced ? C_POS : C_NEG }}>
              {balance.isBalanced ? '✓' : '✗'}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: balance.isBalanced ? C_POS : C_NEG }}>
                {balance.isBalanced ? 'Balance cuadra' : 'Balance NO cuadra'}
              </p>
              {!balance.isBalanced && (
                <p className="text-xs" style={{ color: C_MUTED }}>
                  Diferencia: ${formatMoney(balance.balanceDifference)} ARS
                </p>
              )}
            </div>
          </div>
          {balance.isBalanced && (
            <p className="text-xs" style={{ color: C_MUTED }}>
              Activos ${formatMoney(balance.assets.total)} = Pasivos + Patrimonio ${formatMoney(balance.totalLiabilitiesEquity)}
            </p>
          )}
        </div>
      )}

      {/* ── KPI CARDS ── */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            {
              label:   'Total Activos',
              value:   balance.assets.total,
              color:   C_POS,
              sub:     'Activos corrientes + fijos',
            },
            {
              label:   'Total Pasivos',
              value:   balance.liabilities.total,
              color:   C_NEG,
              sub:     'Pasivos corrientes + largo plazo',
            },
            {
              label:   'Patrimonio Neto',
              value:   balance.equity.total,
              color:   balance.equity.total >= 0 ? C_PURP : C_NEG,
              sub:     'Capital + Ganancias Retenidas',
            },
          ].map(({ label, value, color, sub }) => (
            <div
              key={label}
              className="rounded-xl border bg-white p-4 hover:shadow-sm transition"
              style={{ borderColor: '#e8e8f0', borderLeft: `3px solid ${color}` }}
            >
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: C_MUTED }}>
                {label}
              </p>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>
                {fmtBalance(value)}
              </p>
              {effectiveHasTC && value !== 0 && (
                <p className="text-xs mt-0.5 tabular-nums" style={{ color: C_MUTED }}>
                  USD {fmtUSD(value)}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: '#b0b4d0' }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── BALANCE SHEET TABLE ── */}
      {balance && (
        <BalanceSheetTable
          balance={balance}
          tcRate={effectiveTcRate}
          hasTC={effectiveHasTC}
          fmtBalance={fmtBalance}
          fmtUSD={fmtUSD}
          formatMoney={formatMoney}
        />
      )}

      {/* ── FINANCIAL RATIOS ── */}
      {balance && ratios && (
        <BalanceRatios ratios={ratios} />
      )}

      {/* ── ERROR STATE ── */}
      {!balance && (
        <div
          className="rounded-xl border px-5 py-6 text-center"
          style={{ borderColor: '#fee2e2', background: '#fef2f2' }}
        >
          <p className="text-sm font-medium" style={{ color: C_NEG }}>
            No se pudo cargar el Balance Sheet
          </p>
          <p className="text-xs mt-1" style={{ color: C_MUTED }}>
            Verifica que existan transacciones en el período seleccionado
          </p>
        </div>
      )}

    </div>
  )
}
