// Tipos para la API de InvertirOnline (IOL) y portfolio

// ─── IOL API Responses ───────────────────────────────────────────────────────

export interface IOLToken {
  access_token: string
  token_type: string
  expires_in: number // seconds (typically 900 = 15 min)
  refresh_token: string
  '.issued': string
  '.expires': string
}

export interface IOLPosition {
  simbolo: string
  descripcion: string
  cantidad: number
  puntosVariacion: number
  variacionDiaria: number
  ultimoPrecio: number
  ppc: number // precio promedio de compra
  gananciaPorcentaje: number
  gananciaDinero: number
  valorizado: number
  titulo: {
    simbolo: string
    descripcion: string
    tipo: string
    moneda: string
    mercado: string
  }
}

export interface IOLOperacion {
  numero: number
  fechaOrden: string
  tipo: string // 'Compra' | 'Venta'
  estado: string
  mercado: string
  simbolo: string
  cantidad: number
  monto: number
  cantidadOperada: number
  precioOperado: number
  montoOperado: number
  precio: number
}

export interface IOLEstadoCuenta {
  cuentas: {
    numero: string
    tipo: string
    moneda: string
    disponible: number
    comprometido: number
    saldo: number
    titulosValorizados: number
    total: number
  }[]
}

// ─── Domain Types (processed) ────────────────────────────────────────────────

export interface PortfolioPosition {
  simbolo: string
  descripcion: string
  tipo: string // acciones, cedears, bonos, fci, etc.
  moneda: string
  mercado: string
  cantidad: number
  ppc: number // precio promedio compra
  precioActual: number
  variacionDiaria: number
  valorizadoARS: number
  plARS: number
  plPercent: number
  // USD conversion (historical dollar)
  dolarCompra: number | null // weighted avg dollar at buy dates
  costoUSD: number | null
  valorActualUSD: number | null
  plUSD: number | null
}

export interface PositionGroup {
  tipo: string
  label: string
  positions: PortfolioPosition[]
  subtotalARS: number
  subtotalCostoARS: number
  subtotalPL: number
  subtotalPLPercent: number
  subtotalUSD: number | null
  subtotalPLUSD: number | null
}

export interface PortfolioKPISummary {
  totalValueARS: number
  totalCostARS: number
  totalValueUSD: number | null
  totalCostUSD: number | null
  plTotalARS: number
  plTotalUSD: number | null
  plPercent: number
  dolarAtStart: number | null
  dolarNow: number | null
  rendimientoVsDolar: number | null
}

export interface PortfolioHistoryPoint {
  date: string
  totalValue: number
}

// Type label mapping
export const TIPO_LABELS: Record<string, string> = {
  acciones: 'Acciones',
  cedears: 'CEDEARs',
  bonos: 'Bonos',
  fci: 'FCI',
  letras: 'Letras',
  on: 'Obligaciones Negociables',
  opciones: 'Opciones',
  cauciones: 'Cauciones',
  otros: 'Otros',
}
