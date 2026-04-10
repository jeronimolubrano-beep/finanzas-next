import { BalanceSheet } from '@/lib/types'

interface Props {
  balance: BalanceSheet
  tcRate: number
  hasTC: boolean
  fmtBalance: (n: number) => string
  fmtUSD: (n: number) => string
  formatMoney: (n: number) => string
}

export function BalanceSheetTable({
  balance,
  tcRate,
  hasTC,
  fmtBalance,
  fmtUSD,
  formatMoney,
}: Props) {
  const C_NAVY = '#06083f'
  const C_MUTED = '#8b8ec0'
  const C_POS = '#059669'

  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e8e8f0' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: '#f0f0f8' }}>
        <h2 className="font-semibold" style={{ color: C_NAVY }}>
          {balance.businessName}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>
          Período: {balance.period} · Accrual Accounting
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#fafafe' }}>
            <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: C_MUTED }}>
              CONCEPTO
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium w-44" style={{ color: C_MUTED }}>
              ARS
            </th>
            {hasTC && (
              <th className="px-6 py-3 text-right text-xs font-medium w-32" style={{ color: C_MUTED }}>
                USD
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* ASSETS SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <tr style={{ background: '#f7f7fc' }}>
            <td
              colSpan={hasTC ? 3 : 2}
              className="px-6 py-3 text-xs font-bold uppercase tracking-widest"
              style={{ color: C_NAVY }}
            >
              ACTIVOS
            </td>
          </tr>

          {/* Current Assets */}
          <tr style={{ background: '#fafafe' }}>
            <td className="px-6 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C_NAVY }}>
              Activos Corrientes
            </td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Caja
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_POS }}>
              ${formatMoney(balance.assets.current.cash)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.current.cash)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Cuentas por Cobrar
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_POS }}>
              ${formatMoney(balance.assets.current.receivables)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.current.receivables)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#e8e8f0' }}>
            <td className="py-2 pl-6 pr-6 text-xs font-semibold" style={{ color: C_NAVY }}>
              Subtotal Activos Corrientes
            </td>
            <td className="py-2 px-6 text-right tabular-nums text-sm font-bold" style={{ color: C_POS }}>
              ${formatMoney(balance.assets.current.subtotal)}
            </td>
            {hasTC && (
              <td className="py-2 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.current.subtotal)}
              </td>
            )}
          </tr>

          {/* Fixed Assets */}
          <tr style={{ background: '#fafafe' }}>
            <td className="px-6 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C_NAVY }}>
              Activos Fijos
            </td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Propiedad, Planta y Equipo
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_MUTED }}>
              ${formatMoney(balance.assets.fixed.ppe)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.fixed.ppe)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              (menos) Depreciación Acumulada
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_MUTED }}>
              (${formatMoney(balance.assets.fixed.depreciation)})
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.fixed.depreciation)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#e8e8f0' }}>
            <td className="py-2 pl-6 pr-6 text-xs font-semibold" style={{ color: C_NAVY }}>
              Subtotal Activos Fijos
            </td>
            <td className="py-2 px-6 text-right tabular-nums text-sm font-bold" style={{ color: C_MUTED }}>
              ${formatMoney(balance.assets.fixed.subtotal)}
            </td>
            {hasTC && (
              <td className="py-2 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.fixed.subtotal)}
              </td>
            )}
          </tr>

          {/* Total Assets */}
          <tr style={{ background: 'rgba(5,150,105,0.06)' }}>
            <td className="py-3 px-6 text-sm font-bold" style={{ color: C_NAVY }}>
              TOTAL ACTIVOS
            </td>
            <td className="py-3 px-6 text-right tabular-nums text-base font-bold" style={{ color: C_POS }}>
              ${formatMoney(balance.assets.total)}
            </td>
            {hasTC && (
              <td className="py-3 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.assets.total)}
              </td>
            )}
          </tr>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* LIABILITIES SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <tr style={{ background: '#f7f7fc' }}>
            <td
              colSpan={hasTC ? 3 : 2}
              className="px-6 py-3 text-xs font-bold uppercase tracking-widest"
              style={{ color: C_NAVY }}
            >
              PASIVOS
            </td>
          </tr>

          {/* Current Liabilities */}
          <tr style={{ background: '#fafafe' }}>
            <td className="px-6 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C_NAVY }}>
              Pasivos Corrientes
            </td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Cuentas por Pagar
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: '#dc2626' }}>
              ${formatMoney(balance.liabilities.current.payables)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.liabilities.current.payables)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Impuestos por Pagar
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_MUTED }}>
              ${formatMoney(balance.liabilities.current.taxesPayable)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.liabilities.current.taxesPayable)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#e8e8f0' }}>
            <td className="py-2 pl-6 pr-6 text-xs font-semibold" style={{ color: C_NAVY }}>
              Subtotal Pasivos Corrientes
            </td>
            <td className="py-2 px-6 text-right tabular-nums text-sm font-bold" style={{ color: '#dc2626' }}>
              ${formatMoney(balance.liabilities.current.subtotal)}
            </td>
            {hasTC && (
              <td className="py-2 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.liabilities.current.subtotal)}
              </td>
            )}
          </tr>

          {/* Long-term Liabilities */}
          <tr style={{ background: '#fafafe' }}>
            <td className="px-6 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C_NAVY }}>
              Pasivos a Largo Plazo
            </td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Deudas a Largo Plazo
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: C_MUTED }}>
              ${formatMoney(balance.liabilities.longTerm.debt)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.liabilities.longTerm.debt)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#e8e8f0' }}>
            <td className="py-2 pl-6 pr-6 text-xs font-semibold" style={{ color: C_NAVY }}>
              Subtotal Pasivos a Largo Plazo
            </td>
            <td className="py-2 px-6 text-right tabular-nums text-sm font-bold" style={{ color: C_MUTED }}>
              ${formatMoney(balance.liabilities.longTerm.subtotal)}
            </td>
            {hasTC && (
              <td className="py-2 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.liabilities.longTerm.subtotal)}
              </td>
            )}
          </tr>

          {/* Total Liabilities */}
          <tr style={{ background: 'rgba(220,38,38,0.06)' }}>
            <td className="py-3 px-6 text-sm font-bold" style={{ color: C_NAVY }}>
              TOTAL PASIVOS
            </td>
            <td className="py-3 px-6 text-right tabular-nums text-base font-bold" style={{ color: '#dc2626' }}>
              ${formatMoney(balance.liabilities.total)}
            </td>
            {hasTC && (
              <td className="py-3 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.liabilities.total)}
              </td>
            )}
          </tr>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* EQUITY SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <tr style={{ background: '#f7f7fc' }}>
            <td
              colSpan={hasTC ? 3 : 2}
              className="px-6 py-3 text-xs font-bold uppercase tracking-widest"
              style={{ color: C_NAVY }}
            >
              PATRIMONIO
            </td>
          </tr>

          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Capital
            </td>
            <td className="py-1.5 px-6 text-right tabular-nums text-sm font-medium" style={{ color: '#6439ff' }}>
              ${formatMoney(balance.equity.capital)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.equity.capital)}
              </td>
            )}
          </tr>
          <tr className="border-t" style={{ borderColor: '#f4f4fc' }}>
            <td className="py-1.5 pl-10 pr-6 text-sm" style={{ color: C_NAVY }}>
              Ganancias Retenidas
            </td>
            <td
              className="py-1.5 px-6 text-right tabular-nums text-sm font-medium"
              style={{ color: balance.equity.retainedEarnings >= 0 ? C_POS : '#dc2626' }}
            >
              ${formatMoney(balance.equity.retainedEarnings)}
            </td>
            {hasTC && (
              <td className="py-1.5 px-6 text-right tabular-nums text-xs" style={{ color: C_MUTED }}>
                {fmtUSD(balance.equity.retainedEarnings)}
              </td>
            )}
          </tr>

          {/* Total Equity */}
          <tr style={{ background: balance.equity.total >= 0 ? 'rgba(100,57,255,0.06)' : 'rgba(220,38,38,0.06)' }}>
            <td className="py-3 px-6 text-sm font-bold" style={{ color: C_NAVY }}>
              TOTAL PATRIMONIO
            </td>
            <td
              className="py-3 px-6 text-right tabular-nums text-base font-bold"
              style={{ color: balance.equity.total >= 0 ? '#6439ff' : '#dc2626' }}
            >
              ${formatMoney(balance.equity.total)}
            </td>
            {hasTC && (
              <td className="py-3 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.equity.total)}
              </td>
            )}
          </tr>

          {/* Total Liabilities + Equity */}
          <tr style={{ background: 'rgba(100,57,255,0.08)' }}>
            <td className="py-3 px-6 text-sm font-bold" style={{ color: C_NAVY }}>
              TOTAL PASIVOS + PATRIMONIO
            </td>
            <td className="py-3 px-6 text-right tabular-nums text-base font-bold" style={{ color: '#6439ff' }}>
              ${formatMoney(balance.totalLiabilitiesEquity)}
            </td>
            {hasTC && (
              <td className="py-3 px-6 text-right tabular-nums text-xs font-medium" style={{ color: C_MUTED }}>
                {fmtUSD(balance.totalLiabilitiesEquity)}
              </td>
            )}
          </tr>

        </tbody>
      </table>
    </div>
  )
}
