import { NextRequest, NextResponse } from 'next/server'
import { getTCHistorico } from '@/lib/tc-history'

export const maxDuration = 15

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period')

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { error: 'Parámetro period requerido en formato YYYY-MM' },
      { status: 400 }
    )
  }

  try {
    const tc = await getTCHistorico(period)
    return NextResponse.json(tc)
  } catch (err) {
    console.error('[TC History]', err)
    return NextResponse.json(
      { error: 'Error al obtener tipo de cambio histórico' },
      { status: 500 }
    )
  }
}
