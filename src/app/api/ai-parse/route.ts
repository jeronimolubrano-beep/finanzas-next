/**
 * /api/ai-parse
 * Endpoint de importación inteligente: extrae texto del archivo y lo procesa con Claude.
 * Acepta PDF o Excel (xlsx/xls). Compatible con el mismo flujo de preview del import page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseDocumentWithClaude } from '@/lib/ai-parser'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// pdf-parse necesita importarse con require para evitar problemas de ESM en Next.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export const maxDuration = 60 // segundos — Claude puede tardar en documentos grandes

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parsear form data ──────────────────────────────────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const period = (formData.get('period') as string | null) ?? ''
    const exchangeRate = Number(formData.get('exchangeRate') ?? 0)
    const mode = ((formData.get('mode') as string | null) ?? 'detail') as 'summary' | 'detail'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }
    if (!period) {
      return NextResponse.json({ error: 'Falta el período (YYYY-MM)' }, { status: 400 })
    }

    // ── 2. Cargar categorías y empresas desde Supabase ───────────────────────
    const supabase = await createClient()
    const [{ data: categories, error: catErr }, { data: businesses, error: bizErr }] =
      await Promise.all([
        supabase.from('categories').select('id, name, type'),
        supabase.from('businesses').select('id, name'),
      ])

    if (catErr || bizErr) {
      console.error('Supabase error:', catErr ?? bizErr)
      return NextResponse.json({ error: 'Error al cargar configuración' }, { status: 500 })
    }

    // ── 3. Extraer texto del archivo ─────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase()
    let documentText = ''

    if (ext === 'pdf') {
      try {
        const pdfData = await pdfParse(buffer)
        documentText = pdfData.text
      } catch (e) {
        return NextResponse.json({ error: `Error leyendo el PDF: ${e}` }, { status: 422 })
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const parts: string[] = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          // sheet_to_csv preserva estructura tabular mejor que sheet_to_txt
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
          if (csv.trim()) parts.push(`--- Hoja: ${sheetName} ---\n${csv}`)
        }
        documentText = parts.join('\n\n')
      } catch (e) {
        return NextResponse.json({ error: `Error leyendo el Excel: ${e}` }, { status: 422 })
      }
    } else {
      return NextResponse.json(
        { error: 'Formato no soportado. Usá .pdf, .xlsx o .xls' },
        { status: 415 }
      )
    }

    if (!documentText.trim()) {
      return NextResponse.json(
        { error: 'El archivo no contiene texto extraíble' },
        { status: 422 }
      )
    }

    // ── 4. Limitar texto para no exceder contexto (aprox. 150k tokens) ───────
    const MAX_CHARS = 400_000
    if (documentText.length > MAX_CHARS) {
      documentText = documentText.slice(0, MAX_CHARS) + '\n[... documento truncado ...]'
    }

    // ── 5. Llamar al parser de Claude ────────────────────────────────────────
    const result = await parseDocumentWithClaude(
      documentText,
      period,
      exchangeRate,
      categories ?? [],
      businesses ?? [],
      mode
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[ai-parse] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
