// Parser de PDFs de informe mensual de Grupo Lubrano
// Extrae transacciones detalladas de las páginas 6-12 del PDF

import type { ParsedTransaction } from './excel-parser'

// Mapeo de columnas empresa → business_id
// GUEMES y PDA van a SADIA (business_id=1) por decisión del usuario
const BUSINESS_MAP: Record<string, { id: number; name: string }> = {
  'SADIA': { id: 1, name: 'SADIA' },
  'GUEMES': { id: 1, name: 'SADIA' },
  'PDA': { id: 1, name: 'SADIA' },
  'ÑANCUL': { id: 2, name: 'ÑANCUL' },
  'NANCUL': { id: 2, name: 'ÑANCUL' },
  'EML': { id: 4, name: 'EML' },
  'IBC': { id: 3, name: 'IBC' },
}

// Mapeo de sección del PDF → categoría y tipo
const SECTION_MAP: Record<string, { categoryName: string; type: 'income' | 'expense'; expenseType: 'ordinario' | 'extraordinario' }> = {
  'INGRESOS ORDINARIOS': { categoryName: '', type: 'income', expenseType: 'ordinario' },
  'PROVEEDORES': { categoryName: 'Proveedores', type: 'expense', expenseType: 'ordinario' },
  'SUELDOS': { categoryName: 'Sueldos y Cargas Sociales', type: 'expense', expenseType: 'ordinario' },
  'SERVICIOS': { categoryName: 'Servicios', type: 'expense', expenseType: 'ordinario' },
  'PLANES FINANCIACION': { categoryName: 'Planes Financiación', type: 'expense', expenseType: 'ordinario' },
  'IMPUESTOS': { categoryName: 'Impuestos', type: 'expense', expenseType: 'ordinario' },
  'SEGUROS': { categoryName: 'Seguros', type: 'expense', expenseType: 'ordinario' },
  'VARIOS': { categoryName: 'Varios', type: 'expense', expenseType: 'ordinario' },
}

// Mapeo de concepto de ingreso → categoría
const INCOME_CATEGORY_MAP: Record<string, string> = {
  'Alquileres Ministerio': 'Alquiler Ministerio',
  'Ingresos Alquileres': 'Alquiler Ministerio',
  'Recupero Gastos PDA': 'Recupero Gastos PDA',
  'Ingresos PDA': 'Recupero Gastos PDA',
  'Alquiler Guemes - TOYOTA': 'Alquiler Güemes/Toyota',
  'TOYOYA - GUEMES': 'Alquiler Güemes/Toyota',
  'Alquiler Alem - CGS Group': 'Alquiler Alem/CGS',
  'CGS GROUP': 'Alquiler Alem/CGS',
  'Alquiler Antena Caboto': 'Alquiler Antena Caboto',
  'Liq Venta Ñancul': 'Liquidación Venta Ñancul',
  'Ingresos Ñancul': 'Liquidación Venta Ñancul',
  'Alquileres Guemes': 'Alquileres Güemes Deptos',
  'Alquileres Guemes Deptos': 'Alquileres Güemes Deptos',
  'Alquileres Guemes Cocheras': 'Alquileres Güemes Cocheras',
  'Rentabilidad FCI': 'Rentabilidad FCI',
  'Intereses Bonos': 'Intereses Bonos',
  'Otros Ingresos': 'Otros ingresos',
}

/**
 * Parsea un número en formato argentino: "1.234.567" o "1.234.567,89" → number
 */
function parseArgNumber(str: string): number {
  if (!str || str.trim() === '' || str.trim() === '0') return 0
  let cleaned = str.trim().replace(/\$/g, '').replace(/\s/g, '')
  // Remove negative sign, track it
  const isNeg = cleaned.startsWith('-')
  if (isNeg) cleaned = cleaned.slice(1)
  // Argentine format: dots as thousands, comma as decimal
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // No comma: dots are thousands separators
    cleaned = cleaned.replace(/\./g, '')
  }
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0
  return isNeg ? -num : Math.abs(num)
}

/**
 * Parsea fecha DD/MM/YYYY → YYYY-MM-DD
 */
function parseDate(str: string): string {
  const match = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return ''
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Líneas que son subtotales o headers que debemos ignorar
const SKIP_PATTERNS = [
  'Subtotal', 'TOTAL', 'Total Ingresos', 'Total Gastos',
  'SALDO NETO', 'SALDO FINAL', 'PUNTO EQUILIBRIO',
  'INGRESOS EXTRAORDINARIOS', 'GASTOS EXTRAORDINARIOS',
  'GASTOS ORDINARIOS', 'INGRESOS ORDINARIOS',
]

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  return SKIP_PATTERNS.some(p => trimmed.toUpperCase().startsWith(p.toUpperCase()))
}

/**
 * Extrae las columnas de empresas de la tabla de detalle (páginas 6-8)
 * Las columnas son: CONCEPTO | SADIA | GUEMES | PDA | ÑANCUL | EML | Total
 */
function parseDetailTable(
  lines: string[],
  section: string,
  period: string,
  exchangeRate: number,
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const sectionInfo = SECTION_MAP[section]
  if (!sectionInfo) return transactions

  const date = `${period}-01` // 1er día del mes para gastos ordinarios
  const enterprises = ['SADIA', 'GUEMES', 'PDA', 'ÑANCUL', 'EML']

  for (const line of lines) {
    if (shouldSkipLine(line)) continue

    // Intentar extraer concepto y montos
    // El formato es: "Concepto    num    num    num    num    num    num"
    // Extraer todos los números de la línea
    const numbers = line.match(/[\d.]+(?:,\d+)?/g)
    if (!numbers || numbers.length === 0) continue

    // El concepto es todo lo que está antes del primer número
    const firstNumIdx = line.search(/\d/)
    if (firstNumIdx <= 0) continue
    const concept = line.slice(0, firstNumIdx).trim()
    if (!concept || concept.length < 2) continue

    // Los últimos 6 números son: SADIA, GUEMES, PDA, ÑANCUL, EML, Total
    // Pero a veces hay menos columnas o números parciales
    // Tomamos los últimos N números donde N = min(numbers.length, 6)
    const numValues = numbers.map(n => parseArgNumber(n))

    // Necesitamos al menos 6 valores (5 empresas + total) para la tabla estándar
    // Si hay menos, puede ser que falten columnas con 0
    if (numValues.length < 2) continue

    // El total es el último valor
    const total = numValues[numValues.length - 1]
    if (total === 0) continue // Línea sin monto, ignorar

    // Los valores de empresa son los N-1 previos al total
    // Mapeamos según la cantidad disponible
    const entValues = numValues.slice(0, -1) // todo menos el total

    // Asignar a cada empresa si tiene 5 valores
    if (entValues.length >= 5) {
      for (let i = 0; i < 5; i++) {
        const amount = entValues[i]
        if (amount <= 0) continue

        const biz = BUSINESS_MAP[enterprises[i]]
        if (!biz) continue

        // Determinar categoría para ingresos
        let categoryName = sectionInfo.categoryName
        if (sectionInfo.type === 'income') {
          // Buscar match en el mapa de ingresos
          for (const [key, cat] of Object.entries(INCOME_CATEGORY_MAP)) {
            if (concept.toUpperCase().includes(key.toUpperCase())) {
              categoryName = cat
              break
            }
          }
          if (!categoryName) categoryName = 'Otros ingresos'
        }

        // Detectar USD
        const hasUSD = line.toUpperCase().includes('USD')

        transactions.push({
          id: `pdf-${transactions.length + 1}`,
          selected: true,
          date,
          description: concept,
          notes: `${enterprises[i]} | ${section}`,
          type: sectionInfo.type,
          amount,
          businessId: biz.id,
          businessName: biz.name,
          categoryName,
          expenseType: sectionInfo.expenseType,
          currency: hasUSD ? 'USD' : 'ARS',
          exchangeRate: hasUSD ? exchangeRate : null,
        })
      }
    } else if (entValues.length >= 1) {
      // Si no hay 5 columnas claras, crear una sola transacción con el total
      let categoryName = sectionInfo.categoryName
      if (sectionInfo.type === 'income') {
        for (const [key, cat] of Object.entries(INCOME_CATEGORY_MAP)) {
          if (concept.toUpperCase().includes(key.toUpperCase())) {
            categoryName = cat
            break
          }
        }
        if (!categoryName) categoryName = 'Otros ingresos'
      }

      const hasUSD = line.toUpperCase().includes('USD')

      transactions.push({
        id: `pdf-${transactions.length + 1}`,
        selected: true,
        date,
        description: concept,
        notes: section,
        type: sectionInfo.type,
        amount: total,
        businessId: 1, // default SADIA
        businessName: 'SADIA',
        categoryName,
        expenseType: sectionInfo.expenseType,
        currency: hasUSD ? 'USD' : 'ARS',
        exchangeRate: hasUSD ? exchangeRate : null,
      })
    }
  }

  return transactions
}

/**
 * Parsea gastos extraordinarios (páginas 10-11)
 * Formato: "DD/MM/YYYY   CONCEPTO   [USD]   [TC]   Monto $   Medio pago"
 */
function parseExtraordinaryExpenses(
  text: string,
  exchangeRate: number,
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []

  // Buscar secciones por empresa
  const entitySections = [
    { pattern: /SADIA\s*-\s*GASTOS EXTRAORDINARIOS([\s\S]*?)(?=(?:GUEMES|ÑANCUL|NANCUL|PDA|EML)\s*-\s*GASTOS EXTRAORDINARIOS|$)/i, bizId: 1, bizName: 'SADIA' },
    { pattern: /GUEMES\s*-\s*GASTOS EXTRAORDINARIOS([\s\S]*?)(?=(?:SADIA|ÑANCUL|NANCUL|PDA|EML)\s*-\s*GASTOS EXTRAORDINARIOS|$)/i, bizId: 1, bizName: 'SADIA' },
    { pattern: /PDA\s*-\s*GASTOS EXTRAORDINARIOS([\s\S]*?)(?=(?:SADIA|GUEMES|ÑANCUL|NANCUL|EML)\s*-\s*GASTOS EXTRAORDINARIOS|$)/i, bizId: 1, bizName: 'SADIA' },
    { pattern: /(?:ÑANCUL|NANCUL)\s*-\s*GASTOS EXTRAORDINARIOS([\s\S]*?)(?=(?:SADIA|GUEMES|PDA|EML)\s*-\s*GASTOS EXTRAORDINARIOS|$)/i, bizId: 2, bizName: 'ÑANCUL' },
    { pattern: /EML\s*-\s*GASTOS EXTRAORDINARIOS([\s\S]*?)(?=(?:SADIA|GUEMES|PDA|ÑANCUL|NANCUL)\s*-\s*GASTOS EXTRAORDINARIOS|ML\s*-\s*DETALLE|$)/i, bizId: 4, bizName: 'EML' },
  ]

  for (const { pattern, bizId, bizName } of entitySections) {
    const match = text.match(pattern)
    if (!match) continue

    const sectionText = match[1]
    const lines = sectionText.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Buscar líneas con fecha al inicio: DD/MM/YYYY
      const dateMatch = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/)
      if (!dateMatch) continue

      const date = parseDate(dateMatch[1])
      if (!date) continue

      const rest = dateMatch[2]

      // Extraer monto (número grande antes del medio de pago)
      // Formato: "CONCEPTO [USD X.XXX] [TC] MONTO MEDIO_PAGO"
      const parts = rest.split(/\s{2,}/) // split by 2+ spaces
      if (parts.length < 2) continue

      const concept = parts[0].trim()
      if (!concept) continue
      if (concept.toUpperCase().includes('TOTAL')) continue

      // Buscar números en el resto
      const allNumbers = rest.match(/[\d.]+(?:,\d+)?/g)
      if (!allNumbers || allNumbers.length === 0) continue

      // El monto principal suele ser el número más grande
      const parsedNums = allNumbers.map(n => parseArgNumber(n))
      const amount = Math.max(...parsedNums)
      if (amount <= 0) continue

      // Medio de pago es la última parte
      const medioPago = parts[parts.length - 1].trim()
      const hasUSD = rest.toUpperCase().includes('USD')

      transactions.push({
        id: `pdf-ext-${transactions.length + 1}`,
        selected: true,
        date,
        description: concept,
        notes: medioPago || '',
        type: 'expense',
        amount,
        businessId: bizId,
        businessName: bizName,
        categoryName: 'Varios', // Extraordinarios van a Varios por defecto
        expenseType: 'extraordinario',
        currency: hasUSD ? 'USD' : 'ARS',
        exchangeRate: hasUSD ? exchangeRate : null,
      })
    }
  }

  return transactions
}

/**
 * Extrae el tipo de cambio del texto del PDF
 */
function extractExchangeRate(text: string): number {
  // Buscar "TIPO CAMBIO : X.XXX,XX" — tomar el último que aparece (mes actual)
  const matches = text.match(/TIPO CAMBIO\s*:\s*([\d.,]+)/gi)
  if (!matches || matches.length === 0) return 0

  const lastMatch = matches[matches.length - 1]
  const numMatch = lastMatch.match(/([\d.,]+)$/)
  if (!numMatch) return 0

  return parseArgNumber(numMatch[1])
}

/**
 * Detecta el mes del informe detallado
 * Busca "INFORME [MES]`[AÑO]" o "INFORME [MES] [AÑO]"
 */
function detectReportMonth(text: string): string | null {
  const months: Record<string, string> = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12',
    'SEPT': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12',
  }

  // Match "INFORME OCTUBRE`24" or "INFORME OCTUBRE 2024"
  const match = text.match(/INFORME\s+(\w+)[`'\s]+(\d{2,4})/i)
  if (match) {
    const monthName = match[1].toUpperCase()
    const yearStr = match[2]
    const month = months[monthName]
    if (month) {
      const year = yearStr.length === 2 ? `20${yearStr}` : yearStr
      return `${year}-${month}`
    }
  }

  return null
}

/**
 * Función principal: parsea un PDF de informe mensual
 */
export async function parsePdfReport(
  buffer: Buffer,
  period: string,
  userExchangeRate: number,
): Promise<ParsedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  const text: string = data.text

  // Detectar TC del PDF si el usuario no proporcionó uno
  const pdfRate = extractExchangeRate(text)
  const exchangeRate = userExchangeRate > 0 ? userExchangeRate : pdfRate

  // Detectar período del PDF si no se proporcionó
  const detectedPeriod = detectReportMonth(text)
  const effectivePeriod = period || detectedPeriod || ''

  if (!effectivePeriod) {
    throw new Error('No se pudo detectar el período del informe')
  }

  const allTransactions: ParsedTransaction[] = []

  // ── Parsear detalle de gastos ordinarios (páginas 6-8) ──

  // Dividir texto en líneas
  const lines = text.split('\n')

  // Buscar las secciones por sus headers
  let currentSection = ''
  let sectionLines: string[] = []

  const sectionHeaders = Object.keys(SECTION_MAP)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const upper = line.toUpperCase()

    // Detectar inicio de sección
    const matchedHeader = sectionHeaders.find(h => {
      // Match exacto al inicio de línea
      return upper === h || upper.startsWith(h + ' ') || upper.startsWith(h + '\t')
    })

    if (matchedHeader) {
      // Procesar sección anterior
      if (currentSection && sectionLines.length > 0) {
        const txs = parseDetailTable(sectionLines, currentSection, effectivePeriod, exchangeRate)
        allTransactions.push(...txs)
      }
      currentSection = matchedHeader
      sectionLines = []
      continue
    }

    // Detectar fin de secciones (cuando encontramos headers de otra zona)
    if (upper.includes('SALDO NETO MENSUAL') || upper.includes('PUNTO EQUILIBRIO')) {
      if (currentSection && sectionLines.length > 0) {
        const txs = parseDetailTable(sectionLines, currentSection, effectivePeriod, exchangeRate)
        allTransactions.push(...txs)
      }
      currentSection = ''
      sectionLines = []
      continue
    }

    if (currentSection) {
      sectionLines.push(line)
    }
  }

  // Procesar última sección pendiente
  if (currentSection && sectionLines.length > 0) {
    const txs = parseDetailTable(sectionLines, currentSection, effectivePeriod, exchangeRate)
    allTransactions.push(...txs)
  }

  // ── Parsear gastos extraordinarios (páginas 10-11) ──
  const extraTxs = parseExtraordinaryExpenses(text, exchangeRate)
  allTransactions.push(...extraTxs)

  // Re-numerar IDs
  allTransactions.forEach((tx, i) => {
    tx.id = `pdf-${i + 1}`
  })

  return allTransactions
}
