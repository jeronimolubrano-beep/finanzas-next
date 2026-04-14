import { NextRequest, NextResponse } from 'next/server'
import { removeToken } from '@/lib/iol-session'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('iol_session')?.value

  if (sessionId) {
    removeToken(sessionId)
  }

  const response = NextResponse.json({ ok: true })

  response.cookies.set('iol_session', '', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/api/iol',
    maxAge: 0,
  })

  response.cookies.set('iol_logged_in', '', {
    httpOnly: false,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return response
}
