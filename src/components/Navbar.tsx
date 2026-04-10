'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, PlusCircle, List,
  BarChart3, FileText, Settings, Tag, DollarSign, Menu, X, Camera, FileUp,
  Bell, Clock, AlertTriangle, LogOut, Sparkles,
  type LucideIcon
} from 'lucide-react'
import { formatMoney, formatDateShort } from '@/lib/utils'
import { logoutAction } from '@/app/login/logout'

type NavLink = { href: string; label: string; icon: LucideIcon }
type NavDropdown = { label: string; icon: LucideIcon; children: NavLink[] }
type NavItem = NavLink | NavDropdown

function isLink(item: NavItem): item is NavLink {
  return 'href' in item
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ai', label: 'Consultas IA', icon: Sparkles },
  {
    label: 'Transacciones',
    icon: ArrowLeftRight,
    children: [
      { href: '/transactions/add', label: 'Agregar manual', icon: PlusCircle },
      { href: '/transactions/ocr', label: 'Cargar desde imagen', icon: Camera },
      { href: '/transactions', label: 'Ver todas', icon: List },
      { href: '/transactions/pending', label: 'Pagos pendientes', icon: Clock },
      { href: '/import', label: 'Importar datos', icon: FileUp },
    ],
  },
  {
    label: 'Reportes',
    icon: BarChart3,
    children: [
      { href: '/reports/cash-flow', label: 'Flujo de Caja', icon: DollarSign },
      { href: '/reports/income-statement', label: 'Estado de Resultados', icon: FileText },
      { href: '/reports/balance-sheet', label: 'Estado de Situación Patrimonial', icon: FileText },
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

const authPages = ['/login', '/forgot-password', '/reset-password']

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [bellOpen, setBellOpen] = useState(false)
  const [urgentCount, setUrgentCount] = useState(0)
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([])
  const bellRef = useRef<HTMLDivElement>(null)

  // Hide navbar on auth pages
  if (authPages.includes(pathname)) return null

  useEffect(() => {
    fetch('/api/pending-count')
      .then(r => r.json())
      .then(data => {
        setUrgentCount(data.urgentCount ?? 0)
        setUrgentItems(data.items ?? [])
      })
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick() { setOpenDropdown(null) }
    if (openDropdown) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [openDropdown])

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: '#06083f', borderColor: '#1a1d5e' }}>
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Grupo Lubrano" style={{ width: '32px', height: '32px' }} />
            <span className="tracking-tight text-white font-bold text-lg hidden sm:inline">Grupo Lubrano</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) =>
              isLink(item) ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname === item.href
                      ? 'text-white'
                      : 'text-[#8b8ec0] hover:text-white'
                  }`}
                  style={pathname === item.href ? { background: 'rgba(100,57,255,0.25)' } : {}}
                >
                  <item.icon className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  {item.label}
                </Link>
              ) : (
                <div key={item.label} className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdown(openDropdown === item.label ? null : item.label)
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-[#8b8ec0] hover:text-white transition-all"
                  >
                    <item.icon className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                    {item.label}
                    <span className="ml-1 text-[10px] opacity-60">&#9662;</span>
                  </button>
                  {openDropdown === item.label && (
                    <div className="absolute top-full left-0 mt-1.5 rounded-xl shadow-2xl py-1.5 min-w-[220px] z-50 border"
                         style={{ background: '#232a5c', borderColor: '#333b72' }}>
                      {item.children?.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenDropdown(null)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all ${
                            pathname === child.href
                              ? 'text-white'
                              : 'text-[#8b8ec0] hover:text-white hover:bg-white/5'
                          }`}
                          style={pathname === child.href ? { background: 'rgba(100,57,255,0.2)' } : {}}
                        >
                          <child.icon className="w-4 h-4" />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* Logout Button */}
            <form action={logoutAction} className="ml-2">
              <button
                type="submit"
                className="p-2 rounded-lg text-[#8b8ec0] hover:text-white transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>

            {/* Bell */}
            <div className="relative ml-2" ref={bellRef}>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="relative p-2 rounded-lg text-[#8b8ec0] hover:text-white transition-all"
              >
                <Bell className="w-4 h-4" />
                {urgentCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                        style={{ background: '#fe4962' }}>
                    {urgentCount > 9 ? '9+' : urgentCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute top-full right-0 mt-1.5 rounded-xl shadow-2xl w-[calc(100vw-2rem)] sm:w-80 z-50 border overflow-hidden"
                     style={{ background: '#232a5c', borderColor: '#333b72' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: '#333b72' }}>
                    <p className="font-semibold text-sm text-white">Pagos urgentes</p>
                  </div>
                  {urgentItems.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[#5b5c8c]">
                      Sin pagos urgentes
                    </div>
                  ) : (
                    <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: '#333b72' }}>
                      {urgentItems.map(item => (
                        <Link
                          key={item.id}
                          href="/transactions/pending"
                          onClick={() => setBellOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition"
                        >
                          {item.overdue
                            ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fe4962' }} />
                            : <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.description}</p>
                            <p className="text-xs text-[#5b5c8c]">
                              {item.overdue ? 'Vencido' : 'Vence'} {formatDateShort(item.due_date)}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold shrink-0 ${item.type === 'income' ? 'text-[#2edbc1]' : 'text-[#fe4962]'}`}>
                            {item.type === 'income' ? '+' : '-'}${formatMoney(Number(item.amount))}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-2.5 border-t" style={{ borderColor: '#333b72' }}>
                    <Link href="/transactions/pending" onClick={() => setBellOpen(false)}
                          className="text-xs font-medium" style={{ color: '#6439ff' }}>
                      Ver todos los pendientes →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 text-white" onClick={() => setMobileOpen(!mobileOpen)}>
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
                  className="block px-3 py-2.5 rounded-lg text-sm text-[#8b8ec0] hover:text-white hover:bg-white/5"
                >
                  <item.icon className="w-4 h-4 inline mr-2" />
                  {item.label}
                </Link>
              ) : (
                <div key={item.label}>
                  <div className="px-3 py-2 text-xs font-bold text-[#5b5c8c] uppercase tracking-wider">
                    {item.label}
                  </div>
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-6 py-2.5 rounded-lg text-sm text-[#8b8ec0] hover:text-white hover:bg-white/5"
                    >
                      <child.icon className="w-4 h-4 inline mr-2" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )
            )}
            <Link href="/transactions/pending" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[#8b8ec0] hover:text-white hover:bg-white/5">
              <Bell className="w-4 h-4" />
              Pagos urgentes
              {urgentCount > 0 && (
                <span className="text-white text-xs font-bold rounded-full px-1.5 py-0.5" style={{ background: '#fe4962' }}>
                  {urgentCount}
                </span>
              )}
            </Link>
            <form action={logoutAction} className="px-3 py-2.5">
              <button
                type="submit"
                className="w-full text-left flex items-center gap-2 rounded-lg text-sm text-[#8b8ec0] hover:text-white hover:bg-white/5 px-0 py-1"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
    </nav>
  )
}
