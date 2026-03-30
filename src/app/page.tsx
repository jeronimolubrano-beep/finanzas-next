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
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Grupo Lubrano" style={{ width: '280px', height: 'auto', objectFit: 'contain' }} />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--navy)' }}>
          Grupo Lubrano
        </h1>
        <p className="text-lg" style={{ color: '#8b8ec0' }}>
          Sadia · Ñancul · IBC · EML
        </p>
      </div>

      {/* Resumen del mes */}
      <div className="rounded-2xl shadow-sm border p-6 mb-8" style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#8b8ec0' }}>
            {monthNames[now.getMonth()]} {now.getFullYear()}
          </h2>
          <Link href="/dashboard" className="text-xs font-medium flex items-center gap-1 hover:opacity-80 transition" style={{ color: '#6439ff' }}>
            Ver dashboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1" style={{ color: '#8b8ec0' }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#2edbc1' }} />
              Ingresos
            </div>
            <p className="text-2xl font-bold" style={{ color: '#2edbc1' }}>${formatMoney0(monthIncome)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm mb-1" style={{ color: '#8b8ec0' }}>
              <TrendingDown className="w-4 h-4" style={{ color: '#fe4962' }} />
              Gastos
            </div>
            <p className="text-2xl font-bold" style={{ color: '#fe4962' }}>${formatMoney0(monthExpense)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm mb-1" style={{ color: '#8b8ec0' }}>
              <DollarSign className="w-4 h-4" style={{ color: '#6439ff' }} />
              Flujo neto
            </div>
            <p className="text-2xl font-bold" style={{ color: monthNet >= 0 ? '#2edbc1' : '#fe4962' }}>
              {monthNet >= 0 ? '+' : ''}${formatMoney0(monthNet)}
            </p>
          </div>
        </div>
        {(totalTxs ?? 0) > 0 && (
          <p className="text-xs mt-4 pt-3" style={{ color: '#5b5c8c', borderTop: '1px solid var(--dash-border)' }}>
            {totalTxs} transacciones registradas en total
          </p>
        )}
      </div>

      {/* Acciones rapidas */}
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#8b8ec0' }}>
        Acciones rapidas
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Link href="/transactions/add"
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border transition-all hover:scale-[1.02]"
              style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="p-3 rounded-xl transition" style={{ background: 'rgba(100,57,255,0.1)', color: '#6439ff' }}>
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Agregar manual</span>
        </Link>

        <Link href="/transactions/ocr"
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border transition-all hover:scale-[1.02]"
              style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="p-3 rounded-xl transition" style={{ background: 'rgba(139,111,255,0.1)', color: '#8b6fff' }}>
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Escanear ticket</span>
        </Link>

        <Link href="/transactions"
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border transition-all hover:scale-[1.02]"
              style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="p-3 rounded-xl transition" style={{ background: 'rgba(46,219,193,0.1)', color: '#2edbc1' }}>
            <List className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Transacciones</span>
        </Link>

        <Link href="/dashboard"
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border transition-all hover:scale-[1.02]"
              style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
          <div className="p-3 rounded-xl transition" style={{ background: 'rgba(100,57,255,0.1)', color: '#6439ff' }}>
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Dashboard</span>
        </Link>
      </div>

      {/* Reportes y Config */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#8b8ec0' }}>
            Reportes
          </h2>
          <div className="space-y-2">
            <Link href="/reports/cash-flow"
                  className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(46,219,193,0.1)', color: '#2edbc1' }}>
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-sm" style={{ color: 'var(--navy)' }}>Cash Flow</span>
                <p className="text-xs" style={{ color: '#8b8ec0' }}>Flujo de caja mensual percibido vs devengado</p>
              </div>
            </Link>
            <Link href="/reports/income-statement"
                  className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-sm" style={{ color: 'var(--navy)' }}>Estado de Resultados</span>
                <p className="text-xs" style={{ color: '#8b8ec0' }}>Tabla anual de ingresos, gastos y tasa de ahorro</p>
              </div>
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#8b8ec0' }}>
            Configuracion
          </h2>
          <div className="space-y-2">
            <Link href="/categories"
                  className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(100,57,255,0.1)', color: '#6439ff' }}>
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-sm" style={{ color: 'var(--navy)' }}>Categorias</span>
                <p className="text-xs" style={{ color: '#8b8ec0' }}>Administrar categorias de ingresos y gastos</p>
              </div>
            </Link>
            <Link href="/settings"
                  className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-sm" style={{ color: 'var(--navy)' }}>Tipo de Cambio</span>
                <p className="text-xs" style={{ color: '#8b8ec0' }}>Configurar cotizacion ARS/USD</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
