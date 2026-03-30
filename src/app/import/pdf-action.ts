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

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const transactions = await parsePdfReport(buffer, period, exchangeRate)

    if (transactions.length === 0) {
      return { error: 'No se encontraron transacciones en el PDF' }
    }

    return { transactions }
  } catch (err) {
    console.error('Error parsing PDF:', err)
    return { error: `Error al parsear PDF: ${err instanceof Error ? err.message : 'Error desconocido'}` }
  }
}
