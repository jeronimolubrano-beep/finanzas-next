import { NextRequest, NextResponse } from 'next/server'
import { parsePdfReport } from '@/lib/pdf-parser'

// Aumentar el tiempo máximo para PDFs grandes
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const period = formData.get('period') as string ?? ''
    const exchangeRate = parseFloat(formData.get('exchangeRate') as string ?? '0') || 0

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    console.log('[API/parse-pdf] Archivo recibido:', file.name, file.size, 'bytes')
    console.log('[API/parse-pdf] Período:', period, '| TC:', exchangeRate)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const transactions = await parsePdfReport(buffer, period, exchangeRate)

    console.log('[API/parse-pdf] Transacciones parseadas:', transactions.length)

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron transacciones en el PDF. Verificá que sea un informe de ingresos/egresos válido.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ transactions })
  } catch (err) {
    console.error('[API/parse-pdf] Error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error al procesar PDF: ${msg}` }, { status: 500 })
  }
}
