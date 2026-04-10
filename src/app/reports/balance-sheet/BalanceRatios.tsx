import { BalanceRatios as BalanceRatiosType } from '@/lib/types'

interface Props {
  ratios: BalanceRatiosType
}

export function BalanceRatios({ ratios }: Props) {
  const C_NAVY = '#06083f'
  const C_MUTED = '#8b8ec0'
  const C_POS = '#059669'
  const C_NEG = '#dc2626'
  const C_WARN = '#f59e0b'

  // Determine color based on ratio health
  function getRatioColor(metric: string): string {
    switch (metric) {
      case 'currentRatio':
        if (ratios.currentRatio >= 1.5) return C_POS
        if (ratios.currentRatio >= 1) return C_WARN
        return C_NEG

      case 'debtToEquity':
        if (ratios.debtToEquity <= 1) return C_POS
        if (ratios.debtToEquity <= 2) return C_WARN
        return C_NEG

      case 'roe':
        if (ratios.roe >= 0.15) return C_POS
        if (ratios.roe >= 0) return C_WARN
        return C_NEG

      case 'debtRatio':
        if (ratios.debtRatio <= 0.5) return C_POS
        if (ratios.debtRatio <= 0.7) return C_WARN
        return C_NEG

      default:
        return C_MUTED
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'healthy':
        return '✓ Saludable'
      case 'caution':
        return '⚠ Precaución'
      case 'risk':
        return '✗ Riesgo'
      default:
        return 'Desconocido'
    }
  }

  const ratioItems = [
    {
      label: 'Ratio de Liquidez',
      metric: 'currentRatio',
      value: ratios.currentRatio.toFixed(2),
      format: 'x',
      range: '> 1.5 = Saludable',
      description: 'Activos Corrientes / Pasivos Corrientes',
      color: getRatioColor('currentRatio'),
    },
    {
      label: 'Deuda / Patrimonio',
      metric: 'debtToEquity',
      value: ratios.debtToEquity.toFixed(2),
      format: 'x',
      range: '< 1 = Saludable',
      description: 'Pasivos Totales / Patrimonio',
      color: getRatioColor('debtToEquity'),
    },
    {
      label: 'Retorno sobre Patrimonio (ROE)',
      metric: 'roe',
      value: (ratios.roe * 100).toFixed(1),
      format: '%',
      range: '> 15% = Excelente',
      description: 'Net Income / Patrimonio',
      color: getRatioColor('roe'),
    },
    {
      label: 'Ratio de Endeudamiento',
      metric: 'debtRatio',
      value: (ratios.debtRatio * 100).toFixed(1),
      format: '%',
      range: '< 50% = Saludable',
      description: 'Pasivos Totales / Activos Totales',
      color: getRatioColor('debtRatio'),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div
        className="rounded-xl border px-5 py-4"
        style={{
          borderColor: ratios.status === 'healthy' ? '#d1fae5' : ratios.status === 'caution' ? '#fef3c7' : '#fee2e2',
          background: ratios.status === 'healthy' ? '#f0fdf4' : ratios.status === 'caution' ? '#fffbeb' : '#fef2f2',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold" style={{ color: getRatioColor('status') }}>
            {ratios.status === 'healthy' ? '✓' : ratios.status === 'caution' ? '⚠' : '✗'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: C_NAVY }}>
              Estado Financiero General: {getStatusLabel(ratios.status)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>
              Evaluación basada en ratios de liquidez, endeudamiento y rentabilidad
            </p>
          </div>
        </div>
      </div>

      {/* Ratios grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ratioItems.map(({ label, metric, value, format, range, description, color }) => (
          <div
            key={metric}
            className="rounded-xl border bg-white p-4 hover:shadow-sm transition"
            style={{ borderColor: '#e8e8f0', borderLeft: `3px solid ${color}` }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: C_MUTED }}>
              {label}
            </p>
            <p className="text-xl font-bold tabular-nums" style={{ color }}>
              {value}{format}
            </p>
            <p className="text-xs mt-1" style={{ color: '#b0b4d0' }}>
              {description}
            </p>
            <p className="text-xs mt-1" style={{ color: C_MUTED }}>
              Saludable: {range}
            </p>
          </div>
        ))}
      </div>

      {/* Interpretation guide */}
      <div className="rounded-xl border px-5 py-4 bg-white" style={{ borderColor: '#e8e8f0' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: C_NAVY }}>
          Interpretación de Ratios
        </h3>
        <ul className="text-xs space-y-1" style={{ color: C_MUTED }}>
          <li>
            <strong>Ratio de Liquidez:</strong> Capacidad de pagar deudas corto plazo. {'>'} 1 significa suficientes activos.
          </li>
          <li>
            <strong>Deuda/Patrimonio:</strong> Proporción de financiamiento externo vs propio. Bajo indica menor dependencia.
          </li>
          <li>
            <strong>ROE:</strong> Cuánta ganancia genera cada peso de patrimonio. Mayor es mejor.
          </li>
          <li>
            <strong>Ratio de Endeudamiento:</strong> Qué porcentaje de activos están financiados con deuda. Menor es mejor.
          </li>
        </ul>
      </div>
    </div>
  )
}
