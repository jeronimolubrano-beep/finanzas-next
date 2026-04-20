/**
 * FX (foreign exchange) utility for ARS → USD report conversion.
 *
 * The monthly_fx_rates table is the single source of truth for historical rates.
 * Live API calls are only made for the current incomplete month.
 */

import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FxSettings {
  usdMode:  boolean
  rateType: string  // 'oficial' | 'blue'
}

// ── Settings reader ───────────────────────────────────────────────────────────

/**
 * Reads the user's report currency preferences from the settings table.
 */
export async function getReportFxSettings(): Promise<FxSettings> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['reports_usd_mode', 'reports_rate_type'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value ?? ''

  return {
    usdMode:  map['reports_usd_mode'] === 'true',
    rateType: map['reports_rate_type'] || 'oficial',
  }
}

// ── Single-month lookup ───────────────────────────────────────────────────────

/**
 * Returns the conversion rate for a given year/month from the DB.
 * - mode 'avg':     use for flow items (income statement, cash flow)
 * - mode 'closing': use for stock items (balance sheet)
 * Returns null if no rate is stored for that month.
 */
export async function getMonthlyRate(
  year: number,
  month: number,
  rateType: string,
  mode: 'avg' | 'closing' = 'avg',
): Promise<number | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('monthly_fx_rates')
    .select('avg_rate, closing_rate')
    .eq('year', year)
    .eq('month', month)
    .eq('rate_type', rateType)
    .single()

  if (!data) return null
  return mode === 'avg' ? Number(data.avg_rate) : Number(data.closing_rate)
}

// ── Bulk month lookup ─────────────────────────────────────────────────────────

/**
 * Returns a Map<monthNumber, rate> for multiple months in a single year.
 * Months not in the DB will simply be absent from the map.
 */
export async function getMonthlyRates(
  year: number,
  months: number[],
  rateType: string,
  mode: 'avg' | 'closing' = 'avg',
): Promise<Map<number, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('monthly_fx_rates')
    .select('month, avg_rate, closing_rate')
    .eq('year', year)
    .in('month', months)
    .eq('rate_type', rateType)

  const map = new Map<number, number>()
  for (const row of data ?? []) {
    const rate = mode === 'avg' ? Number(row.avg_rate) : Number(row.closing_rate)
    map.set(row.month, rate)
  }
  return map
}

// ── Current-month fallback ────────────────────────────────────────────────────

/**
 * For the current (incomplete) month: checks the DB first; if missing,
 * falls back to a live Bluelytics call.
 * Returns { rate, isLive } so callers can show "cotización en tiempo real".
 */
export async function getCurrentMonthRate(
  rateType: string,
): Promise<{ rate: number; isLive: boolean } | null> {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Try DB first
  const dbRate = await getMonthlyRate(year, month, rateType, 'avg')
  if (dbRate !== null) return { rate: dbRate, isLive: false }

  // Live fallback via Bluelytics
  try {
    const today = now.toISOString().slice(0, 10)
    const res = await fetch(
      `https://api.bluelytics.com.ar/v2/historical?day=${today}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const val  = rateType === 'blue'
      ? data.blue?.value_sell
      : data.oficial?.value_sell
    if (!val) return null
    return { rate: Number(val), isLive: true }
  } catch {
    return null
  }
}

// ── Conversion helper ─────────────────────────────────────────────────────────

/**
 * Divides an ARS amount by the given rate.
 * Returns null (not 0) when rate is missing so callers can show "—".
 */
export function arsToUsd(amountArs: number, rate: number | null): number | null {
  if (rate === null || rate <= 0) return null
  return amountArs / rate
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtUsd(n: number): string {
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function fmtUsd2(n: number): string {
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
