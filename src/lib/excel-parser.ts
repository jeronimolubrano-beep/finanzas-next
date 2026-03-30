// Parser de archivos Excel de Cashflow mensual
// Basado en ESPECIFICACION_FINANZAS_FAMILIARES.md §2, §7, §8

import * as XLSX from 'xlsx'
import { categorizeByDescription, shouldSkipRow } from './categorizer'

export interface ParsedTransaction {
  id: string // temp id para UI
  selected: boolean
  date: string // YYYY-MM-DD
  description: string
  notes: string
  type: 'income' | 'expense'
  amount: number
  businessId: number
  businessName: string
  categoryName: string | null
  expenseType: 'ordinario' | 'extraordinario'
  currency: 'ARS' | 'USD'
  exchangeRate: number | null
}

// Mapeo de columnas por entidad (0-indexed)
// E=4, F=5, G=6 → EML (business_id=4)
// H=7, I=8, J=9 → SADIA (business_id=1)
// K=10, L=11, M=12 → ÑANCUL (business_id=2)
// N=13, O=14, P=15 → IBC (business_id=3)
const ENTITY_COLUMNS = [
  { debeCol: 4, haberCol: 5, businessId: 4, businessName: 'EML' },
  { debeCol: 7, haberCol: 8, businessId: 1, businessName: 'SADIA' },
  { debeCol: 10, haberCol: 11, businessId: 2, businessName: 'ÑANCUL' },
  { debeCol: 13, haberCol: 14, businessId: 3, businessName: 'IBC' },
]

// Filas especiales a partir de las cuales empiezan las transacciones
const DATA_START_ROW = 9 // fila 10 en Excel (0-indexed = 9)

/**
 * Convierte un valor numérico de Excel a number
 * Maneja tanto números ya parseados como strings con formato argentino
 */
function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Math.abs(value)

  const str = String(value).trim()
  if (str === '' || str === '-') return 0

  // Formato argentino: 1.234.567,89 → remove dots, replace comma with dot
  let cleaned = str.replace(/\$/g, '').trim()

  // Detect if using Argentine format (dots as thousands, comma as decimal)
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.abs(num)
}

/**
 * Convierte un valor de fecha de Excel a string YYYY-MM-DD
 */
function parseExcelDate(value: unknown, period: string): string {
  if (!value) return ''

  // Si ya es string con formato fecha
  if (typeof value === 'string') {
    const str = value.trim()
    // Formato DD/MM/YYYY
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
    if (match) {
      const day = match[1].padStart(2, '0')
      const month = match[2].padStart(2, '0')
      let year = match[3]
      if (year.length === 2) year = '20' + year
      return `${year}-${month}-${day}`
    }
    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
    return ''
  }

  // Número serial de Excel (días desde 1899-12-30)
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        const y = String(date.y)
        const m = String(date.m).padStart(2, '0')
        const d = String(date.d).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    } catch {
      // fallback
    }
  }

  return ''
}

/**
 * Detecta si una transacción es en USD basándose en el concepto o info adicional
 */
function detectUSD(description: string, notes: string): boolean {
  const combined = `${description} ${notes}`.toUpperCase()
  return combined.includes('USD') || combined.includes('DOLAR') || combined.includes('U$S')
}

/**
 * Parsea un archivo Excel de cashflow y retorna transacciones estructuradas
 */
export function parseExcelCashflow(
  workbook: XLSX.WorkBook,
  period: string, // YYYY-MM
  exchangeRate: number
): ParsedTransaction[] {
  // Buscar la hoja CASHFLOW (probar varios nombres)
  const sheetName = workbook.SheetNames.find(
    name => name.toUpperCase().includes('CASHFLOW') || name.toUpperCase().includes('CASH FLOW')
  ) || workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  // Convertir a array de arrays (raw data)
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  })

  const transactions: ParsedTransaction[] = []
  let lastDate = `${period}-01` // fallback date
  let txCounter = 0

  for (let rowIdx = DATA_START_ROW; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx]
    if (!row || row.length < 3) continue

    const concept = row[1] ? String(row[1]).trim() : ''

    // Skip filas especiales o vacías
    if (shouldSkipRow(concept)) continue

    // Parsear fecha (columna A)
    const dateStr = parseExcelDate(row[0], period)
    if (dateStr) lastDate = dateStr

    // Info adicional para notes
    const fpago = row[2] ? String(row[2]).trim() : ''
    const infoAdic = row[3] ? String(row[3]).trim() : ''
    const notes = [fpago, infoAdic].filter(Boolean).join(' | ')

    // Para cada entidad, verificar si hay monto en Debe o Haber
    for (const entity of ENTITY_COLUMNS) {
      const debeVal = parseAmount(row[entity.debeCol])
      const haberVal = parseAmount(row[entity.haberCol])

      // Si hay valor en Debe → ingreso
      if (debeVal > 0) {
        txCounter++
        const isUSD = detectUSD(concept, notes)
        const catMatch = categorizeByDescription(concept, 'income')

        transactions.push({
          id: `tx-${txCounter}`,
          selected: true,
          date: lastDate,
          description: concept,
          notes,
          type: 'income',
          amount: debeVal,
          businessId: entity.businessId,
          businessName: entity.businessName,
          categoryName: catMatch?.categoryName ?? null,
          expenseType: 'ordinario',
          currency: isUSD ? 'USD' : 'ARS',
          exchangeRate: isUSD ? exchangeRate : null,
        })
      }

      // Si hay valor en Haber → egreso
      if (haberVal > 0) {
        txCounter++
        const isUSD = detectUSD(concept, notes)
        const catMatch = categorizeByDescription(concept, 'expense')

        transactions.push({
          id: `tx-${txCounter}`,
          selected: true,
          date: lastDate,
          description: concept,
          notes,
          type: 'expense',
          amount: haberVal,
          businessId: entity.businessId,
          businessName: entity.businessName,
          categoryName: catMatch?.categoryName ?? null,
          expenseType: catMatch?.expenseType ?? 'ordinario',
          currency: isUSD ? 'USD' : 'ARS',
          exchangeRate: isUSD ? exchangeRate : null,
        })
      }
    }
  }

  return transactions
}
