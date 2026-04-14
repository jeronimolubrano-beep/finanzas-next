import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/iol-session'
import { getPortfolio } from '@/lib/iol-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('iol_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const accessToken = await getAccessToken(sessionId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
  }

  try {
    const positions = await getPortfolio(accessToken)
    return NextResponse.json(positions)
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Error al obtener portfolio'
    return NextResponse.json({ error: message }, { status })
  }
}
