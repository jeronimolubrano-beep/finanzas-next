/**
 * /api/verify
 * Two-phase comparison:
 *   1. Extract report line items from the document (compact output)
 *   2. Compare extracted items against DB transactions (inconsistencies only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export const maxDuration = 60

const anthropic = new Anthropic()

// ── Helpers ───────────────────────────────────────────────────────────────────

function compressText(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')          // collapse horizontal whitespace
    .replace(/\n[ \t]+/g, '\n')       // strip leading spaces on each line
    .split('\n')
    .filter(l => l.trim().length > 0) // remove blank lines
    .join('\n')
    .trim()
}

function parseJSON(raw: string): Record<string, unknown> {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No se encontró JSON en la respuesta del modelo')
  text = text.slice(start, end + 1)

  try { return JSON.parse(text) } catch { /* continue */ }

  // Sanitize unescaped newlines / quotes inside string values
  const sanitized = text.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (_m, inner: string) =>
    `: "${inner.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ')}"`)
  return JSON.parse(sanitized)
}

function callClaude(prompt: string, maxTokens = 8000) {
  return anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const month = (formData.get('month') as string | null)?.trim()

    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    if (!month) return NextResponse.json({ error: 'Falta el mes (YYYY-MM)' }, { status: 400 })

    // ── 1. Extraer texto del documento ───────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase()
    let rawText = ''

    if (ext === 'pdf') {
      const pdfData = await pdfParse(buffer)
      rawText = pdfData.text
    } else if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const parts: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false })
        if (csv.trim()) parts.push(`--- ${sheetName} ---\n${csv}`)
      }
      rawText = parts.join('\n\n')
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Usá .pdf, .xlsx o .xls' }, { status: 415 })
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'El archivo no contiene texto extraíble' }, { status: 422 })
    }

    const documentText = compressText(rawText).slice(0, 18000)

    // ── 2. Consultar DB ──────────────────────────────────────────────────────
    const supabase = await createClient()
    const [{ data: transactions, error: dbError }, { data: businesses }] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, date, description, amount, type, currency, status, expense_type, categories(name), businesses(name)')
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`)
        .order('date'),
      supabase.from('businesses').select('id, name'),
    ])

    if (dbError) return NextResponse.json({ error: 'Error Supabase: ' + dbError.message }, { status: 500 })

    const bizList = (businesses ?? []).map(b => `${b.name}(id:${b.id})`).join(',')

    // Compact tx representation — only what Claude needs for comparison
    const txList = (transactions ?? []).map(t => {
      const bizName = Array.isArray(t.businesses) ? t.businesses[0]?.name : (t.businesses as { name?: string } | null)?.name
      const catName = Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name?: string } | null)?.name
      return {
        id: t.id,
        desc: t.description,
        amt: Number(t.amount),
        type: t.type,
        biz: bizName ?? null,
        cat: catName ?? null,
      }
    })

    const [year, mon] = month.split('-')
    const monthLabel = `${mon}/${year}`
    const lastDay = `${month}-31`

    // ── FASE 1: Extraer items del informe ────────────────────────────────────
    const phase1 = await callClaude(`Extraé TODOS los items con monto > 0 del siguiente informe financiero mensual.
El informe tiene columnas por empresa: SADIA, GUEMES, PDA, NANCUL, EML.
Cada celda con monto > 0 es un item separado con su empresa correspondiente.
Ignora filas de subtotales, totales y filas con todos los montos en 0.

Respondé SOLO con JSON válido, sin markdown:
{"items":[{"desc":"descripcion del concepto","emp":"SADIA","monto":1234567,"sec":"SUELDOS"}]}

Secciones posibles: INGRESOS, PROVEEDORES, SUELDOS, SERVICIOS, PLANES, IMPUESTOS, SEGUROS, VARIOS, EXTRAORDINARIOS

INFORME ${monthLabel}:
${documentText}`)

    if (phase1.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: 'El informe es demasiado extenso para procesarlo. Intentá con el xlsx original.' }, { status: 500 })
    }

    const p1Block = phase1.content.find(b => b.type === 'text')
    if (!p1Block || p1Block.type !== 'text') {
      return NextResponse.json({ error: 'Error en extracción del informe' }, { status: 500 })
    }

    console.log('[verify/phase1] primeros 300:', p1Block.text.slice(0, 300))

    let reportItems: { desc: string; emp: string; monto: number; sec: string }[] = []
    try {
      const p1 = parseJSON(p1Block.text)
      reportItems = (p1.items as typeof reportItems) ?? []
    } catch (e) {
      console.error('[verify/phase1] parse error:', p1Block.text.slice(0, 1000))
      return NextResponse.json({ error: 'No se pudo extraer la estructura del informe. Intentá de nuevo.' }, { status: 500 })
    }

    if (reportItems.length === 0) {
      return NextResponse.json({ error: 'No se encontraron items en el informe. Verificá que el archivo sea el informe correcto.' }, { status: 422 })
    }

    console.log(`[verify/phase1] ${reportItems.length} items extraídos del informe`)

    // ── FASE 2: Comparar contra DB ───────────────────────────────────────────
    const phase2 = await callClaude(`Sos un auditor. Comparás items de un informe mensual contra transacciones de la DB.
Reportá ÚNICAMENTE las inconsistencias reales. Si un item matchea bien con la DB, NO lo incluyas en la respuesta.

EMPRESAS DB (nombre->id): ${bizList}
MAPEO columnas informe: SADIA->Sadia, GUEMES->Promenade, PDA->PDA, NANCUL->Nancul, EML->EML

ITEMS DEL INFORME (${reportItems.length} items):
${JSON.stringify(reportItems)}

TRANSACCIONES EN DB mes ${month} (${txList.length} transacciones):
${JSON.stringify(txList)}

Tipos de inconsistencia:
1. faltante_en_db: item del informe sin match en DB
2. extra_en_db: tx en DB sin match en el informe
3. monto_diferente: match pero montos distintos (tolerancia +-1 ARS)
4. empresa_incorrecta: existe pero en empresa equivocada
5. consolidado: 1 item del informe = multiples tx en DB o viceversa (solo si hay diferencia real)

Reglas de matching:
- Tolerancia +-1 ARS por redondeo
- Un item puede matchear varias tx si sus montos suman el total del item
- Matcheá por similitud semántica del nombre
- Si el tipo es "consolidado" y los montos suman correctamente, NO es inconsistencia — no lo incluyas

suggested_fix por tipo:
- faltante_en_db: {"op":"insert","date":"${lastDay}","description":"...","amount":N,"type":"expense","business_id":N,"currency":"ARS","status":"percibido","expense_type":"ordinario"}
- extra_en_db: {"op":"delete","ids":[N]}
- monto_diferente: {"op":"update_amount","id":N,"amount":N}
- empresa_incorrecta: {"op":"update_business","ids":[N],"business_id":N}
- consolidado (con diferencia): {"op":"none","reason":"descripcion breve"}

IMPORTANTE:
- Solo incluí las inconsistencias reales, no los matches correctos
- El campo "nota" debe ser texto breve (max 80 chars) sin comillas internas
- Sin markdown, solo JSON válido

{"resumen":"texto breve","totales_informe":{"total_ingresos":0,"total_gastos_ordinarios":0,"total_gastos_extraordinarios":0},"totales_db":{"total_ingresos":0,"total_gastos":0},"inconsistencias":[{"tipo":"faltante_en_db","severidad":"alta","descripcion_informe":"nombre","empresa_informe":"SADIA","monto_informe":0,"db_ids":[],"monto_db":null,"diferencia":null,"detalle":"texto breve","suggested_fix":{"op":"insert","date":"${lastDay}","description":"nombre","amount":0,"type":"expense","business_id":1,"currency":"ARS","status":"percibido","expense_type":"ordinario"}}]}`)

    if (phase2.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: 'Demasiadas inconsistencias para procesar de una vez. Intentá filtrar por empresa.' }, { status: 500 })
    }

    const p2Block = phase2.content.find(b => b.type === 'text')
    if (!p2Block || p2Block.type !== 'text') {
      return NextResponse.json({ error: 'Error en comparación con la DB' }, { status: 500 })
    }

    console.log('[verify/phase2] primeros 300:', p2Block.text.slice(0, 300))

    let result: Record<string, unknown>
    try {
      result = parseJSON(p2Block.text)
    } catch (e) {
      console.error('[verify/phase2] parse error:', p2Block.text.slice(0, 2000))
      return NextResponse.json({ error: 'No se pudo interpretar la comparación. Intentá de nuevo.' }, { status: 500 })
    }

    // Sort: alta → media → baja
    const order: Record<string, number> = { alta: 0, media: 1, baja: 2 }
    const incs = result.inconsistencias as Array<{ severidad: string }> | undefined
    if (Array.isArray(incs)) {
      incs.sort((a, b) => (order[a.severidad] ?? 2) - (order[b.severidad] ?? 2))
    }

    result.db_transaction_count = txList.length
    result.report_item_count = reportItems.length
    result.month = month

    return NextResponse.json(result)
  } catch (error) {
    console.error('[verify] Error:', error)
    return NextResponse.json({ error: 'Error inesperado: ' + (error as Error).message }, { status: 500 })
  }
}
