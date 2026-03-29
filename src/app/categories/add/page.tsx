import { addCategory } from '../actions'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AddCategoryPage() {
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Nueva Categoria</h1>

      <form action={addCategory} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" required maxLength={100}
                 placeholder="Ej: Servicios profesionales"
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select name="type" required className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Save className="w-4 h-4" />
            Crear
          </button>
          <Link href="/categories"
                className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </div>
      </form>
    </div>
  )
}
