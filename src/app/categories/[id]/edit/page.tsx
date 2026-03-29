import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateCategory } from '../../actions'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('id', parseInt(id))
    .single()

  if (!category) notFound()

  const updateWithId = updateCategory.bind(null, category.id)

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Editar Categoria</h1>

      <form action={updateWithId} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" required maxLength={100}
                 defaultValue={category.name}
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select name="type" required defaultValue={category.type}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Save className="w-4 h-4" />
            Guardar
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
