/**
 * ai-parser.ts
 * Parser inteligente basado en Claude para importación de documentos financieros.
 * Reemplaza los parsers rígidos de PDF/Excel con extracción semántica flexible.
 */

import Anthropic from '@anthropic-ai/sdk'
import { type ParsedTransaction } from './excel-parser'

const client = new Anthropic()

interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
}

interface Business {
  id: number
  name: string
}

export interface AIParseResult {
  transactions: ParsedTransaction[]
  detectedPeriod?: string
  detectedExchangeRate?: number
  notes?: string
  discardedCount?: number      // NUEVO: cantidad de filas omitidas
  discardReasons?: string[]    // NUEVO: razones (max 5 ejemplos)
}

/**
 * Parsea un documento financiero (texto extraído de PDF o CSV de Excel) usando Claude.
 * Devuelve transacciones estructuradas listas para el flujo de importación.
 */
export async function parseDocumentWithClaude(
  documentText: string,
  period: string,           // YYYY-MM
  exchangeRate: number,     // ARS/USD configurado por el usuario
  categories: Category[],
  businesses: Business[],
  mode: 'summary' | 'detail' = 'detail'
): Promise<AIParseResult> {

  const incomeCategories = categories
    .filter(c => c.type === 'income')
    .map(c => `• ${c.name} (id: ${c.id})`)
    .join('\n')

  const expenseCategories = categories
    .filter(c => c.type === 'expense')
    .map(c => `• ${c.name} (id: ${c.id})`)
    .join('\n')

  const businessList = businesses
    .map(b => `• ${b.name} (id: ${b.id})`)
    .join('\n')

  const modeInstructions =
    mode === 'summary'
      ? 'MODO RESUMEN: Extraé únicamente los subtotales por categoría y empresa. No extraigas líneas individuales. Si hay SUBTOTAL PROVEEDORES, SUBTOTAL SUELDOS, etc., usá esos valores.'
      : 'MODO DETALLADO: Extraé cada transacción individual. Si hay una tabla con filas de sueldos, proveedores, servicios, etc., creá una fila por cada concepto individual.'

  const systemPrompt = `Sos un asistente especializado en procesar documentos financieros para Grupo Lubrano, un family office argentino. Tu única tarea es extraer transacciones del documento y devolver un JSON válido.

EMPRESAS DEL GRUPO (columnas del informe):
${businessList}
• GUEMES en el documento = Promenade (id: 3) — siempre mapear así

CATEGORÍAS DE INGRESOS DISPONIBLES:
${incomeCategories}

CATEGORÍAS DE GASTOS DISPONIBLES:
${expenseCategories}

CUENTA POR DEFECTO: Cuenta corriente (id: 1, name: "Cuenta corriente") — usar para todas las transacciones.

═══════════════════════════════════════════════════
FORMATO ESPECIAL: INFORME GRUPO LUBRANO (tabla multi-columna)
═══════════════════════════════════════════════════

El documento es una tabla con columnas: CONCEPTO | SADIA | GUEMES | PDA | ÑANCUL | EML | TOTAL

REGLA FUNDAMENTAL — UNA TRANSACCIÓN POR CELDA:
- Cada fila puede tener montos en VARIAS columnas de empresa simultáneamente
- Cada celda con monto > 0 = UNA transacción separada
- Ejemplo: "OSDE DIRECTORIO | SADIA: 1.010.725 | EML: 1.302.864"
  → Transacción 1: businessId=1 (Sadia), amount=1010725
  → Transacción 2: businessId=4 (EML), amount=1302864
- NUNCA usar la columna TOTAL como monto de una transacción
- NUNCA combinar montos de distintas empresas en una sola transacción

MAPEO DE COLUMNAS A EMPRESAS:
- Columna SADIA   → businessId=1, businessName="Sadia"
- Columna GUEMES  → businessId=3, businessName="Promenade"
- Columna PDA     → businessId=5, businessName="PDA"
- Columna ÑANCUL  → businessId=2, businessName="Ñancul"
- Columna EML     → businessId=4, businessName="EML"

MAPEO DE SECCIONES A CATEGORÍAS:
Usá el nombre de la sección del informe como categoryName. Buscá el id que mejor coincida en las listas de arriba:
- Sección "PROVEEDORES" → buscar categoría "Proveedores" o similar
- Sección "SUELDOS" / "SUELDOS Y CARGAS SOCIALES" → buscar "Sueldos" o similar
- Sección "SERVICIOS" → buscar "Servicios" o similar
- Sección "PLANES FINANCIACION" → buscar "Planes" o similar
- Sección "IMPUESTOS" → buscar "Impuestos" o similar
- Sección "SEGUROS" → buscar "Seguros" o similar
- Sección "VARIOS" → buscar "Varios" o similar
- Sección "INGRESOS" → usar categoría de ingresos correspondiente
- Si no encontrás match exacto: categoryId=null, categoryName="[nombre de sección]"

GASTOS EXTRAORDINARIOS:
- Al final del documento puede haber una sección "GASTOS EXTRAORDINARIOS" con subtotales por empresa
- Importar cada celda con monto > 0 como una transacción con:
  - description: "Gastos Extraordinarios"
  - expenseType: "extraordinario"
  - categoryName según la categoría más apropiada de la lista

INGRESOS:
- Sección "INGRESOS" al inicio del documento: extraer cada fila con monto > 0
- type: "income"
- ivaRate: null siempre para ingresos

═══════════════════════════════════════════════════
REGLAS GENERALES
═══════════════════════════════════════════════════

1. NÚMEROS: formato argentino — punto=miles, coma=decimal
   Ej: "1.445.170" → 1445170 | "1.234,56" → 1234.56

2. 🔴 CRÍTICO — MONTOS PROHIBIDOS:
   - Si una celda está vacía, en blanco o es 0 → NO crear transacción
   - NUNCA inventar montos
   - NUNCA usar la columna TOTAL como monto
   - Solo incluir transacciones con monto ≥ 1 (claramente visible en el documento)

3. OMITIR completamente:
   - Filas de SUBTOTALES (Subtotal Proveedores, Subtotal Sueldos, etc.)
   - Filas de TOTALES GENERALES (Total Ingresos, Total Gastos, Saldo Neto, etc.)
   - Filas con monto = 0 en todas las columnas
   - Títulos de sección sin monto

4. FECHAS: usar el último día del mes del período. Ej: período 2026-01 → "2026-01-31"

5. currency: "ARS" siempre salvo que el concepto mencione explícitamente USD/U$S/DOLAR

6. expenseType:
   - "ordinario" para gastos corrientes (sueldos, servicios, proveedores, seguros, impuestos)
   - "extraordinario" solo para la sección "GASTOS EXTRAORDINARIOS"

7. ivaRate: null para todos (este tipo de informe no desglosa IVA por línea)

8. accountId: 1 (Cuenta corriente) para todas las transacciones

9. ${modeInstructions}

FORMATO DE RESPUESTA — SOLO JSON, sin markdown, sin texto adicional:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Concepto claro",
      "notes": "",
      "type": "income" | "expense",
      "amount": 1234567.89,
      "businessId": 1,
      "businessName": "Sadia",
      "categoryId": 5,
      "categoryName": "Sueldos y Cargas Sociales",
      "expenseType": "ordinario",
      "currency": "ARS",
      "exchangeRate": ${exchangeRate},
      "ivaRate": null,
      "accountId": 1,
      "accountName": "Cuenta corriente"
    }
  ],
  "detectedPeriod": "YYYY-MM",
  "detectedExchangeRate": null,
  "notes": "Observaciones"
}`

  const userPrompt = `Período de referencia: ${period}
Tipo de cambio configurado: ${exchangeRate} ARS/USD

INSTRUCCIÓN CLAVE: Este documento es una tabla multi-columna con empresas (SADIA, GUEMES, PDA, ÑANCUL, EML).
Cada fila puede tener montos en múltiples columnas → generá UNA transacción por cada celda con monto > 0.
GUEMES = Promenade (id: 3). NO uses la columna TOTAL. Omitir filas con monto = 0.

DOCUMENTO:
${documentText}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude')
  }

  // Extraer JSON aunque venga con texto adicional o bloques de código
  let jsonStr = content.text.trim()
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No se encontró JSON en la respuesta de Claude')
  }
  jsonStr = jsonMatch[0]

  let parsed: {
    transactions?: RawTransaction[]
    detectedPeriod?: string
    detectedExchangeRate?: number
    notes?: string
  }

  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error(`Error parseando JSON de Claude: ${e}`)
  }

  // Helper para validar que el monto sea un número válido y > 0
  const isValidTransactionAmount = (amount: number): boolean => {
    return (
      typeof amount === 'number' &&
      !isNaN(amount) &&
      amount > 0
    )
  }

  // Mapear y filtrar transacciones
  const allRawTransactions = parsed.transactions ?? []
  const transactions: ParsedTransaction[] = allRawTransactions
    .map((t, index) => ({
      id: `ai-${index + 1}`,
      selected: true,
      date: sanitizeDate(t.date, period),
      description: String(t.description ?? '').trim(),
      notes: String(t.notes ?? '').trim(),
      type: t.type === 'income' ? 'income' : 'expense',
      amount: Math.abs(Number(t.amount) || 0),
      businessId: Number(t.businessId) || businesses[0]?.id || 1,
      businessName: String(t.businessName ?? businesses[0]?.name ?? ''),
      categoryName: t.categoryName ? String(t.categoryName) : null,
      expenseType: t.expenseType === 'extraordinario' ? 'extraordinario' : 'ordinario',
      currency: t.currency === 'USD' ? 'USD' : 'ARS',
      exchangeRate: t.exchangeRate ? Number(t.exchangeRate) : null,
      ivaRate: t.type !== 'income' && t.ivaRate != null ? Number(t.ivaRate) || null : null,
      accountId: t.accountId != null ? Number(t.accountId) || null : null,
      accountName: t.accountName ? String(t.accountName) : null,
    } as ParsedTransaction))
    .filter((t) => {
      const amountNum = Number(t.amount) || 0
      // Rechazar montos inválidos o <= 0
      if (!isValidTransactionAmount(amountNum)) {
        return false
      }
      // Rechazar descripción vacía
      if (!t.description || !t.description.trim()) {
        return false
      }
      return true
    })

  // Rastrear filas descartadas (FASE 3)
  const validTransactionCount = transactions.length
  const discardedCount = allRawTransactions.length - validTransactionCount

  const discardReasons: string[] = []
  if (discardedCount > 0) {
    for (const raw of allRawTransactions) {
      const amountNum = Number(raw.amount) || 0
      const description = String(raw.description || '').trim()

      // Validar si esta fila fue descartada
      if (amountNum <= 0 || !raw.amount || !description) {
        discardReasons.push(
          `"${description.substring(0, 40) || '(sin descripción)'}" (sin monto válido)`
        )
      }
      if (discardReasons.length >= 5) break // Max 5 ejemplos
    }
  }

  return {
    transactions,
    detectedPeriod: parsed.detectedPeriod,
    detectedExchangeRate: parsed.detectedExchangeRate ?? undefined,
    notes: parsed.notes,
    discardedCount: discardedCount > 0 ? discardedCount : undefined,
    discardReasons: discardReasons.length > 0 ? discardReasons : undefined,
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface RawTransaction {
  date?: string
  description?: string
  notes?: string
  type?: string
  amount?: number | string
  businessId?: number | string
  businessName?: string
  categoryId?: number | string | null
  categoryName?: string | null
  expenseType?: string
  currency?: string
  exchangeRate?: number | string | null
  ivaRate?: number | string | null
  accountId?: number | string | null
  accountName?: string | null
}

function sanitizeDate(date: string | undefined, period: string): string {
  if (!date) return `${period}-01`
  // Ensure YYYY-MM-DD format
  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return date
  // Handle DD/MM/YYYY
  const arMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (arMatch) return `${arMatch[3]}-${arMatch[2]}-${arMatch[1]}`
  // Fallback to period start
  return `${period}-01`
}
