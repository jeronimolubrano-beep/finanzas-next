'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, PlusCircle, List,
  BarChart3, FileText, Settings, Tag, DollarSign, Menu, X, Camera,
  type LucideIcon
} from 'lucide-react'

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

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

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
          </div>
        )}
      </div>
    </nav>
  )
}
