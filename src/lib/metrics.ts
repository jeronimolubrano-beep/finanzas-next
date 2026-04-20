/**
 * Business metrics: Burn Rate and Runway.
 *
 * Burn Rate = average monthly expense over the last N complete months (excluding current month).
 * Runway    = latestCashPosition / burnRate3m  (expressed in months).
 */

import { createClient } from '@/lib/supabase/server'
import { getMonthlyRates } from '@/lib/fx'

export interface BurnRateResult {
  ars: number            // average monthly expense in ARS
  usd: number | null     // average monthly expense in USD (null if no FX data)
  monthsUsed: number     // how many complete months were averaged
}

export interface RunwayResult {
  months: number | null  // null if no cash position recorded
  burnRateArs: number    // burn rate used (3-month)
  cashArs: number        // latest cash position in ARS (0 if none)
}

/**
 * Returns the burn rate (average monthly expense) over the last N complete months.
 * "Complete" means any month before the current calendar month.
 */
export async function getBurnRate(
  businessId: number | null,
  monthsBack: 3 | 6 | 12,
  rateType: string = 'oficial',
): Promise<BurnRateResult> {
  const supabase = await createClient()
  const now = new Date()

  // Build list of complete months to include (excluding current month)
  type MonthSlot = { year: number; month: number }
  const slots: MonthSlot[] = []
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    slots.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  if (slots.length === 0) return { ars: 0, usd: null, monthsUsed: 0 }

  // Build date range
  const oldest = slots[slots.length - 1]
  const newest = slots[0]
  const dateFrom = `${oldest.year}-${String(oldest.month).padStart(2, '0')}-01`
  const lastDay = new Date(newest.year, newest.month, 0).getDate()
  const dateTo = `${newest.year}-${String(newest.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  let q = supabase
    .from('transactions')
    .select('date, type, amount')
    .eq('type', 'expense')
    .gte('date', dateFrom)
    .lte('date', dateTo)

  if (businessId !== null) {
    q = q.eq('business_id', businessId)
  }

  const { data: txs } = await q

  if (!txs || txs.length === 0) {
    return { ars: 0, usd: null, monthsUsed: monthsBack }
  }

  // Sum expenses per month
  const monthlyExpense: Record<string, number> = {}
  for (const slot of slots) {
    monthlyExpense[`${slot.year}-${slot.month}`] = 0
  }
  for (const t of txs) {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (key in monthlyExpense) {
      monthlyExpense[key] += Number(t.amount)
    }
  }

  const totalExpense = Object.values(monthlyExpense).reduce((a, b) => a + b, 0)
  const avgArs = totalExpense / monthsBack

  // USD conversion: fetch FX rates for the months
  // Group slots by year for efficiency
  const byYear: Record<number, number[]> = {}
  for (const s of slots) {
    if (!byYear[s.year]) byYear[s.year] = []
    byYear[s.year].push(s.month)
  }

  let totalUsdExpense = 0
  let fxMissing = false

  for (const [yearStr, months] of Object.entries(byYear)) {
    const y = parseInt(yearStr)
    const fxMap = await getMonthlyRates(y, months, rateType, 'avg')
    for (const slot of slots.filter(s => s.year === y)) {
      const key = `${slot.year}-${slot.month}`
      const rate = fxMap.get(slot.month)
      if (!rate) { fxMissing = true; continue }
      totalUsdExpense += monthlyExpense[key] / rate
    }
  }

  const avgUsd = fxMissing ? null : totalUsdExpense / monthsBack

  return { ars: avgArs, usd: avgUsd, monthsUsed: monthsBack }
}

/**
 * Returns the runway in months based on the latest cash position and 3-month burn rate.
 */
export async function getRunway(
  businessId: number | null,
): Promise<RunwayResult> {
  const supabase = await createClient()

  // Fetch latest cash position
  let cashQuery = supabase
    .from('cash_positions')
    .select('amount_ars, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)

  if (businessId !== null) {
    cashQuery = cashQuery.eq('business_id', businessId)
  }

  const { data: cashRows } = await cashQuery
  const cashArs = cashRows && cashRows.length > 0 ? Number(cashRows[0].amount_ars) : 0

  // Use 3-month burn rate
  const burn = await getBurnRate(businessId, 3)
  const burnRateArs = burn.ars

  const months =
    cashArs > 0 && burnRateArs > 0
      ? cashArs / burnRateArs
      : cashArs === 0
        ? null
        : null

  return { months, burnRateArs, cashArs }
}
