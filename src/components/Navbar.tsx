'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, PlusCircle, List,
  BarChart3, FileText, Settings, Tag, DollarSign, Menu, X, Camera,
  Bell, Clock, AlertTriangle,
  type LucideIcon
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'

type NavLink = { href: string; label: string; icon: LucideIcon }
type NavDropdown = { label: string; icon: LucideIcon; children: NavLink[] }
type NavItem = NavLink | NavDropdown

function isLink(item: NavItem): item is NavLink {
  return 'href' in item
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Transacciones',
    icon: ArrowLeftRight,
    children: [
      { href: '/transactions/add', label: 'Agregar manual', icon: PlusCircle },
      { href: '/transactions/ocr', label: 'Cargar desde imagen', icon: Camera },
      { href: '/transactions', label: 'Ver todas', icon: List },
      { href: '/transactions/pending', label: 'Pagos pendientes', icon: Clock },
    ],
  },
  {
    label: 'Reportes',
    icon: BarChart3,
    children: [
      { href: '/reports/cash-flow', label: 'Cash Flow', icon: DollarSign },
      { href: '/reports/income-statement', label: 'Estado de Resultados', icon: FileText },
    ],
  },
  {
    label: 'Configuracion',
    icon: Settings,
    children: [
      { href: '/categories', label: 'Categorias', icon: Tag },
      { href: '/settings', label: 'Tipo de Cambio', icon: DollarSign },
    ],
  },
]

interface UrgentItem {
  id: number
  description: string
  amount: number
  type: string
  due_date: string
  overdue: boolean
}

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [bellOpen, setBellOpen] = useState(false)
  const [urgentCount, setUrgentCount] = useState(0)
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([])
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/pending-count')
      .then(r => r.json())
      .then(data => {
        setUrgentCount(data.urgentCount ?? 0)
        setUrgentItems(data.items ?? [])
      })
      .catch(() => {})
  }, [pathname])

  // Cerrar bell dropdown al clickear afuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-800">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Finanzas Familiares
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) =>
              isLink(item) ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4 inline mr-1" />
                  {item.label}
                </Link>
              ) : (
                <div key={item.label} className="relative">
                  <button
                    onClick={() =>
                      setOpenDropdown(openDropdown === item.label ? null : item.label)
                    }
                    className="px-3 py-2 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <item.icon className="w-4 h-4 inline mr-1" />
                    {item.label}
                    <span className="ml-1 text-xs">&#9662;</span>
                  </button>
                  {openDropdown === item.label && (
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                      {item.children?.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenDropdown(null)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            pathname === child.href
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <child.icon className="w-4 h-4 inline mr-2" />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* Bell de alertas */}
            <div className="relative ml-1" ref={bellRef}>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="relative p-2 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                title="Pagos urgentes"
              >
                <Bell className="w-4 h-4" />
                {urgentCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {urgentCount > 9 ? '9+' : urgentCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-xl w-80 z-50">
                  <div className="px-4 py-3 border-b">
                    <p className="font-semibold text-sm text-gray-700">Pagos urgentes</p>
                  </div>
                  {urgentItems.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      Sin pagos urgentes
                    </div>
                  ) : (
                    <div className="divide-y max-h-72 overflow-y-auto">
                      {urgentItems.map(item => (
                        <Link
                          key={item.id}
                          href="/transactions/pending"
                          onClick={() => setBellOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                        >
                          {item.overdue
                            ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            : <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.description}</p>
                            <p className="text-xs text-gray-400">
                              {item.overdue ? 'Vencido' : 'Vence'} {item.due_date.slice(5).replace('-', '/')}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold shrink-0 ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.type === 'income' ? '+' : '-'}${formatMoney(Number(item.amount))}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-2 border-t">
                    <Link href="/transactions/pending" onClick={() => setBellOpen(false)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Ver todos los pendientes →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navItems.map((item) =>
              isLink(item) ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
                >
                  <item.icon className="w-4 h-4 inline mr-2" />
                  {item.label}
                </Link>
              ) : (
                <div key={item.label}>
                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase">
                    {item.label}
                  </div>
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-6 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
                    >
                      <child.icon className="w-4 h-4 inline mr-2" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )
            )}
            {/* Mobile: link a pendientes con badge */}
            <Link href="/transactions/pending" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100">
              <Bell className="w-4 h-4" />
              Pagos urgentes
              {urgentCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
                  {urgentCount}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
