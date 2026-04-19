/**
 * Parser de PDFs "Informe Ingresos/Egresos" — Grupo Lubrano
 *
 * Diseñado para el formato fijo del informe mensual.
 * Importa: gastos ordinarios (detalle línea × empresa), ingresos (facturas/dptos),
 * gastos extraordinarios (con fecha real), y retiros ML.
 *
 * Especificación:
 * - Empresas: SADIA(1), GUEMES→Promenade(3), PDA(5), ÑANCUL(2), EML(4)
 * - Categorías: Proveedores(14), Sueldos(15), Servicios(8), Planes(17),
 *   Impuestos(18), Seguros(19), Otros(20), Alquileres(24), Otros ingresos(31)
 * - Fecha ordinarios: último día del mes
 * - Status: todo percibido
 * - TC: no se guarda (se calcula con API)
 * - IVA: detectar de líneas que mencionan IVA
 * - Montos $0: ignorar
 * - Medio pago: EFVO → Efectivo(3), resto → Cuenta corriente(1)
 */

import type { ParsedTransaction } from './excel-parser'

// ─── MAPEOS FIJOS ──────────────────────────────────────────────────────────────

const COMPANIES = [
  { id: 1, key: 'SADIA',  dbName: 'Sadia' },
  { id: 3, key: 'GUEMES', dbName: 'Promenade' },
  { id: 5, key: 'PDA',    dbName: 'PDA' },
  { id: 2, key: 'ÑANCUL', dbName: 'Ñancul' },
  { id: 4, key: 'EML',    dbName: 'EML' },
] as const

type CompanyKey = typeof COMPANIES[number]['key']

const CATEGORY_MAP: Record<string, { id: number; name: string }> = {
  'PROVEEDORES':         { id: 14, name: 'Proveedores' },
  'SUELDOS':             { id: 15, name: 'Sueldos y Cargas Sociales' },
  'SERVICIOS':           { id: 8,  name: 'Servicios' },
  'PLANES FINANCIACION': { id: 17, name: 'Planes Financiación' },
  'IMPUESTOS':           { id: 18, name: 'Impuestos' },
  'SEGUROS':             { id: 19, name: 'Seguros' },
  'VARIOS':              { id: 20, name: 'Otros' },
  'EXTRAORDINARIOS':     { id: 20, name: 'Otros' },
  'ML_RETIROS':          { id: 20, name: 'Otros' },
  'ALQUILERES':          { id: 24, name: 'Alquileres' },
  'OTROS_INGRESOS':      { id: 31, name: 'Otros ingresos' },
}

const ACCOUNT_MAP: Record<string, { id: number; name: string }> = {
  'EFVO':     { id: 3, name: 'Efectivo' },
  'DEFAULT':  { id: 1, name: 'Cuenta corriente' },
}

/** Secciones de gasto ordinario en el orden que aparecen en el informe */
const EXPENSE_SECTIONS = [
  { header: 'PROVEEDORES',         subtotalKey: 'PROVEEDORES',  catKey: 'PROVEEDORES' },
  { header: 'SUELDOS',             subtotalKey: 'SUELDOS',      catKey: 'SUELDOS' },
  { header: 'SERVICIOS',           subtotalKey: 'SERVICIOS',    catKey: 'SERVICIOS' },
  { header: 'PLANES FINANCIACION', subtotalKey: 'PLANES',       catKey: 'PLANES FINANCIACION' },
  { header: 'IMPUESTOS',           subtotalKey: 'IMPUESTOS',    catKey: 'IMPUESTOS' },
  { header: 'SEGUROS',             subtotalKey: 'SEGUROS',      catKey: 'SEGUROS' },
  { header: 'VARIOS',              subtotalKey: 'VARIOS',       catKey: 'VARIOS' },
] as const

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function parseArgNumber(str: string): number {
  if (!str) return 0
  let s = str.trim().replace(/[$\s]/g, '')
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  // Formato argentino: 1.445.170 o 1.445.170,50
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return neg ? -n : n
}

/**
 * Extrae montos en formato argentino de una línea.
 * Acepta SOLO:
 *   - Números con separador de miles (X.XXX, X.XXX.XXX, etc.)
 *   - Números con coma decimal (XXX,XX)
 * Rechaza dígitos sueltos / códigos alfanuméricos (ej: "U495455", "AF330HM",
 * "Cta 09/24", patentes, número de factura, etc.) para evitar que se
 * interpreten como monto.
 */
function extractNums(line: string): number[] {
  const matches = line.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d{2}/g) ?? []
  return matches.map(parseArgNumber).filter(n => n > 0)
}

/** Elimina patrones de fecha para evitar interferencia con montos */
function stripDates(line: string): string {
  return line
    .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, ' ')
    .replace(/\d{1,2}\/\d{1,2}\/\d{2}/g, ' ')
    .replace(/\d{1,2}\/\d{4}/g, ' ')
}

/** Elimina porcentajes finales como "7,8%" o "100,00%" */
function stripPercentages(line: string): string {
  return line.replace(/\d{1,3},?\d*%/g, ' ')
}

/**
 * Retorna el índice del primer carácter donde comienza un monto
 * en formato argentino válido (con separador de miles o decimal).
 * Usado para separar la descripción de los montos sin que códigos
 * alfanuméricos (Cta 09/24, U495455, AF330HM) corten la descripción.
 */
function firstAmountIndex(line: string): number {
  const m = line.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d{2}/)
  return m?.index ?? -1
}

function parseDate(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** Detecta el período del informe.
 * Soporta dos formatos:
 *   - Nuevo: "INFORME 01/2026" → "2026-01"
 *   - Viejo: "INFORME OCTUBRE 2024" → "2024-10"
 */
function detectPeriod(text: string): string | null {
  // Nuevo formato numérico: "INFORME 01/2026"
  const numericMatch = text.match(/INFORME\s+(\d{2})\/(\d{4})/i)
  if (numericMatch) {
    return `${numericMatch[2]}-${numericMatch[1]}`
  }

  // Formato clásico con mes en letras: "INFORME OCTUBRE 2024"
  const MONTHS: Record<string, string> = {
    ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
    JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SEPT: '09',
    OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
  }
  const m = text.match(/INFORME\s+([A-ZÁÉÍÓÚÑ]+)[`´'\s]*(\d{2,4})/i)
  if (!m) return null
  const month = MONTHS[m[1].toUpperCase()]
  if (!month) return null
  const year = m[2].length === 2 ? `20${m[2]}` : m[2]
  return `${year}-${month}`
}

/** Retorna el último día del mes para un período YYYY-MM */
function lastDayOfMonth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${period}-${String(lastDay).padStart(2, '0')}`
}

/** Detecta la empresa a partir del nombre del concepto */
function detectCompany(concept: string): typeof COMPANIES[number] {
  const u = concept.toUpperCase()

  // GUEMES / Promenade
  if (u.includes('GUEMES') || u.includes('GÜEMES') || u.includes('IBC') ||
      u.includes('PROMENADE') || u.includes('COCHERA'))
    return COMPANIES[1] // GUEMES → Promenade (id:3)

  // PDA
  if (u.includes(' PDA') || u.startsWith('PDA') || u.includes('ALVARINAS'))
    return COMPANIES[2] // PDA (id:5)

  // ÑANCUL (campo / La Esperanza)
  if (u.includes('ÑANCUL') || u.includes('NANCUL') || u.includes('LAVALLE') ||
      u.includes('LA ESPERANZA') || u.includes('ESPERANZA') || u.includes('RAUCH') ||
      u.includes('CALEGARI') || u.includes('COOP RAUCH') || u.includes('NUTRIJO') ||
      u.includes('BORSANI') || u.includes('ECHANDI') || u.includes('ECOBAT') ||
      u.includes('INSEMINACION') || u.includes('AFTOSA') || u.includes('SENASA') ||
      u.includes('SOCIEDAD RURAL') || u.includes('GARCIA NICOLAS') ||
      u.includes('GARCIA ALBERTO') || u.includes('SILVA GUSTAVO') ||
      u.includes('SILVETTI') || u.includes('AGUACORP') || u.includes('ITALSUR') ||
      u.includes('FERRETERIA') || u.includes('CORRALON') || u.includes('CORRALÓN') ||
      u.includes('FUMYTAN') || u.includes('VETERINARIA') || u.includes('COMBUSTIBLE') ||
      u.includes('BAÑOS QUIMICOS') || u.includes('LANFRANCONI'))
    return COMPANIES[3] // ÑANCUL (id:2)

  // EML
  if (u.includes('OLIVOS') || u.includes('EML') || u.includes('SAN ANDRES') ||
      u.includes('ACEESA') || u.includes('COLEGIO') || u.includes('TRANSPORTE ESCOLAR') ||
      u.includes('COMEDOR') || u.includes('PEUGEOT JERO') || u.includes('AF330'))
    return COMPANIES[4] // EML (id:4)

  // Default: SADIA
  return COMPANIES[0] // Sadia (id:1)
}

/** Detecta si una línea de ingreso es un alquiler o "otros ingresos" */
function incomeCategory(concept: string): { id: number; name: string } {
  const u = concept.toUpperCase()
  // "Otros ingresos": PDA recupero gastos, Ñancul ventas
  if (u.includes('PDA') || u.includes('ALVARINAS') || u.includes('RECUPERO') ||
      u.includes('ÑANCUL') || u.includes('NANCUL') || u.includes('VENTA'))
    return CATEGORY_MAP['OTROS_INGRESOS']
  // Todo lo demás es alquiler
  return CATEGORY_MAP['ALQUILERES']
}

/** Mapea medio de pago a cuenta */
function mapAccount(medioPago: string): { id: number; name: string } {
  const u = medioPago.toUpperCase().trim()
  if (u === 'EFVO' || u.includes('EFECTIVO'))
    return ACCOUNT_MAP['EFVO']
  return ACCOUNT_MAP['DEFAULT']
}

/** Detecta IVA en una línea: si menciona "IVA" y tiene un monto → iva_rate=21 */
function detectIva(concept: string): number | null {
  const u = concept.toUpperCase()
  if (u === 'IVA' || u.startsWith('IVA ') || u.includes(' IVA ') || u.includes('IVA 21'))
    return 21
  return null
}

// ─── PARSING SECCIONES ──────────────────────────────────────────────────────────

interface ParserContext {
  lines: string[]
  periodDate: string // YYYY-MM-DD (último día del mes)
  period: string     // YYYY-MM
  nextId: number
}

function mkTx(
  ctx: ParserContext,
  overrides: Partial<ParsedTransaction> & Pick<ParsedTransaction, 'description' | 'type' | 'amount' | 'businessId' | 'businessName'>
): ParsedTransaction {
  // Por defecto, TODO gasto/ingreso va a "Cuenta corriente" (id:1)
  // salvo override explícito (e.g. "EFVO" en extraordinarios)
  const defaultAccountId = 1
  const defaultAccountName = 'Cuenta corriente'
  return {
    id: `pdf-${ctx.nextId++}`,
    selected: true,
    date: overrides.date ?? ctx.periodDate,
    description: overrides.description,
    notes: overrides.notes ?? '',
    type: overrides.type,
    amount: overrides.amount,
    businessId: overrides.businessId,
    businessName: overrides.businessName,
    categoryName: overrides.categoryName ?? null,
    expenseType: overrides.expenseType ?? 'ordinario',
    currency: overrides.currency ?? 'ARS',
    exchangeRate: null, // No guardamos TC del archivo
    accountId: overrides.accountId ?? defaultAccountId,
    accountName: overrides.accountName ?? defaultAccountName,
    ivaRate: overrides.ivaRate ?? null,
  }
}

// ─── 1. GASTOS ORDINARIOS (Pág 6-8) ─────────────────────────────────────────

function parseOrdinaryExpenses(ctx: ParserContext): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  const { lines } = ctx

  // Buscar el inicio de la tabla detallada con columnas de empresa.
  // Soporta: "INFORME 01/2026 SADIA ...", "INFORME OCTUBRE 2024 SADIA ...",
  //          o header partido en varias líneas (xlsx-PDF).
  // Si no se encuentra, se busca desde el principio del documento.
  const detailStart = lines.findIndex(l =>
    /INFORME\s+\d{1,2}\/\d{4}/i.test(l) ||
    /INFORME\s+\d{2}\/\d{4}\s*SADIA/i.test(l) ||
    /INFORME\s+[A-ZÁÉÍÓÚÑ]+[`´'\s]*\d{2,4}\s*SADIA/i.test(l) ||
    /^SADIA\s+(GUEMES|PDA|EML|ÑANCUL)/i.test(l)
  )
  const searchFrom = Math.max(0, detailStart) // nunca bloquear por falta de header
  console.log('[Parser] detailStart:', detailStart, '→ searchFrom:', searchFrom)
  console.log('[Parser] Primeras 20 líneas del PDF:', lines.slice(0, 20))

  for (const sec of EXPENSE_SECTIONS) {
    // Buscar Subtotal de esta sección (después de searchFrom)
    const subtotalIdx = lines.findIndex((l, i) => {
      if (i <= searchFrom) return false
      const u = l.toUpperCase()
      return u.includes('SUBTOTAL') && u.includes(sec.subtotalKey)
    })
    if (subtotalIdx < 0) continue

    // Parsear subtotal para obtener montos por empresa
    const subtotalNums = extractNums(stripPercentages(lines[subtotalIdx]))
    // subtotalNums debería tener 6 valores: SADIA, GUEMES, PDA, ÑANCUL, EML, Total
    // o menos si algunas empresas tienen 0 y no aparecen
    let companySubtotals: Record<CompanyKey, number> = {
      SADIA: 0, GUEMES: 0, PDA: 0, ÑANCUL: 0, EML: 0,
    }
    if (subtotalNums.length >= 6) {
      // Mapeo directo: 5 empresas + total
      COMPANIES.forEach((co, i) => { companySubtotals[co.key] = subtotalNums[i] })
    } else if (subtotalNums.length >= 2) {
      // Subtotal con algunas empresas en 0
      // El último valor es el total, los anteriores son las empresas con valor > 0
      const total = subtotalNums[subtotalNums.length - 1]
      const companyVals = subtotalNums.slice(0, -1)
      const sumVals = companyVals.reduce((s, v) => s + v, 0)

      if (Math.abs(sumVals - total) < 10) {
        // Los valores suman al total → son montos de empresa
        // Determinar qué empresas tienen valores basado en el contexto de la sección
        // Asignar por orden a las empresas que tienen valores
        assignValuesToCompanies(companyVals, companySubtotals, sec.catKey)
      }
    }

    // Buscar header de la sección (antes del subtotal)
    let headerIdx = -1
    for (let i = subtotalIdx - 1; i >= Math.max(searchFrom, subtotalIdx - 100); i--) {
      const u = lines[i].toUpperCase().trim()
      if (u === sec.header || u.startsWith(sec.header + ' ') || u.startsWith(sec.header + '\t')) {
        headerIdx = i
        break
      }
    }
    if (headerIdx < 0) continue

    const cat = CATEGORY_MAP[sec.catKey]

    // Presupuesto restante por empresa — se decrementa a medida que se asignan filas.
    // Esto permite resolver la ambigüedad en filas con un solo número: si SADIA ya
    // consumió todo su presupuesto, el siguiente monto solo puede ser de GUEMES, etc.
    const remaining: Record<CompanyKey, number> = { ...companySubtotals }

    // Parsear líneas individuales entre header y subtotal
    let concept = ''
    let ivaRate: number | null = null
    for (let i = headerIdx + 1; i < subtotalIdx; i++) {
      const rawLine = lines[i].trim()
      if (!rawLine) continue

      const u = rawLine.toUpperCase()
      // Ignorar headers de columna, subtotales, resúmenes y líneas de sección
      if (u.startsWith('SUBTOTAL') || u.startsWith('TOTAL') ||
          u.startsWith('SALDO') || u.startsWith('GASTOS EXTRAORDINARIOS') ||
          u === sec.header || u.includes('INFORME') ||
          /^(SADIA|GUEMES|PDA|ÑANCUL|EML|TOTAL|INGRESOS|GASTOS)\s*$/i.test(u)) continue

      // Limpiar y extraer números
      const cleanLine = stripPercentages(stripDates(rawLine))
      const nums = extractNums(cleanLine)
      if (!nums.length) continue

      // Concepto = texto antes del primer monto real
      const firstAmt = firstAmountIndex(rawLine)
      if (firstAmt <= 0) continue
      concept = rawLine.slice(0, firstAmt).trim().replace(/[-–—]+$/, '').trim()
      if (!concept || concept.length < 2) continue

      // Saltar si el número detectado es parte de un código de referencia (Nº102, #58)
      if (/[Nn][°º]\s*$|[Nn]\s+$|#\s*$/.test(concept)) continue

      // Saltar artefactos (montos < 1.000 ARS)
      if (Math.max(...nums) < 1000) continue

      ivaRate = detectIva(concept)

      // Empresas activas en esta sección (subtotal > 0), en orden de columna
      const activeCos = COMPANIES.filter(co => companySubtotals[co.key] > 0)

      // ── Resolver empresa por presupuesto restante ─────────────────────────────
      // Funciona para filas con un solo valor: filtra candidatas que aún tienen
      // presupuesto suficiente. Si queda una sola → asignación directa.
      const resolveByBudget = (amount: number): typeof COMPANIES[number] | null => {
        const withBudget = activeCos.filter(c => remaining[c.key] + 1 >= amount)
        if (withBudget.length === 1) return withBudget[0]
        // Si hay múltiples con presupuesto, intentar keyword match entre ellas
        const kw = detectCompany(concept)
        if (withBudget.some(c => c.key === kw.key)) return kw
        // Primera activa con presupuesto en orden de columna
        return withBudget[0] ?? null
      }

      if (nums.length === 1 || (nums.length === 2 && nums[0] === nums[1])) {
        // Un solo valor efectivo → empresa única
        const amount = nums[0]
        if (amount <= 0) continue

        const co = resolveByBudget(amount)
          ?? detectCompanyForExpense(concept, remaining, amount)

        remaining[co.key] = Math.max(0, remaining[co.key] - amount)
        results.push(mkTx(ctx, {
          description: concept,
          notes: `${co.key} | ${cat.name}`,
          type: 'expense',
          amount,
          businessId: co.id,
          businessName: co.dbName,
          categoryName: cat.name,
          expenseType: 'ordinario',
          ivaRate,
        }))
      } else {
        // Múltiples números → último es total, anteriores son por empresa en orden de columna
        const total = nums[nums.length - 1]
        const companyVals = nums.slice(0, -1)
        const sumVals = companyVals.reduce((s, v) => s + v, 0)

        if (Math.abs(sumVals - total) < 10 && companyVals.length > 1) {
          // Los valores suman al total → split posicional por empresa activa
          // Columnas: SADIA(0), GUEMES(1), PDA(2), ÑANCUL(3), EML(4)
          const targetCos = companyVals.length === 5
            ? COMPANIES                                          // todas las empresas
            : companyVals.length === activeCos.length
              ? activeCos                                        // mapeo directo a activas
              : activeCos.slice(0, companyVals.length)          // primeras N activas

          companyVals.forEach((amount, idx) => {
            if (amount <= 0) return
            const co = targetCos[idx] ?? activeCos[0] ?? COMPANIES[0]
            remaining[co.key] = Math.max(0, remaining[co.key] - amount)
            results.push(mkTx(ctx, {
              description: concept,
              notes: `${co.key} | ${cat.name}`,
              type: 'expense',
              amount,
              businessId: co.id,
              businessName: co.dbName,
              categoryName: cat.name,
              expenseType: 'ordinario',
              ivaRate,
            }))
          })
        } else {
          // No suman al total → el mayor valor es el total, asignar a empresa por presupuesto
          const amount = Math.max(...nums)
          if (amount <= 0) continue
          const co = resolveByBudget(amount)
            ?? detectCompanyForExpense(concept, remaining, amount)
          remaining[co.key] = Math.max(0, remaining[co.key] - amount)
          results.push(mkTx(ctx, {
            description: concept,
            notes: `${co.key} | ${cat.name}`,
            type: 'expense',
            amount,
            businessId: co.id,
            businessName: co.dbName,
            categoryName: cat.name,
            expenseType: 'ordinario',
            ivaRate,
          }))
        }
      }
    }
  }

  return results
}

/** Detecta empresa para un gasto basándose en concepto y subtotales */
function detectCompanyForExpense(
  concept: string,
  subtotals: Record<CompanyKey, number>,
  amount: number,
): typeof COMPANIES[number] {
  // 1) Matcheo fuerte por palabras clave del concepto
  const detected = detectCompany(concept)
  const hasKeyword = /GUEMES|GÜEMES|IBC|PROMENADE|COCHERA|PDA|ALVARINAS|ÑANCUL|NANCUL|LAVALLE|ESPERANZA|RAUCH|CALEGARI|NUTRIJO|BORSANI|ECHANDI|ECOBAT|INSEMINACION|AFTOSA|SENASA|SOCIEDAD RURAL|SILVETTI|AGUACORP|ITALSUR|FERRETERIA|FUMYTAN|VETERINARIA|OLIVOS|EML|SAN ANDRES|ACEESA|COLEGIO|TRANSPORTE ESCOLAR|COMEDOR|PEUGEOT JERO|AF330/i.test(concept)
  if (hasKeyword && subtotals[detected.key] > 0) return detected

  // 2) Si sólo UNA empresa tiene subtotal > 0 en la sección, asignar a esa
  const active = COMPANIES.filter(c => subtotals[c.key] > 0)
  if (active.length === 1) return active[0]

  // 3) Si concepto sugiere empresa y esa empresa está activa, usarla
  if (subtotals[detected.key] > 0) return detected

  // 4) Buscar la empresa cuyo subtotal exacto coincide con el monto (único match)
  const exactMatches = active.filter(c => Math.abs(subtotals[c.key] - amount) < 10)
  if (exactMatches.length === 1) return exactMatches[0]

  // 5) Buscar la empresa cuyo subtotal sea >= amount y esté más cerca
  const candidates = active
    .filter(c => subtotals[c.key] >= amount)
    .sort((a, b) => subtotals[a.key] - subtotals[b.key])
  if (candidates.length > 0) return candidates[0]

  // 6) Último recurso: primera activa en orden de columna
  if (active.length > 0) return active[0]

  return COMPANIES[0] // SADIA como último default
}

/** Asigna valores a empresas cuando no tenemos todas las columnas */
function assignValuesToCompanies(
  values: number[],
  target: Record<CompanyKey, number>,
  _sectionKey: string,
): void {
  // Asignar por posición a las primeras N empresas
  // Esto es un best-effort cuando hay columnas vacías
  COMPANIES.forEach((co, i) => {
    target[co.key] = i < values.length ? values[i] : 0
  })
}

// ─── 2. INGRESOS DETALLADOS (Pág 9) ─────────────────────────────────────────

function parseIncomeDetails(ctx: ParserContext): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  const { lines } = ctx

  // Buscar inicio de sección de ingresos detallados
  const incomeStart = lines.findIndex(l =>
    /DETALLE\s+INGRESOS/i.test(l)
  )
  if (incomeStart < 0) {
    // Nuevo formato: no hay sección DETALLE INGRESOS — usar fallback directo
    console.log('[Parser] No se encontró sección DETALLE INGRESOS, usando fallback tabla resumen')
    parseIncomeFromSummaryTable(ctx, results)
    return results
  }

  // Buscar fin de sección (siguiente sección de gastos extraordinarios)
  const incomeEnd = lines.findIndex((l, i) =>
    i > incomeStart && /GASTOS EXTRAORDINARIOS/i.test(l)
  )
  const endIdx = incomeEnd > 0 ? incomeEnd : lines.length

  // ── SADIA: Facturas con Fc N°, Monto USD, TC, Total cobrado ──
  let inSadia = false
  let inGuemes = false
  let inNancul = false

  for (let i = incomeStart + 1; i < endIdx; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const u = line.toUpperCase()

    // Detectar cambio de subsección
    if (u.includes('SADIA') && (u.includes('FC') || u.includes('MONTO USD') || i === incomeStart + 1)) {
      inSadia = true; inGuemes = false; inNancul = false; continue
    }
    if (u.startsWith('GUEMES') || (u.includes('GUEMES') && u.includes('MONTO USD'))) {
      inSadia = false; inGuemes = true; inNancul = false; continue
    }
    if (u.startsWith('ÑANCUL') || u.startsWith('NANCUL') || (u.includes('ÑANCUL') && u.includes('MONTO'))) {
      inSadia = false; inGuemes = false; inNancul = true; continue
    }

    // Ignorar headers, totales, líneas vacías
    if (u.includes('TOTALES:') || u.startsWith('TOTAL') || u.startsWith('FC N') ||
        u.includes('MONTO USD') || u === 'TC' || u === 'TOTAL' ||
        u.includes('RETENCIONES') || u.includes('NOTAS')) continue

    if (inSadia) {
      // Formato: CONCEPTO [Fc N°] [USD XX.XXX] [TC] TOTAL_COBRADO [RETENCIONES] [TOTAL_FC]
      // Solo nos importa: concepto y total cobrado (ignoramos retenciones)
      const nums = extractNums(stripPercentages(line))
      if (!nums.length) continue

      const firstAmt = firstAmountIndex(line)
      if (firstAmt <= 0) continue
      let concept = line.slice(0, firstAmt).trim()
      if (!concept || concept.length < 2) continue

      // Detectar si hay monto USD
      const usdMatch = line.match(/USD\s*([\d.,]+)/i)
      let currency: 'ARS' | 'USD' = 'ARS'

      // El "total cobrado" es generalmente el primer número grande (no el USD amount)
      // Para facturas SADIA: tomamos el primer número que parece ARS (>10000)
      let amount = 0
      if (usdMatch) {
        // Hay USD → buscar el monto ARS más grande (total cobrado)
        const arsNums = nums.filter(n => n > 10000) // filtrar Fc N° y otros números chicos
        amount = arsNums.length > 0 ? arsNums[0] : nums[0]
        currency = 'ARS' // Guardamos en ARS (total cobrado)
      } else {
        amount = nums[0]
      }

      if (amount <= 0) continue

      // Limpiar concepto de números de factura
      concept = concept.replace(/\d+[-]?NC?\s*$/, '').trim()

      results.push(mkTx(ctx, {
        description: concept,
        notes: 'SADIA | Ingresos Alquileres',
        type: 'income',
        amount,
        businessId: 1,
        businessName: 'Sadia',
        categoryName: 'Alquileres',
        expenseType: 'ordinario',
      }))
    }

    if (inGuemes) {
      // Formato: Dpto Guemes XXXX [USDYYY] [TC] TOTAL
      const nums = extractNums(line)
      if (!nums.length) continue

      const firstAmt = firstAmountIndex(line)
      if (firstAmt <= 0) continue
      const concept = line.slice(0, firstAmt).trim()
      if (!concept || concept.length < 2) continue

      // Último número = monto en ARS
      const amount = nums[nums.length - 1]
      if (amount <= 0) continue

      results.push(mkTx(ctx, {
        description: concept,
        notes: 'GUEMES | Alquileres Deptos',
        type: 'income',
        amount,
        businessId: 3,
        businessName: 'Promenade',
        categoryName: 'Alquileres',
        expenseType: 'ordinario',
      }))
    }

    if (inNancul) {
      const nums = extractNums(line)
      if (!nums.length) continue
      const firstAmt = firstAmountIndex(line)
      if (firstAmt <= 0) continue
      const concept = line.slice(0, firstAmt).trim()
      if (!concept || concept.length < 2) continue
      const amount = nums[nums.length - 1]
      if (amount <= 0) continue

      results.push(mkTx(ctx, {
        description: concept,
        notes: 'ÑANCUL | Ingresos',
        type: 'income',
        amount,
        businessId: 2,
        businessName: 'Ñancul',
        categoryName: 'Otros ingresos',
        expenseType: 'ordinario',
      }))
    }
  }

  // ── Ingresos ordinarios de la tabla (Pág 6) como fallback si no hay detalles ──
  if (results.length === 0) {
    console.log('[Parser] Fallback: parseando ingresos desde tabla resumen')
    parseIncomeFromSummaryTable(ctx, results)
  }

  return results
}

/**
 * Extrae ingresos de la tabla resumen del informe.
 * Soporta tanto el formato viejo (INGRESOS ALQUILERES) como el nuevo
 * (Ingresos Alquileres, Depositos de Garantia, Otros Ingresos).
 * Para el nuevo formato multi-columna, cada celda con monto > 0 = una transacción.
 */
function parseIncomeFromSummaryTable(ctx: ParserContext, results: ParsedTransaction[]): void {
  const { lines } = ctx

  // Patrones de filas de ingreso y su empresa/categoría por columna
  // Formato nuevo: el monto de CADA empresa está en una posición fija de la fila
  // Como pdf-parse extrae el texto linearmente, usamos los números disponibles y detectamos empresa
  const INCOME_ROWS = [
    { pattern: /INGRESOS?\s*ALQUILERES/i, catKey: 'ALQUILERES', defaultCo: COMPANIES[0] },
    { pattern: /INGRESOS?\s*PDA/i,        catKey: 'OTROS_INGRESOS', defaultCo: COMPANIES[2] },
    { pattern: /INGRESOS?\s*[ÑN]ANCUL/i, catKey: 'OTROS_INGRESOS', defaultCo: COMPANIES[3] },
    { pattern: /DEPOSITOS?\s*DE\s*GARANT/i, catKey: 'OTROS_INGRESOS', defaultCo: COMPANIES[1] },
    { pattern: /OTROS\s*INGRESOS/i,       catKey: 'OTROS_INGRESOS', defaultCo: COMPANIES[4] },
    { pattern: /APORTE\s*A\s*BANCO/i,     catKey: 'OTROS_INGRESOS', defaultCo: COMPANIES[0] },
    { pattern: /APORTE\s*A\s*CAJA/i,      catKey: 'OTROS_INGRESOS', defaultCo: COMPANIES[0] },
  ]

  for (const line of lines) {
    const u = line.toUpperCase()

    // Saltar líneas de total/subtotal
    if (u.startsWith('TOTAL') || u.startsWith('SUBTOTAL') || u.startsWith('SALDO')) continue

    for (const row of INCOME_ROWS) {
      if (!row.pattern.test(u)) continue

      const nums = extractNums(stripPercentages(line))
      if (!nums.length) break

      const firstAmt = firstAmountIndex(line)
      const concept = firstAmt > 0 ? line.slice(0, firstAmt).trim() : line.trim()
      const cat = CATEGORY_MAP[row.catKey]

      // Saltar si el concepto termina en indicador de referencia (Nº, N°, #)
      if (/[Nn][°º]\s*$|#\s*$/.test(concept)) break

      // Saltar si todos los montos son < 1.000 (artefacto del parser)
      if (Math.max(...nums) < 1000) break

      // Último número = total de la fila → los anteriores son los valores por empresa
      // Mapeamos posicionalmente: [SADIA, GUEMES, PDA, ÑANCUL, EML]
      const companyNums = nums.slice(0, -1)

      if (companyNums.length === 0) {
        // Solo hay un número = no tiene desglose, usar el total con la empresa por defecto
        const co = row.defaultCo
        results.push(mkTx(ctx, {
          description: concept,
          notes: `${co.key} | Ingresos`,
          type: 'income',
          amount: nums[0],
          businessId: co.id,
          businessName: co.dbName,
          categoryName: cat.name,
          expenseType: 'ordinario',
        }))
      } else {
        // Crear una transacción por cada empresa con monto > 0
        companyNums.forEach((amount, i) => {
          if (amount <= 0) return
          const co = COMPANIES[i] ?? row.defaultCo
          results.push(mkTx(ctx, {
            description: concept,
            notes: `${co.key} | Ingresos`,
            type: 'income',
            amount,
            businessId: co.id,
            businessName: co.dbName,
            categoryName: cat.name,
            expenseType: 'ordinario',
          }))
        })
      }
      break
    }
  }
  console.log('[Parser] Ingresos desde tabla resumen:', results.length)
}

// ─── 3. GASTOS EXTRAORDINARIOS ───────────────────────────────────────────────

/**
 * Parsea gastos extraordinarios.
 * Nuevo formato (2026): solo hay una fila de subtotal por empresa.
 *   "Subtotal Gastos extraordinarios: 9.326.171 1.151.921 354.922 4.130.162 21.664.746 36.627.921"
 * Formato viejo (2024): secciones detalladas "SADIA - GASTOS EXTRAORDINARIOS".
 */
function parseExtraordinary(ctx: ParserContext): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  const { lines } = ctx

  // ── Nuevo formato: leer desde la fila subtotal ──────────────────────────────
  const subtotalLine = lines.find(l =>
    /SUBTOTAL\s+GASTOS\s+EXTRAORDINARIOS/i.test(l) ||
    /SUBTOTAL\s+GASTOS\s+EXTRA/i.test(l)
  )

  if (subtotalLine) {
    // Extraer los 5 valores por empresa (ignorar total al final)
    const nums = extractNums(stripPercentages(subtotalLine))
    // nums esperados: [SADIA, GUEMES, PDA, ÑANCUL, EML, Total] o subconjunto sin ceros
    // Descartamos el último (total) y asignamos a empresas con montos > 0
    const companyNums = nums.slice(0, -1) // quitar total
    const total = nums[nums.length - 1]

    // Intentar mapeo directo si tenemos exactamente 5 valores
    if (companyNums.length === 5) {
      COMPANIES.forEach((co, i) => {
        const amount = companyNums[i]
        if (amount <= 0) return
        results.push(mkTx(ctx, {
          description: 'Gastos Extraordinarios',
          notes: `${co.key} | Extraordinarios`,
          type: 'expense',
          amount,
          businessId: co.id,
          businessName: co.dbName,
          categoryName: 'Otros',
          expenseType: 'extraordinario',
          accountId: 1,
          accountName: 'Cuenta corriente',
        }))
      })
    } else if (companyNums.length > 0 && total > 0) {
      // Menos de 5 valores → split por posición entre las empresas del informe,
      // con flag "revisar empresa" para que el usuario verifique.
      companyNums.forEach((amount, i) => {
        if (amount <= 0) return
        const co = COMPANIES[i] ?? COMPANIES[0]
        results.push(mkTx(ctx, {
          description: 'Gastos Extraordinarios',
          notes: `${co.key} | Extraordinarios | revisar empresa`,
          type: 'expense',
          amount,
          businessId: co.id,
          businessName: co.dbName,
          categoryName: 'Otros',
          expenseType: 'extraordinario',
        }))
      })
    }

    console.log('[Parser] Extraordinarios (nuevo formato):', results.length)
    return results
  }

  // ── Formato viejo: secciones detalladas por empresa ─────────────────────────
  const EXTRA_SECTIONS = [
    { re: /^SADIA\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,              company: COMPANIES[0] },
    { re: /^GUEMES\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,             company: COMPANIES[1] },
    { re: /^PDA\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,                company: COMPANIES[2] },
    { re: /^(?:ÑANCUL|NANCUL)\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,  company: COMPANIES[3] },
    { re: /^EML\s*[-–]\s*GASTOS EXTRAORDINARIOS/i,                company: COMPANIES[4] },
  ]
  const SECTION_END_RE = /^(?:SADIA|GUEMES|PDA|ÑANCUL|NANCUL|EML|ML)\s*[-–]\s*(GASTOS|DETALLE|TOTAL)/i

  for (const { re, company } of EXTRA_SECTIONS) {
    const startIdx = lines.findIndex(l => re.test(l.trim()))
    if (startIdx < 0) continue

    let endIdx = lines.length
    for (let i = startIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (SECTION_END_RE.test(trimmed) && !re.test(trimmed)) { endIdx = i; break }
    }

    for (let i = startIdx + 1; i < endIdx; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/)
      if (!dateMatch) continue
      const date = parseDate(dateMatch[1])
      if (!date) continue

      const rest = dateMatch[2]
      if (/TOTAL/i.test(rest)) continue

      const nums = extractNums(rest)
      if (!nums.length) continue

      const firstAmt = firstAmountIndex(rest)
      const concept = firstAmt > 0 ? rest.slice(0, firstAmt).trim() : rest.trim()
      if (!concept || concept.length < 2) continue

      const usdMatch = rest.match(/USD\s*([\d.,]+)\s+([\d.,]+)/i)
      let amount: number
      if (usdMatch) {
        const usdAmt = parseArgNumber(usdMatch[1])
        const tc = parseArgNumber(usdMatch[2])
        const afterUsd = rest.slice(rest.indexOf(usdMatch[0]) + usdMatch[0].length)
        const arsNums = extractNums(afterUsd)
        amount = arsNums.length > 0 ? arsNums[0] : (tc > 0 ? usdAmt * tc : usdAmt)
      } else {
        amount = nums[0]
      }
      if (amount <= 0) continue

      const tokens = rest.split(/\s{2,}/)
      const lastToken = tokens[tokens.length - 1]?.trim() ?? ''
      const medioPago = /[A-Z]{2,}/.test(lastToken) ? lastToken : ''
      const account = medioPago ? mapAccount(medioPago) : null

      results.push(mkTx(ctx, {
        date,
        description: concept,
        notes: medioPago ? `${company.key} | ${medioPago}` : company.key,
        type: 'expense',
        amount,
        businessId: company.id,
        businessName: company.dbName,
        categoryName: 'Otros',
        expenseType: 'extraordinario',
        accountId: account?.id ?? null,
        accountName: account?.name ?? null,
      }))
    }
  }

  console.log('[Parser] Extraordinarios (formato viejo):', results.length)
  return results
}

// ─── 4. ML RETIROS (Pág 11) ─────────────────────────────────────────────────

function parseMLRetiros(ctx: ParserContext): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  const { lines } = ctx

  const mlStart = lines.findIndex(l => /^ML\s*[-–]\s*DETALLE GASTOS/i.test(l.trim()))
  if (mlStart < 0) {
    console.log('[Parser] No se encontró sección ML - DETALLE GASTOS')
    return results
  }

  // Fin de sección: próximo header o fin de archivo
  let mlEnd = lines.length
  for (let i = mlStart + 1; i < lines.length; i++) {
    const u = lines[i].trim().toUpperCase()
    if (/^(?:SADIA|GUEMES|PDA|ÑANCUL|NANCUL|EML|OCT|NOV|DIC|ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP)\s*[`´'\-–]/i.test(u) ||
        /^TOTALES/i.test(u) || /^COMISIONES/i.test(u)) {
      mlEnd = i
      break
    }
  }

  for (let i = mlStart + 1; i < mlEnd; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const u = line.toUpperCase()
    if (u.includes('FECHA') || u.includes('CONCEPTO') || u.includes('TOTAL') ||
        u.includes('MEDIO PAGO') || u === 'USD' || u === 'TC') continue

    // Detectar línea con fecha
    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/)
    if (!dateMatch) continue
    const date = parseDate(dateMatch[1])
    if (!date) continue

    const rest = dateMatch[2]
    const nums = extractNums(rest)
    if (!nums.length) continue

    const firstAmt = firstAmountIndex(rest)
    const concept = firstAmt > 0 ? rest.slice(0, firstAmt).trim() : rest.trim()
    if (!concept || concept.length < 2) continue

    const amount = nums[0]
    if (amount <= 0) continue

    // Medio de pago
    const tokens = rest.split(/\s{2,}/)
    const lastToken = tokens[tokens.length - 1]?.trim() ?? ''
    const medioPago = /[A-Z]{2,}/.test(lastToken) ? lastToken : ''
    const account = medioPago ? mapAccount(medioPago) : null

    results.push(mkTx(ctx, {
      date,
      description: concept,
      notes: medioPago ? `ML | ${medioPago}` : 'ML',
      type: 'expense',
      amount,
      businessId: 4,  // EML
      businessName: 'EML',
      categoryName: 'Otros',
      expenseType: 'extraordinario',
      accountId: account?.id ?? null,
      accountName: account?.name ?? null,
    }))
  }

  return results
}

// ─── PARSER PRINCIPAL ───────────────────────────────────────────────────────────

export async function parsePdfReport(
  buffer: Buffer,
  period: string,
  userExchangeRate: number,
  mode: 'detail' | 'summary' = 'detail',
): Promise<ParsedTransaction[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(buffer)
    const rawText: string = data.text
    console.log('[Parser] Páginas:', data.numpages, '| Chars:', rawText.length)

    // Detectar período
    const detectedPeriod = detectPeriod(rawText)
    const effectivePeriod = period || detectedPeriod || ''
    if (!effectivePeriod) throw new Error('No se pudo detectar el período del informe')
    console.log('[Parser] Período:', effectivePeriod)

    // Fecha = último día del mes
    const periodDate = lastDayOfMonth(effectivePeriod)
    console.log('[Parser] Fecha asignada:', periodDate)

    const lines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('*')) // ignorar notas/comentarios con asteriscos

    const ctx: ParserContext = {
      lines,
      periodDate,
      period: effectivePeriod,
      nextId: 1,
    }

    // Parsear todas las secciones
    const ordinaryExpenses = parseOrdinaryExpenses(ctx)
    console.log('[Parser] Gastos ordinarios:', ordinaryExpenses.length)

    const incomeDetails = parseIncomeDetails(ctx)
    console.log('[Parser] Ingresos:', incomeDetails.length)

    const extraordinary = parseExtraordinary(ctx)
    console.log('[Parser] Gastos extraordinarios:', extraordinary.length)

    const mlRetiros = parseMLRetiros(ctx)
    console.log('[Parser] ML retiros:', mlRetiros.length)

    const allResults = [...incomeDetails, ...ordinaryExpenses, ...extraordinary, ...mlRetiros]

    // Re-numerar IDs
    allResults.forEach((t, i) => { t.id = `pdf-${i + 1}` })

    console.log('[Parser] Total transacciones:', allResults.length)
    return allResults
  } catch (err) {
    console.error('[Parser] Error:', err)
    throw err
  }
}
