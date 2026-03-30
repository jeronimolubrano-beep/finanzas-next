import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from('settings').select('*')

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) {
    settingsMap[s.key] = s.value ?? ''
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--navy)' }}>Tipo de Cambio</h1>
      <SettingsForm
        currentRate={settingsMap.current_rate || ''}
        rateDate={settingsMap.rate_date || ''}
        rateType={settingsMap.rate_type || ''}
      />
    </div>
  )
}
