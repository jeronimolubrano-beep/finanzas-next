/**
 * Parser de PDFs "Informe Ingresos/Egresos"
 * Estrategia: busca líneas de Subtotal/Total en lugar de parsear fila por fila,
 * porque pdf-parse no garantiza el orden visual en tablas complejas de Acrobat.
 *
 * Estructura esperada del PDF (páginas 6-8):
 *   INFORME OCTUBRE`24   SADIA  GUEMES  PDA  ÑANCUL  EML  Total
 *   Total Ingresos :     21.654.708  6.671.000  671.722  0  0  28.997.430
 *   Subtotal Proveedores: 2.968.620  0  108.900  359.952  0  3.437.472
 *   Subtotal Sueldos y Cargas Sociales: 7.165.965  333.715  ...  10.786.755
 *   ...
 *
 * Páginas 10-11 (gastos extraordinarios):
 *   SADIA - GASTOS EXTRAORDINARIOS
 *   20/10/2024  SANITARIOS CABOTO  100.000  EFVO
 */

import type { ParsedTransaction } from './excel-parser'

// Columnas de empresa en el orden que aparecen en la tabla
const COMPANIES = [
  { id: 1, name: 'SADIA' },
  { id: 1, name: 'GUEMES' },
  { id: 1, name: 'PDA' },
  { id: 2, name: 'ÑANCUL' },
  { id: 4, name: 'EML' },
] as const

// Mapeo de Subtotales → categoría de la app
// El keyword se busca en la línea en mayúsculas
const EXPENSE_CATEGORIES: Array<{ keyword: string; category: string }> = [
  { keyword: 'PROVEEDORES',      category: 'Proveedores' },
  { keyword: 'SUELDOS',          category: 'Sueldos y Cargas Sociales' },
  { keyword: 'SERVICIOS',        category: 'Servicios' },
  { keyword: 'PLANES',           category: 'Planes Financiación' },
  { keyword: 'IMPUESTOS',        category: 'Impuestos' },
  { keyword: 'SEGUROS',          category: 'Seguros' },
  { keyword: 'VARIOS',           category: 'Varios' },
]

// Categoría de ingreso ordinario según empresa
const INCOME_CATEGORY: Record<string, string> = {
  'SADIA':  'Alquiler Ministerio',
  'GUEMES': 'Alquileres Güemes Deptos',
  'PDA':    'Recupero Gastos PDA',
  'ÑANCUL': 'Liquidación Venta Ñancul',
  'EML':    'Otros ingresos',
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Parsea número en formato argentino: "1.234.567" o "1.234.567,89" → number */
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

/** Extrae todos los números de una línea */
function extractNums(line: string): number[] {
  return (line.match(/[\d.,]+/g) ?? [])
    .map(parseArgNumber)
    .filter(n => n >= 0)
}

/** Parsea fecha DD/MM/YYYY → YYYY-MM-DD */
function parseDate(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
}

/** Detecta período del informe: "INFORME OCTUBRE`24" → "2024-10" */
function detectPeriod(text: string): string | null {
  const MONTHS: Record<string, string> = {
    ENERO:'01', FEBRERO:'02', MARZO:'03', ABRIL:'04', MAYO:'05', JUNIO:'06',
    JULIO:'07', AGOSTO:'08', SEPTIEMBRE:'09', SEPT:'09',
    OCTUBRE:'10', NOVIEMBRE:'11', DICIEMBRE:'12',
  }
  const m = text.match(/INFORME\s+([A-ZÁÉÍÓÚÑ]+)[`´'\s]+(\d{2,4})/i)
  if (!m) return null
  const month = MONTHS[m[1].toUpperCase()]
  if (!month) return null
  const year = m[2].length === 2 ? `20${m[2]}` : m[2]
  return `${year}-${month}`
}

/** Extrae TC del texto (último que aparece = mes actual) */
function detectTC(text: string): number {
  const all = [...text.matchAll(/TIPO CAMBIO\s*[:\-]\s*([\d.,]+)/gi)]
  if (!all.length) return 0
  return parseArgNumber(all[all.length - 1][1])
}

// ─── parser principal ─────────────────────────────────────────────────────────

export async function parsePdfReport(
  buffer: Buffer,
  period: string,
  userExchangeRate: number,
): Promise<ParsedTransaction[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    console.log('[Parser] pdf-parse requerido exitosamente')

    const data = await pdfParse(buffer)
    console.log('[Parser] PDF parseado, páginas:', data.numpages, 'caracteres:', data.text.length)

    const rawText: string = data.text

    // ── Período y TC ──
    const detectedPeriod = detectPeriod(rawText)
    console.log('[Parser] Período detectado:', detectedPeriod)

    const effectivePeriod = period || detectedPeriod || ''
    if (!effectivePeriod) throw new Error('No se pudo detectar el período del informe')

  const pdfTC = detectTC(rawText)
  const exchangeRate = userExchangeRate > 0 ? userExchangeRate : pdfTC

  const periodDate = `${effectivePeriod}-01`
  const results: ParsedTransaction[] = []
  let nextId = 1

  // Normalizar líneas
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  // ── 1. INGRESOS ORDINARIOS ────────────────────────────────────────────────
  // Buscamos "Total Ingresos :" con 5-6 números = [SADIA, GUEMES, PDA, ÑANCUL, EML, Total]
  for (const line of lines) {
    const u = line.toUpperCase()
    if (!u.startsWith('TOTAL INGRESOS') || u.includes('EXTRAORDINARIOS')) continue

    const nums = extractNums(line)
    // Esperamos al menos 5 números (4 empresas + total o 5 empresas)
    if (nums.length < 2) continue

    // Los primeros min(5, nums.length-1) son por empresa, el último es el total
    const companyNums = nums.slice(0, Math.min(5, nums.length - 1))

    companyNums.forEach((amount, idx) => {
      if (amount <= 0) return
      const co = COMPANIES[idx]
      if (!co) return
      results.push({
        id: `pdf-${nextId++}`,
        selected: true,
        date: periodDate,
        description: `Ingresos Ordinarios`,
        notes: `${co.name} | INGRESOS ORDINARIOS`,
        type: 'income',
        amount,
        businessId: co.id,
        businessName: co.name,
        categoryName: INCOME_CATEGORY[co.name] ?? 'Otros ingresos',
        expenseType: 'ordinario',
        currency: 'ARS',
        exchangeRate: null,
      })
    })
    break // Solo procesar la primera coincidencia
  }

  // ── 2. GASTOS ORDINARIOS por categoría ────────────────────────────────────
  // Buscamos líneas "Subtotal [Categoría]: N1 N2 N3 N4 N5 Total"
  for (const line of lines) {
    const u = line.toUpperCase()
    if (!u.startsWith('SUBTOTAL')) continue

    const expCat = EXPENSE_CATEGORIES.find(ec => u.includes(ec.keyword))
    if (!expCat) continue

    const nums = extractNums(line)
    if (nums.length < 2) continue

    const companyNums = nums.slice(0, Math.min(5, nums.length - 1))

    companyNums.forEach((amount, idx) => {
      if (amount <= 0) return
      const co = COMPANIES[idx]
      if (!co) return
      results.push({
        id: `pdf-${nextId++}`,
        selected: true,
        date: periodDate,
        description: expCat.category,
        notes: `${co.name} | GASTOS ORDINARIOS`,
        type: 'expense',
        amount,
        businessId: co.id,
        businessName: co.name,
        categoryName: expCat.category,
        expenseType: 'ordinario',
        currency: 'ARS',
        exchangeRate: null,
      })
    })
  }

  // ── 3. GASTOS EXTRAORDINARIOS individuales ────────────────────────────────
  // Secciones: "EMPRESA - GASTOS EXTRAORDINARIOS" → buscar líneas con fecha
  const EXTRA_SECTIONS = [
    { re: /^SADIA\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,               bizId: 1, bizName: 'SADIA' },
    { re: /^GUEMES\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,              bizId: 1, bizName: 'GUEMES' },
    { re: /^PDA\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,                 bizId: 1, bizName: 'PDA' },
    { re: /^(?:ÑANCUL|NANCUL)\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,  bizId: 2, bizName: 'ÑANCUL' },
    { re: /^EML\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,                 bizId: 4, bizName: 'EML' },
  ]

  // Regex que detecta inicio de otra sección
  const NEXT_SECTION_RE = /^(?:SADIA|GUEMES|PDA|ÑANCUL|NANCUL|EML|ML)\s*[-–]\s*(GASTOS|DETALLE)/i

  for (const { re, bizId, bizName } of EXTRA_SECTIONS) {
    // Encontrar el índice donde empieza esta sección
    const startIdx = lines.findIndex(l => re.test(l))
    if (startIdx < 0) continue

    // Escanear hasta la próxima sección o fin
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i]

      // Parar al encontrar otra sección de empresa
      if (i > startIdx + 1 && NEXT_SECTION_RE.test(line)) break

      // Buscar líneas con fecha DD/MM/YYYY
      const dateM = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/)
      if (!dateM) continue

      const date = parseDate(dateM[1])
      if (!date) continue

      const rest = dateM[2]

      // Ignorar líneas de total
      if (/TOTAL/i.test(rest)) continue

      // Concepto = texto antes del primer dígito
      const firstDigit = rest.search(/\d/)
      const concept = firstDigit > 0 ? rest.slice(0, firstDigit).trim() : rest.trim()
      if (!concept || concept.length < 2) continue

      // Detectar si es en USD
      const usdM = rest.match(/USD\s*([\d.,]+)\s+([\d.,]+)/i)
      let amount: number
      let currency: 'ARS' | 'USD' = 'ARS'
      let txTC: number | null = null

      if (usdM) {
        const usdAmt  = parseArgNumber(usdM[1])
        const tc      = parseArgNumber(usdM[2])
        amount        = tc > 0 ? usdAmt * tc : usdAmt * (exchangeRate || 1)
        currency      = 'USD'
        txTC          = tc > 0 ? tc : exchangeRate
      } else {
        const nums = extractNums(rest)
        if (!nums.length) continue
        amount = Math.max(...nums)
      }

      if (amount <= 0) continue

      // Medio de pago = última "palabra" separada por 2+ espacios
      const medioPago = rest.split(/\s{2,}/).pop()?.trim() ?? ''

      results.push({
        id: `pdf-${nextId++}`,
        selected: true,
        date,
        description: concept,
        notes: medioPago || bizName,
        type: 'expense',
        amount,
        businessId: bizId,
        businessName: bizName,
        categoryName: 'Varios',
        expenseType: 'extraordinario',
        currency,
        exchangeRate: txTC,
      })
    }
  }

  // ── 4. Si no encontramos extraordinarios individuales, usar totales ────────
  // "EMPRESA - TOTAL GASTOS EXTRAORDINARIOS : MONTO"
  if (results.filter(t => t.expenseType === 'extraordinario').length === 0) {
    const TOTAL_RE = [
      { re: /^SADIA\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i,  bizId: 1, bizName: 'SADIA' },
      { re: /^GUEMES\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i, bizId: 1, bizName: 'GUEMES' },
      { re: /^(?:ÑANCUL|NANCUL)\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i, bizId: 2, bizName: 'ÑANCUL' },
      { re: /^EML\s*[-–]\s*TOTAL GASTOS EXTRAORDINARIOS\s*[:\-]\s*([\d.,]+)/i,    bizId: 4, bizName: 'EML' },
    ]
    for (const line of lines) {
      for (const { re, bizId, bizName } of TOTAL_RE) {
        const m = line.match(re)
        if (!m) continue
        const amount = parseArgNumber(m[1])
        if (amount <= 0) continue
        results.push({
          id: `pdf-${nextId++}`,
          selected: true,
          date: periodDate,
          description: `Gastos Extraordinarios ${bizName}`,
          notes: `${bizName} | TOTAL GASTOS EXTRAORDINARIOS`,
          type: 'expense',
          amount,
          businessId: bizId,
          businessName: bizName,
          categoryName: 'Varios',
          expenseType: 'extraordinario',
          currency: 'ARS',
          exchangeRate: null,
        })
      }
    }
  }

  // Re-numerar IDs
  results.forEach((t, i) => { t.id = `pdf-${i + 1}` })

  // Logging de resumen
  const incomeTxs = results.filter(t => t.type === 'income').length
  const expenseTxs = results.filter(t => t.type === 'expense').length
  const ordTxs = results.filter(t => t.expenseType === 'ordinario').length
  const extTxs = results.filter(t => t.expenseType === 'extraordinario').length
  console.log('[Parser] Resumen:', {
    total: results.length,
    ingresos: incomeTxs,
    gastos: expenseTxs,
    ordinarios: ordTxs,
    extraordinarios: extTxs,
  })

  return results
}
