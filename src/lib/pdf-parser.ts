/**
 * Parser de PDFs "Informe Ingresos/Egresos"
 *
 * Dos modos:
 *  - 'summary': una transacción por subtotal de categoría × empresa (pocos registros)
 *  - 'detail' : una transacción por línea individual del informe (todos los detalles)
 */

import type { ParsedTransaction } from './excel-parser'

const COMPANIES = [
  { id: 1, name: 'SADIA'  },
  { id: 1, name: 'GUEMES' },
  { id: 1, name: 'PDA'    },
  { id: 2, name: 'ÑANCUL' },
  { id: 4, name: 'EML'    },
] as const

const EXPENSE_SECTIONS: Array<{ header: string; keyword: string; category: string }> = [
  { header: 'PROVEEDORES',        keyword: 'PROVEEDORES',  category: 'Proveedores' },
  { header: 'SUELDOS',            keyword: 'SUELDOS',      category: 'Sueldos y Cargas Sociales' },
  { header: 'SERVICIOS',          keyword: 'SERVICIOS',    category: 'Servicios' },
  { header: 'PLANES FINANCIACION',keyword: 'PLANES',       category: 'Planes Financiación' },
  { header: 'IMPUESTOS',          keyword: 'IMPUESTOS',    category: 'Impuestos' },
  { header: 'SEGUROS',            keyword: 'SEGUROS',      category: 'Seguros' },
  { header: 'VARIOS',             keyword: 'VARIOS',       category: 'Varios' },
]

const INCOME_CATEGORY: Record<string, string> = {
  'SADIA':  'Alquiler Ministerio',
  'GUEMES': 'Alquileres Güemes Deptos',
  'PDA':    'Recupero Gastos PDA',
  'ÑANCUL': 'Liquidación Venta Ñancul',
  'EML':    'Otros ingresos',
}

// Conceptos que identifican líneas de ingreso ordinario
const INCOME_PREFIXES = [
  'INGRESOS ALQUILERES', 'INGRESOS PDA', 'INGRESOS ÑANCUL', 'INGRESOS NANCUL',
  'ALQUILERES GUEMES', 'ALQUILER GUEMES', 'ALQUILER MINISTERIO',
  'ALQUILER ALEM', 'ALQUILER ANTENA', 'LIQ VENTA', 'LIQUIDACION VENTA',
  'RENTABILIDAD FCI', 'INTERESES BONOS', 'OTROS INGRESOS', 'ALQUILERES MINISTERIO',
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseArgNumber(str: string): number {
  if (!str) return 0
  let s = str.trim().replace(/[$\s]/g, '')
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return neg ? -n : n
}

/**
 * Extrae números en formato argentino estricto: \d{1,3}(?:\.\d{3})*
 * Esto separa correctamente números pegados que genera pdf-parse en tablas:
 * "1.445.1701.445.170" → ["1.445.170","1.445.170"] en vez de un número gigante.
 */
function extractNums(line: string): number[] {
  return (line.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) ?? [])
    .map(parseArgNumber)
    .filter(n => n >= 0)
}

/**
 * Elimina patrones de fecha de una línea antes de extraer montos.
 * Evita que "10/202450.000" sea interpretado como "10" + "202" + "450.000".
 * Soporta: dd/mm/yyyy, mm/yyyy, dd/mm/yy
 */
function stripDates(line: string): string {
  return line
    .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, ' ')   // dd/mm/yyyy
    .replace(/\d{1,2}\/\d{1,2}\/\d{2}/g,   ' ')   // dd/mm/yy
    .replace(/\d{1,2}\/\d{4}/g,             ' ')   // mm/yyyy o vto MM/YYYY
}

function parseDate(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function detectPeriod(text: string): string | null {
  const MONTHS: Record<string, string> = {
    ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
    JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SEPT: '09',
    OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
  }
  const m = text.match(/INFORME\s+([A-ZÁÉÍÓÚÑ]+)[`´'\s]+(\d{2,4})/i)
  if (!m) return null
  const month = MONTHS[m[1].toUpperCase()]
  if (!month) return null
  const year = m[2].length === 2 ? `20${m[2]}` : m[2]
  return `${year}-${month}`
}

function detectTC(text: string): number {
  const all = [...text.matchAll(/TIPO CAMBIO\s*[:\-]\s*([\d.,]+)/gi)]
  if (!all.length) return 0
  return parseArgNumber(all[all.length - 1][1])
}

/** Detecta la empresa por el nombre del concepto */
function bizFromConcept(concept: string): { bizId: number; bizName: string } {
  const u = concept.toUpperCase()
  if (u.includes('GUEMES') || u.includes('GÜEMES') || u.includes('IBC'))
    return { bizId: 1, bizName: 'GUEMES' }
  if (u.includes(' PDA') || u.startsWith('PDA') || u.includes('ALVARINAS'))
    return { bizId: 1, bizName: 'PDA' }
  if (u.includes('ÑANCUL') || u.includes('NANCUL') || u.includes('LAVALLE') ||
      u.includes('LA ESPERANZA') || u.includes('ESPERANZA') || u.includes('RAUCH'))
    return { bizId: 2, bizName: 'ÑANCUL' }
  if (u.includes('OLIVOS') || u.includes('EML') || u.includes('SAN ANDRES') || u.includes('ACEESA'))
    return { bizId: 4, bizName: 'EML' }
  return { bizId: 1, bizName: 'SADIA' }
}

// ─── MODO SUMMARY ─────────────────────────────────────────────────────────────

function parseSummary(lines: string[], periodDate: string, exchangeRate: number): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  let nextId = 1

  // 1. Ingresos por empresa (Total Ingresos :)
  for (const line of lines) {
    const u = line.toUpperCase()
    if (!u.startsWith('TOTAL INGRESOS') || u.includes('EXTRAORDINARIOS')) continue
    const nums = extractNums(line)
    if (nums.length < 2) continue
    const companyNums = nums.slice(0, Math.min(5, nums.length - 1))
    companyNums.forEach((amount, idx) => {
      if (amount <= 0) return
      const co = COMPANIES[idx]
      if (!co) return
      results.push({
        id: `pdf-${nextId++}`, selected: true, date: periodDate,
        description: 'Ingresos Ordinarios',
        notes: `${co.name} | INGRESOS ORDINARIOS`,
        type: 'income', amount,
        businessId: co.id, businessName: co.name,
        categoryName: INCOME_CATEGORY[co.name] ?? 'Otros ingresos',
        expenseType: 'ordinario', currency: 'ARS', exchangeRate: null,
      })
    })
    break
  }

  // 2. Gastos ordinarios por subtotal de categoría
  for (const line of lines) {
    const u = line.toUpperCase()
    if (!u.startsWith('SUBTOTAL')) continue
    const sec = EXPENSE_SECTIONS.find(s => u.includes(s.keyword))
    if (!sec) continue
    const nums = extractNums(line)
    if (nums.length < 2) continue
    const companyNums = nums.slice(0, Math.min(5, nums.length - 1))
    companyNums.forEach((amount, idx) => {
      if (amount <= 0) return
      const co = COMPANIES[idx]
      if (!co) return
      results.push({
        id: `pdf-${nextId++}`, selected: true, date: periodDate,
        description: sec.category,
        notes: `${co.name} | GASTOS ORDINARIOS`,
        type: 'expense', amount,
        businessId: co.id, businessName: co.name,
        categoryName: sec.category,
        expenseType: 'ordinario', currency: 'ARS', exchangeRate: null,
      })
    })
  }

  // 3. Extraordinarios (totales por empresa)
  const EXTRA_TOTAL_RE = [
    { re: /SADIA\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i,  bizId: 1, bizName: 'SADIA' },
    { re: /GUEMES\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i, bizId: 1, bizName: 'GUEMES' },
    { re: /(?:ÑANCUL|NANCUL)\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i, bizId: 2, bizName: 'ÑANCUL' },
    { re: /EML\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i,    bizId: 4, bizName: 'EML' },
  ]
  for (const line of lines) {
    for (const { re, bizId, bizName } of EXTRA_TOTAL_RE) {
      const m = line.match(re)
      if (!m) continue
      const amount = parseArgNumber(m[1])
      if (amount <= 0) continue
      results.push({
        id: `pdf-${nextId++}`, selected: true, date: periodDate,
        description: `Gastos Extraordinarios ${bizName}`,
        notes: `${bizName} | TOTAL GASTOS EXTRAORDINARIOS`,
        type: 'expense', amount,
        businessId: bizId, businessName: bizName,
        categoryName: 'Varios', expenseType: 'extraordinario',
        currency: 'ARS', exchangeRate: null,
      })
    }
  }

  results.forEach((t, i) => { t.id = `pdf-${i + 1}` })
  return results
}

// ─── MODO DETAIL ──────────────────────────────────────────────────────────────

function parseDetail(lines: string[], periodDate: string, exchangeRate: number): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  let nextId = 1

  // ── 1. Ingresos ordinarios individuales ──────────────────────────────────────
  for (const line of lines) {
    const u = line.trim().toUpperCase()
    // Ignorar totales y subtotales
    if (u.startsWith('TOTAL') || u.startsWith('SUBTOTAL')) continue
    const isIncomeLine = INCOME_PREFIXES.some(p => u.startsWith(p))
    if (!isIncomeLine) continue

    const nums = extractNums(stripDates(line))
    if (!nums.length) continue

    // Concepto = texto antes del primer número (en la línea original sin stripear)
    const firstDigit = line.search(/\d/)
    const concept = firstDigit > 0 ? line.slice(0, firstDigit).trim() : line.trim()
    if (!concept) continue

    // Si el concepto ya menciona una empresa específica → 1 transacción con el mayor valor
    const mentionsCompany = /SADIA|GUEMES|GÜEMES|IBC|PDA|ÑANCUL|NANCUL|EML/i.test(concept)
    if (mentionsCompany || nums.length === 1) {
      const amount = nums.length === 1 ? nums[0] : Math.max(...nums)
      if (amount <= 0) continue
      const { bizId, bizName } = bizFromConcept(concept)
      results.push({
        id: `pdf-${nextId++}`, selected: true, date: periodDate,
        description: concept,
        notes: `${bizName} | INGRESOS ORDINARIOS`,
        type: 'income', amount,
        businessId: bizId, businessName: bizName,
        categoryName: INCOME_CATEGORY[bizName] ?? 'Otros ingresos',
        expenseType: 'ordinario', currency: 'ARS', exchangeRate: null,
      })
    } else {
      // Múltiples columnas por empresa: todos los valores excepto el último (total)
      // se asignan a cada empresa según el orden de COMPANIES
      const companyNums = nums.slice(0, Math.min(COMPANIES.length, nums.length - 1))
      companyNums.forEach((amount, idx) => {
        if (amount <= 0) return
        const co = COMPANIES[idx]
        if (!co) return
        results.push({
          id: `pdf-${nextId++}`, selected: true, date: periodDate,
          description: concept,
          notes: `${co.name} | INGRESOS ORDINARIOS`,
          type: 'income', amount,
          businessId: co.id, businessName: co.name,
          categoryName: INCOME_CATEGORY[co.name] ?? 'Otros ingresos',
          expenseType: 'ordinario', currency: 'ARS', exchangeRate: null,
        })
      })
    }
  }

  // Si no encontramos ingresos individuales, usar el Total Ingresos
  if (results.filter(t => t.type === 'income').length === 0) {
    for (const line of lines) {
      const u = line.toUpperCase()
      if (!u.startsWith('TOTAL INGRESOS') || u.includes('EXTRAORDINARIOS')) continue
      const nums = extractNums(line)
      if (nums.length < 2) continue
      const companyNums = nums.slice(0, Math.min(5, nums.length - 1))
      companyNums.forEach((amount, idx) => {
        if (amount <= 0) return
        const co = COMPANIES[idx]
        if (!co) return
        results.push({
          id: `pdf-${nextId++}`, selected: true, date: periodDate,
          description: 'Ingresos Ordinarios',
          notes: `${co.name} | INGRESOS ORDINARIOS`,
          type: 'income', amount,
          businessId: co.id, businessName: co.name,
          categoryName: INCOME_CATEGORY[co.name] ?? 'Otros ingresos',
          expenseType: 'ordinario', currency: 'ARS', exchangeRate: null,
        })
      })
      break
    }
  }

  // ── 2. Gastos ordinarios individuales (líneas entre header y subtotal) ────────
  for (const sec of EXPENSE_SECTIONS) {
    // Encontrar el índice del Subtotal de esta sección
    const subtotalIdx = lines.findIndex(l => {
      const u = l.toUpperCase()
      return u.startsWith('SUBTOTAL') && u.includes(sec.keyword)
    })
    if (subtotalIdx < 0) continue

    // Buscar el header de la sección hacia atrás
    let headerIdx = -1
    for (let i = subtotalIdx - 1; i >= Math.max(0, subtotalIdx - 80); i--) {
      const u = lines[i].toUpperCase().trim()
      if (u === sec.header || u.startsWith(sec.header + ' ') || u.startsWith(sec.header + '\t')) {
        headerIdx = i
        break
      }
    }
    if (headerIdx < 0) continue

    // Parsear líneas entre header y subtotal
    for (let i = headerIdx + 1; i < subtotalIdx; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const u = line.toUpperCase()
      // Ignorar headers, totales, columnas
      if (u.startsWith('SUBTOTAL') || u.startsWith('TOTAL') ||
          u === 'SADIA' || u === 'GUEMES' || u === 'PDA' ||
          u === 'ÑANCUL' || u === 'EML' || u === sec.header) continue

      // Limpiar fechas antes de extraer montos para evitar que "10/202450.000"
      // sea parseado como 450.000 en vez de 50.000.
      const nums = extractNums(stripDates(line))
      if (!nums.length) continue
      // Usar el mayor número de la fila (el total es siempre el más grande);
      // filtrar artefactos pequeños (nros de página, etc.) con umbral 10.
      const validNums = nums.filter(n => n >= 10)
      if (!validNums.length) continue
      const amount = Math.max(...validNums)
      if (amount <= 0) continue

      // Concepto = texto antes del primer número
      const firstDigit = line.search(/\d/)
      if (firstDigit <= 0) continue
      const concept = line.slice(0, firstDigit).trim()
      if (!concept || concept.length < 2) continue

      const { bizId, bizName } = bizFromConcept(concept)

      results.push({
        id: `pdf-${nextId++}`, selected: true, date: periodDate,
        description: concept,
        notes: `${bizName} | ${sec.category}`,
        type: 'expense', amount,
        businessId: bizId, businessName: bizName,
        categoryName: sec.category,
        expenseType: 'ordinario', currency: 'ARS', exchangeRate: null,
      })
    }
  }

  // ── 3. Gastos extraordinarios individuales (con fecha) ────────────────────────
  const EXTRA_SECTIONS = [
    { re: /^SADIA\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,              bizId: 1, bizName: 'SADIA'  },
    { re: /^GUEMES\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,             bizId: 1, bizName: 'GUEMES' },
    { re: /^PDA\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,                bizId: 1, bizName: 'PDA'    },
    { re: /^(?:ÑANCUL|NANCUL)\s*[-–]\s*GASTOS EXTRAORDINARIOS/i, bizId: 2, bizName: 'ÑANCUL' },
    { re: /^EML\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,               bizId: 4, bizName: 'EML'    },
    { re: /^ML\s*[-–]\s*DETALLE GASTOS/i,                        bizId: 4, bizName: 'EML'    },
  ]
  const NEXT_SECTION_RE = /^(?:SADIA|GUEMES|PDA|ÑANCUL|NANCUL|EML|ML)\s*[-–]\s*(GASTOS|DETALLE)/i

  for (const { re, bizId, bizName } of EXTRA_SECTIONS) {
    const startIdx = lines.findIndex(l => re.test(l.trim()))
    if (startIdx < 0) continue

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (i > startIdx + 1 && NEXT_SECTION_RE.test(line)) break

      const dateM = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/)
      if (!dateM) continue
      const date = parseDate(dateM[1])
      if (!date) continue

      const rest = dateM[2]
      if (/TOTAL/i.test(rest)) continue

      const firstDigit = rest.search(/\d/)
      const concept = firstDigit > 0 ? rest.slice(0, firstDigit).trim() : rest.trim()
      if (!concept || concept.length < 2) continue

      // Detectar USD
      const usdM = rest.match(/USD\s*([\d.,]+)\s+([\d.,]+)/i)
      let amount: number
      let currency: 'ARS' | 'USD' = 'ARS'
      let txTC: number | null = null

      if (usdM) {
        const usdAmt = parseArgNumber(usdM[1])
        const tc = parseArgNumber(usdM[2])
        amount = tc > 0 ? usdAmt * tc : usdAmt * (exchangeRate || 1)
        currency = 'USD'
        txTC = tc > 0 ? tc : exchangeRate
      } else {
        const nums = extractNums(rest)
        if (!nums.length) continue
        amount = Math.max(...nums)
      }
      if (amount <= 0) continue

      const medioPago = rest.split(/\s{2,}/).pop()?.trim() ?? ''

      results.push({
        id: `pdf-${nextId++}`, selected: true, date,
        description: concept,
        notes: medioPago || bizName,
        type: 'expense', amount,
        businessId: bizId, businessName: bizName,
        categoryName: 'Varios', expenseType: 'extraordinario',
        currency, exchangeRate: txTC,
      })
    }
  }

  // Si no encontramos extraordinarios individuales, usar totales como fallback
  if (results.filter(t => t.expenseType === 'extraordinario').length === 0) {
    const EXTRA_TOTAL_RE = [
      { re: /SADIA\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i,  bizId: 1, bizName: 'SADIA' },
      { re: /GUEMES\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i, bizId: 1, bizName: 'GUEMES' },
      { re: /(?:ÑANCUL|NANCUL)\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i, bizId: 2, bizName: 'ÑANCUL' },
      { re: /EML\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i,    bizId: 4, bizName: 'EML' },
    ]
    for (const line of lines) {
      for (const { re, bizId, bizName } of EXTRA_TOTAL_RE) {
        const m = line.match(re)
        if (!m) continue
        const amount = parseArgNumber(m[1])
        if (amount <= 0) continue
        results.push({
          id: `pdf-${nextId++}`, selected: true, date: periodDate,
          description: `Gastos Extraordinarios ${bizName}`,
          notes: `${bizName} | TOTAL GASTOS EXTRAORDINARIOS`,
          type: 'expense', amount,
          businessId: bizId, businessName: bizName,
          categoryName: 'Varios', expenseType: 'extraordinario',
          currency: 'ARS', exchangeRate: null,
        })
      }
    }
  }

  results.forEach((t, i) => { t.id = `pdf-${i + 1}` })
  return results
}

// ─── PARSER PRINCIPAL ─────────────────────────────────────────────────────────

export async function parsePdfReport(
  buffer: Buffer,
  period: string,
  userExchangeRate: number,
  mode: 'detail' | 'summary' = 'summary',
): Promise<ParsedTransaction[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(buffer)
    const rawText: string = data.text
    console.log('[Parser] Modo:', mode, '| Páginas:', data.numpages, '| Chars:', rawText.length)

    const detectedPeriod = detectPeriod(rawText)
    const effectivePeriod = period || detectedPeriod || ''
    if (!effectivePeriod) throw new Error('No se pudo detectar el período del informe')
    console.log('[Parser] Período:', effectivePeriod)

    const pdfTC = detectTC(rawText)
    const exchangeRate = userExchangeRate > 0 ? userExchangeRate : pdfTC
    const periodDate = `${effectivePeriod}-01`

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

    const results = mode === 'detail'
      ? parseDetail(lines, periodDate, exchangeRate)
      : parseSummary(lines, periodDate, exchangeRate)

    console.log('[Parser] Transacciones generadas:', results.length)
    return results
  } catch (err) {
    console.error('[Parser] Error:', err)
    throw err
  }
}
