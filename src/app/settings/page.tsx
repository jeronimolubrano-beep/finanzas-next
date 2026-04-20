import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './SettingsForm'
import { ReportCurrencySettings } from './ReportCurrencySettings'
import { CashPositionSettings } from './CashPositionSettings'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from('settings').select('*')

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) {
    settingsMap[s.key] = s.value ?? ''
  }

  // Count distinct months already stored in monthly_fx_rates
  const { count: monthCount } = await supabase
    .from('monthly_fx_rates')
    .select('*', { count: 'exact', head: true })

  // Businesses + latest cash positions
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name')
    .order('name')

  // Latest cash position per business: fetch all and pick most recent per business_id
  const { data: allPositions } = await supabase
    .from('cash_positions')
    .select('business_id, amount_ars, recorded_at')
    .order('recorded_at', { ascending: false })

  // Deduplicate: keep only the latest per business_id
  const latestMap: Record<string, { business_id: number | null; amount_ars: number; recorded_at: string }> = {}
  for (const p of allPositions ?? []) {
    const key = p.business_id === null ? 'null' : String(p.business_id)
    if (!latestMap[key]) latestMap[key] = p
  }
  const latestPositions = Object.values(latestMap)

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--navy)' }}>Tipo de Cambio</h1>
        <SettingsForm
          currentRate={settingsMap.current_rate || ''}
          rateDate={settingsMap.rate_date || ''}
          rateType={settingsMap.rate_type || ''}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--navy)' }}>Reportes en USD</h1>
        <ReportCurrencySettings
          usdMode={settingsMap.reports_usd_mode === 'true'}
          rateType={settingsMap.reports_rate_type || 'oficial'}
          monthCount={monthCount ?? 0}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--navy)' }}>Posición de Caja</h1>
        <CashPositionSettings
          businesses={businesses ?? []}
          positions={latestPositions}
        />
      </div>
    </div>
  )
}
