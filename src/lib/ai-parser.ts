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

  const systemPrompt = `Sos un asistente especializado en procesar documentos financieros para Grupo Lubrano, un family office argentino. Tu única tarea en este mensaje es extraer transacciones del documento y devolver un JSON válido.

EMPRESAS DEL GRUPO:
${businessList}

CATEGORÍAS DE INGRESOS DISPONIBLES:
${incomeCategories}

CATEGORÍAS DE GASTOS DISPONIBLES:
${expenseCategories}

CUENTAS DISPONIBLES:
• Cuenta corriente (id: 1)
• Caja de ahorro (id: 2)
• Efectivo (id: 3)

REGLAS DE EXTRACCIÓN:
1. Números argentinos: punto = miles, coma = decimal. Ej: "1.445.170" → 1445170 | "1.234,56" → 1234.56
2. Si el monto menciona "USD", "U$S" o "DOLAR" → currency="USD", sino currency="ARS"
3. type: "income" para ingresos/entradas, "expense" para gastos/egresos/salidas
4. expenseType: "ordinario" para gastos recurrentes (sueldos, servicios, alquileres) | "extraordinario" para gastos no recurrentes, ventas de activos, inversiones
4.1. 🔴 CRÍTICO - Omisión de filas sin monto:
  - Si una fila tiene descripción pero NO tiene monto (vacío/borroso/ilegible):
    → NO inventes monto
    → NO incluyas en el JSON de respuesta
    → Silenciosamente omitida
  - Solo incluír transacciones con monto ≥ 0.01 claramente visible en el documento
5. Ignorá filas que sean:
  - TOTALES GENERALES, SALDO GENERAL, SUBTOTALES (sumas de otras filas)
  - ENCABEZADOS o TÍTULOS DE SECCIÓN (sin monto real)
  - Descripción SIN monto visible = OMITIR completamente, NO inventés montos
6. Si no encontrás la empresa en el concepto, usá el businessId más apropiado según el contexto
7. Para la categoría: usá el id y name de las listas de arriba. Si no hay match claro, dejá categoryId null y categoryName null
8. exchangeRate: si el documento tiene "TIPO CAMBIO: X" usá ese valor. Sino usá ${exchangeRate}
9. ${modeInstructions}
10. Todas las fechas en formato YYYY-MM-DD. Si solo conocés el mes, usá el último día del mes
11. ivaRate: detectar tasa de IVA aplicable al gasto. Solo para gastos (expenses):
    - Si la descripción menciona "IVA 21%", "21%", o es un servicio típico → ivaRate: 21
    - Si menciona "IVA 10.5%", "10,5%" → ivaRate: 10.5
    - Si es sueldo, retiro, transferencia interna o sin IVA → ivaRate: null
    - Para ingresos: siempre ivaRate: null
12. accountId: detectar la cuenta desde el medio de pago:
    - "EFVO", "Efectivo", "Caja", "Cash" → accountId: 3 (Efectivo)
    - "CC", "Cuenta corriente", "Transferencia", "Banco", "Débito", "Tarjeta" → accountId: 1 (Cuenta corriente)
    - "CA", "Caja de ahorro" → accountId: 2 (Caja de ahorro)
    - Sin información de medio de pago → accountId: null

FORMATO DE RESPUESTA:
Devolvé SOLAMENTE el JSON, sin texto previo ni posterior, sin markdown, sin bloques de código:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Concepto claro y descriptivo",
      "notes": "Info adicional, método de pago, etc.",
      "type": "income" | "expense",
      "amount": 1234567.89,
      "businessId": 1,
      "businessName": "Sadia",
      "categoryId": 5,
      "categoryName": "Sueldos y Cargas Sociales",
      "expenseType": "ordinario",
      "currency": "ARS",
      "exchangeRate": 1030,
      "ivaRate": 21,
      "accountId": 1,
      "accountName": "Cuenta corriente"
    }
  ],
  "detectedPeriod": "YYYY-MM",
  "detectedExchangeRate": 1030,
  "notes": "Observaciones sobre el documento o problemas encontrados"
}

NOTA CRÍTICA: Si una fila tiene descripción pero no tiene monto (vacío, borroso, ilegible):
- NO la incluyas en el array "transactions"
- No devuelvas "amount": 0 ni "amount": null
- Omitida silenciosamente del resultado
- Podés mencionar en "notes" si hubo filas omitidas por falta de monto`

  const userPrompt = `Período de referencia: ${period}
Tipo de cambio configurado: ${exchangeRate} ARS/USD

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
