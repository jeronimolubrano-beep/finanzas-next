import { createClient } from '@/lib/supabase/server'
import { OcrUploader } from './OcrUploader'

export default async function OcrPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase.from('categories').select('*').order('type').order('name')
  const { data: accounts } = await supabase.from('accounts').select('*').order('name')
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--navy)' }}>Cargar desde imagen</h1>
      <p className="text-sm mb-6" style={{ color: '#8b8ec0' }}>
        Subi una foto de un ticket, factura o recibo y Claude Vision extraera los datos automaticamente.
      </p>
      <OcrUploader
        categories={categories ?? []}
        accounts={accounts ?? []}
        businesses={businesses ?? []}
      />
    </div>
  )
}
