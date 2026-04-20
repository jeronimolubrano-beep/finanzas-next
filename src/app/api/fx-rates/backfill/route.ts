/**
 * POST /api/fx-rates/backfill
 *
 * Fetches daily historical exchange rates from Bluelytics for every day in a
 * given month range, computes avg_rate (mean of daily values) and closing_rate
 * (last available trading day), then upserts into monthly_fx_rates.
 *
 * Body: { rate_type: "oficial" | "blue", from: "YYYY-MM", to: "YYYY-MM" }
 *
 * Rate types map to Bluelytics fields:
 *   oficial → oficial.value_sell
 *   blue    → blue.value_sell
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

interface BluelyticsDay {
  oficial: { value_buy: number; value_sell: number }
  blue:    { value_buy: number; value_sell: number }
  last_update: string
}

async function fetchDay(dateStr: string): Promise<BluelyticsDay | null> {
  try {
    const res = await fetch(
      `https://api.bluelytics.com.ar/v2/historical?day=${dateStr}`,
      { cache: 'no-store' }
    )
    if (res.status === 404) return null // weekend / holiday
    if (!res.ok) throw new Error(`Bluelytics ${res.status} for ${dateStr}`)
    return res.json()
  } catch {
    return null
  }
}

function extractRate(data: BluelyticsDay, rateType: string): number | null {
  if (rateType === 'oficial') return data.oficial?.value_sell ?? null
  if (rateType === 'blue')    return data.blue?.value_sell    ?? null
  return null
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Parse "YYYY-MM" → [year, month]
function parseYM(s: string): [number, number] {
  const [y, m] = s.split('-').map(Number)
  return [y, m]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rate_type, from, to } = body as { rate_type: string; from: string; to: string }

    if (!rate_type || !from || !to) {
      return NextResponse.json({ error: 'rate_type, from, to son requeridos' }, { status: 400 })
    }
    if (!['oficial', 'blue'].includes(rate_type)) {
      return NextResponse.json({ error: 'rate_type debe ser "oficial" o "blue"' }, { status: 400 })
    }

    const [fromYear, fromMonth] = parseYM(from)
    const [toYear, toMonth]     = parseYM(to)

    const supabase = await createClient()
    const processed: { month: string; avg: number; closing: number }[] = []
    const skipped:   string[] = []

    // Iterate each month in the range
    let year = fromYear, month = fromMonth
    while (year < toYear || (year === toYear && month <= toMonth)) {
      const totalDays = daysInMonth(year, month)
      const values: number[] = []
      let closingValue: number | null = null

      // Fetch every day of the month (skip failures silently)
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${pad(month)}-${pad(d)}`
        const data = await fetchDay(dateStr)
        if (!data) continue
        const val = extractRate(data, rate_type)
        if (val === null || val <= 0) continue
        values.push(val)
        closingValue = val // last valid value = closing
      }

      const monthLabel = `${year}-${pad(month)}`

      if (values.length === 0 || closingValue === null) {
        skipped.push(monthLabel)
      } else {
        const avg = values.reduce((s, v) => s + v, 0) / values.length

        const { error } = await supabase.from('monthly_fx_rates').upsert({
          year,
          month,
          rate_type,
          avg_rate:     Number(avg.toFixed(4)),
          closing_rate: Number(closingValue.toFixed(4)),
          source:       'bluelytics',
          updated_at:   new Date().toISOString(),
        }, { onConflict: 'year,month,rate_type' })

        if (error) {
          return NextResponse.json({ error: `DB error for ${monthLabel}: ${error.message}` }, { status: 500 })
        }

        processed.push({ month: monthLabel, avg: Number(avg.toFixed(2)), closing: closingValue })
      }

      // Advance month
      month++
      if (month > 12) { month = 1; year++ }
    }

    return NextResponse.json({
      ok: true,
      rate_type,
      processed_count: processed.length,
      skipped_count:   skipped.length,
      processed,
      skipped,
    })
  } catch (err) {
    console.error('[fx-rates/backfill]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
