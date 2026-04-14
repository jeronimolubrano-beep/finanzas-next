import { NextRequest, NextResponse } from 'next/server'
import { iolLogin } from '@/lib/iol-client'
import { setTokenCookies } from '@/lib/iol-session'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 },
      )
    }

    const token = await iolLogin(username, password)

    const response = NextResponse.json({ ok: true })
    setTokenCookies(response, token.access_token, token.refresh_token, token.expires_in)

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error de autenticación'
    const status = (error as { status?: number }).status || 401
    return NextResponse.json({ error: message }, { status })
  }
}
