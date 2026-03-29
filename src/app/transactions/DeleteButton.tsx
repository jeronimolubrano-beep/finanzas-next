'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export function DeleteButton({ id }: { id: number }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    if (!confirm('Eliminar esta transaccion?')) return

    const { error } = await supabase.from('transactions').delete().eq('id', id)

    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Transaccion eliminada')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="p-1 text-gray-400 hover:text-red-600 transition"
      title="Eliminar"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
