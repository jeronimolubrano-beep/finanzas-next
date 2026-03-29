'use client'

import { Trash2 } from 'lucide-react'
import { deleteCategory } from './actions'

export function DeleteCategoryButton({ id, hasTransactions }: { id: number; hasTransactions: boolean }) {
  async function handleDelete() {
    if (hasTransactions) {
      alert('No se puede eliminar una categoria que tiene transacciones asociadas.')
      return
    }
    if (!confirm('¿Eliminar esta categoria?')) return

    try {
      await deleteCategory(id)
    } catch (e) {
      alert('Error al eliminar: ' + (e as Error).message)
    }
  }

  return (
    <button
      onClick={handleDelete}
      className={`p-1 transition ${hasTransactions ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
      title={hasTransactions ? 'No se puede eliminar (tiene transacciones)' : 'Eliminar'}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
