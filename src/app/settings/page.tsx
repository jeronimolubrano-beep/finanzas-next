import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase.from('settings').select('*')

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) {
    settingsMap[s.key] = s.value ?? ''
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tipo de Cambio</h1>
      <SettingsForm
        currentRate={settingsMap.current_rate || ''}
        rateDate={settingsMap.rate_date || ''}
      />
    </div>
  )
}
