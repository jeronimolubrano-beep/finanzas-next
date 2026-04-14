import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/iol-session'
import { getSerieHistorica } from '@/lib/iol-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(request: NextRequest) {
  const response = NextResponse.json({})
  const accessToken = await getAccessToken(request, response)

  if (!accessToken) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const mercado = params.get('mercado')
  const simbolo = params.get('simbolo')
  const from = params.get('from')
  const to = params.get('to')

  if (!mercado || !simbolo || !from || !to) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: mercado, simbolo, from, to' },
      { status: 400 },
    )
  }

  try {
    const serie = await getSerieHistorica(accessToken, mercado, simbolo, from, to)
    const res = NextResponse.json(serie)
    response.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
    return res
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Error al obtener serie histórica'
    return NextResponse.json({ error: message }, { status })
  }
}
