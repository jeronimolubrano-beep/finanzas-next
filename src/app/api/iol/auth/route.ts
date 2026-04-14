import { NextRequest, NextResponse } from 'next/server'
import { iolLogin } from '@/lib/iol-client'
import { storeToken } from '@/lib/iol-session'

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
    const sessionId = crypto.randomUUID()

    storeToken(sessionId, token)

    const response = NextResponse.json({ ok: true })

    response.cookies.set('iol_session', sessionId, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/iol',
      maxAge: 3600, // 1 hora max, token real dura 15 min
    })

    // También seteamos una cookie legible por el client para saber si está logueado
    response.cookies.set('iol_logged_in', '1', {
      httpOnly: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600,
    })

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error de autenticación'
    const status = (error as { status?: number }).status || 401
    return NextResponse.json({ error: message }, { status })
  }
}
