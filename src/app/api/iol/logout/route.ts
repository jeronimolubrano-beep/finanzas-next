import { NextRequest, NextResponse } from 'next/server'
import { clearTokenCookies } from '@/lib/iol-session'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  clearTokenCookies(response)
  return response
}
