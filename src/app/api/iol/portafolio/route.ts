import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/iol-session'
import { getPortfolio } from '@/lib/iol-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(request: NextRequest) {
  const response = NextResponse.json({}) // placeholder, will be replaced
  const accessToken = await getAccessToken(request, response)

  if (!accessToken) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const positions = await getPortfolio(accessToken)
    const res = NextResponse.json(positions)
    // Forward any refreshed token cookies
    response.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
    return res
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Error al obtener portfolio'
    return NextResponse.json({ error: message }, { status })
  }
}
