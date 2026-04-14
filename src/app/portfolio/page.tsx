'use client'

import { useState } from 'react'
import { LogOut, RefreshCw, Loader2 } from 'lucide-react'
import { useIOLAuth } from './hooks/useIOLAuth'
import { usePortfolioData } from './hooks/usePortfolioData'
import { IOLLoginModal } from './components/IOLLoginModal'
import { PortfolioKPIs } from './components/PortfolioKPIs'
import { PositionsTable } from './components/PositionsTable'
import { PortfolioChart } from './components/PortfolioChart'
import { PortfolioPerformanceChart } from './components/PortfolioPerformanceChart'
import { TickerDetailModal } from './components/TickerDetailModal'
import type { PortfolioPosition } from '@/lib/iol-types'

export default function PortfolioPage() {
  const { isAuthenticated, isLoading: authLoading, error: authError, login, logout } = useIOLAuth()
  const { groups, kpis, isLoading: dataLoading, error: dataError, refetch, getOperaciones } =
    usePortfolioData(isAuthenticated)
  const [selectedTicker, setSelectedTicker] = useState<PortfolioPosition | null>(null)

  const allPositions = groups.flatMap(g => g.positions)

  // Auth loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-2" style={{ color: '#8b8ec0' }}>
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Verificando sesión...</span>
      </div>
    )
  }

  // Not authenticated → login modal
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 max-w-7xl py-8">
        <IOLLoginModal onLogin={login} isLoading={authLoading} error={authError} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 max-w-7xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#e0e4ff' }}>
            Cartera de Inversiones
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#8b8ec0' }}>
            Datos en vivo desde InvertirOnline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={dataLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition hover:bg-white/10 disabled:opacity-50"
            style={{ color: '#8b8ec0', border: '1px solid #333b72' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition hover:bg-white/10"
            style={{ color: '#8b8ec0', border: '1px solid #333b72' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Desconectar IOL
          </button>
        </div>
      </div>

      {/* Error */}
      {dataError && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center justify-between"
          style={{
            background: 'rgba(254,73,98,0.1)',
            color: '#fe4962',
            border: '1px solid rgba(254,73,98,0.2)',
          }}
        >
          <span>{dataError}</span>
          <button onClick={refetch} className="underline text-xs font-medium">
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {dataLoading && !kpis ? (
        <div className="flex items-center justify-center py-20 gap-2" style={{ color: '#8b8ec0' }}>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando portfolio...</span>
        </div>
      ) : (
        <>
          {/* KPIs */}
          {kpis && <PortfolioKPIs kpis={kpis} />}

          {/* Charts — side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PortfolioChart groups={groups} />
            <PortfolioPerformanceChart positions={allPositions} />
          </div>

          {/* Positions Table */}
          <PositionsTable groups={groups} onTickerClick={setSelectedTicker} />
        </>
      )}

      {/* Ticker Detail Modal */}
      {selectedTicker && (
        <TickerDetailModal
          position={selectedTicker}
          onClose={() => setSelectedTicker(null)}
          getOperaciones={getOperaciones}
        />
      )}
    </div>
  )
}
