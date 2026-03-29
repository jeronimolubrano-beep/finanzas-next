import Link from 'next/link'
import {
  LayoutDashboard, PlusCircle, List, BarChart3, FileText
} from 'lucide-react'

const quickLinks = [
  { href: '/transactions/add', label: 'Agregar transaccion', icon: PlusCircle, color: 'bg-blue-500' },
  { href: '/transactions', label: 'Ver transacciones', icon: List, color: 'bg-gray-600' },
  { href: '/dashboard', label: 'Dashboard KPI', icon: LayoutDashboard, color: 'bg-purple-500' },
  { href: '/reports/cash-flow', label: 'Cash Flow', icon: BarChart3, color: 'bg-green-500' },
  { href: '/reports/income-statement', label: 'Estado de Resultados', icon: FileText, color: 'bg-yellow-500' },
]

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto text-center py-12">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">Finanzas Familiares</h1>
      <p className="text-gray-500 mb-10">
        Sistema de gestion financiera — Sadia, Nancul, IBC, EML
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className={`p-2 rounded-lg text-white ${link.color}`}>
              <link.icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-700">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
