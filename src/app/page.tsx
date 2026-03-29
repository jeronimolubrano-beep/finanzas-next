import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatMoney0 } from '@/lib/utils'
import {
  LayoutDashboard, PlusCircle, List, BarChart3, FileText,
  Camera, Tag, DollarSign, TrendingUp, TrendingDown, ArrowRight
} from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  // Obtener resumen rapido
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: monthTxs } = await supabase
    .from('transactions')
    .select('type, amount')
    .gte('date', monthStart)

  const monthIncome = (monthTxs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = (monthTxs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const monthNet = monthIncome - monthExpense

  const { count: totalTxs } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  return (
    <div className="max-w-5xl mx-auto py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white mb-4 shadow-lg">
          <DollarSign className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
          Finanzas Familiares
        </h1>
        <p className="text-gray-400 text-lg">
          Sadia · Ñancul · IBC · EML
        </p>
      </div>

      {/* Resumen del mes */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {monthNames[now.getMonth()]} {now.getFullYear()}
          </h2>
          <Link href="/dashboard" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
            Ver dashboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Ingresos
            </div>
            <p className="text-2xl font-bold text-green-600">${formatMoney0(monthIncome)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Gastos
            </div>
            <p className="text-2xl font-bold text-red-500">${formatMoney0(monthExpense)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <DollarSign className="w-4 h-4 text-blue-500" />
              Flujo neto
            </div>
            <p className={`text-2xl font-bold ${monthNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {monthNet >= 0 ? '+' : ''}${formatMoney0(monthNet)}
            </p>
          </div>
        </div>
        {(totalTxs ?? 0) > 0 && (
          <p className="text-xs text-gray-300 mt-4 pt-3 border-t">
            {totalTxs} transacciones registradas en total
          </p>
        )}
      </div>

      {/* Acciones rapidas */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Acciones rapidas
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Link href="/transactions/add"
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Agregar manual</span>
        </Link>

        <Link href="/transactions/ocr"
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-xl shadow-sm border hover:border-purple-300 hover:shadow-md transition-all">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Escanear ticket</span>
        </Link>

        <Link href="/transactions"
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-xl shadow-sm border hover:border-gray-400 hover:shadow-md transition-all">
          <div className="p-3 rounded-xl bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition">
            <List className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Transacciones</span>
        </Link>

        <Link href="/dashboard"
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-xl shadow-sm border hover:border-green-300 hover:shadow-md transition-all">
          <div className="p-3 rounded-xl bg-green-50 text-green-600 group-hover:bg-green-100 transition">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Dashboard</span>
        </Link>
      </div>

      {/* Reportes y Config */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Reportes
          </h2>
          <div className="space-y-2">
            <Link href="/reports/cash-flow"
                  className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border hover:border-green-300 hover:shadow-md transition-all">
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-gray-700 text-sm">Cash Flow</span>
                <p className="text-xs text-gray-400">Flujo de caja mensual percibido vs devengado</p>
              </div>
            </Link>
            <Link href="/reports/income-statement"
                  className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border hover:border-yellow-300 hover:shadow-md transition-all">
              <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-gray-700 text-sm">Estado de Resultados</span>
                <p className="text-xs text-gray-400">Tabla anual de ingresos, gastos y tasa de ahorro</p>
              </div>
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Configuracion
          </h2>
          <div className="space-y-2">
            <Link href="/categories"
                  className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-gray-700 text-sm">Categorias</span>
                <p className="text-xs text-gray-400">Administrar categorias de ingresos y gastos</p>
              </div>
            </Link>
            <Link href="/settings"
                  className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border hover:border-orange-300 hover:shadow-md transition-all">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-gray-700 text-sm">Tipo de Cambio</span>
                <p className="text-xs text-gray-400">Configurar cotizacion ARS/USD</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
