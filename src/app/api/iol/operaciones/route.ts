import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/iol-session'
import { getOperaciones } from '@/lib/iol-client'

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

  const params = request.nextUrl.searchParams
  const filters = {
    simbolo: params.get('simbolo') ?? undefined,
    desde: params.get('desde') ?? undefined,
    hasta: params.get('hasta') ?? undefined,
    estado: params.get('estado') ?? undefined,
  }

  try {
    const operaciones = await getOperaciones(accessToken, filters)
    return NextResponse.json(operaciones)
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Error al obtener operaciones'
    return NextResponse.json({ error: message }, { status })
  }
}
