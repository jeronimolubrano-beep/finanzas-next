'use server'

import { parsePdfReport } from '@/lib/pdf-parser'
import type { ParsedTransaction } from '@/lib/excel-parser'

export async function parsePdfFile(
  formData: FormData,
  period: string,
  exchangeRate: number,
): Promise<{ transactions?: ParsedTransaction[]; error?: string }> {
  try {
    const file = formData.get('file') as File | null
    if (!file) {
      return { error: 'No se recibió archivo' }
    }

    console.log('[PDF] Iniciando parseo:', { fileName: file.name, size: file.size, period, exchangeRate })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log('[PDF] Buffer creado:', buffer.length, 'bytes')

    const transactions = await parsePdfReport(buffer, period, exchangeRate)
    console.log('[PDF] Transacciones parseadas:', transactions.length)

    if (transactions.length === 0) {
      return { error: 'No se encontraron transacciones en el PDF. Verifica que sea un informe válido de ingresos/egresos.' }
    }

    return { transactions }
  } catch (err) {
    console.error('[PDF] Error completo:', err)
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PDF] Stack:', err instanceof Error ? err.stack : 'N/A')
    return { error: `Error al parsear PDF: ${msg}` }
  }
}
