/**
 * IOL Session — cookie-based token storage
 *
 * Stores the IOL token directly in httpOnly cookies so it survives across
 * Vercel serverless function instances (in-memory Map doesn't work there).
 */

import { iolRefresh } from './iol-client'
import type { NextRequest, NextResponse } from 'next/server'

export const COOKIE_ACCESS  = 'iol_access_token'
export const COOKIE_REFRESH = 'iol_refresh_token'
export const COOKIE_EXPIRES = 'iol_token_expires'
export const COOKIE_LOGGED  = 'iol_logged_in'

const BASE_OPTS = {
  sameSite: 'strict' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

const MAX_AGE = 60 * 60 * 8 // 8 hours

/**
 * Sets all token cookies on a NextResponse.
 */
export function setTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
) {
  const expiresAt = Date.now() + expiresIn * 1000
  response.cookies.set(COOKIE_ACCESS,  accessToken,        { ...BASE_OPTS, httpOnly: true,  maxAge: MAX_AGE })
  response.cookies.set(COOKIE_REFRESH, refreshToken,       { ...BASE_OPTS, httpOnly: true,  maxAge: MAX_AGE })
  response.cookies.set(COOKIE_EXPIRES, String(expiresAt),  { ...BASE_OPTS, httpOnly: true,  maxAge: MAX_AGE })
  response.cookies.set(COOKIE_LOGGED,  '1',                { ...BASE_OPTS, httpOnly: false, maxAge: MAX_AGE })
}

/**
 * Clears all token cookies on a NextResponse.
 */
export function clearTokenCookies(response: NextResponse) {
  response.cookies.set(COOKIE_ACCESS,  '', { ...BASE_OPTS, httpOnly: true,  maxAge: 0 })
  response.cookies.set(COOKIE_REFRESH, '', { ...BASE_OPTS, httpOnly: true,  maxAge: 0 })
  response.cookies.set(COOKIE_EXPIRES, '', { ...BASE_OPTS, httpOnly: true,  maxAge: 0 })
  response.cookies.set(COOKIE_LOGGED,  '', { ...BASE_OPTS, httpOnly: false, maxAge: 0 })
}

/**
 * Reads the access token from the request cookies.
 * If it's about to expire, refreshes it and writes new cookies to the response.
 * Returns the valid access token, or null if not authenticated.
 */
export async function getAccessToken(
  request: NextRequest,
  response: NextResponse,
): Promise<string | null> {
  const access  = request.cookies.get(COOKIE_ACCESS)?.value
  const refresh = request.cookies.get(COOKIE_REFRESH)?.value
  const expires = request.cookies.get(COOKIE_EXPIRES)?.value

  if (!access || !refresh || !expires) return null

  const expiresAt = Number(expires)
  const twoMinFromNow = Date.now() + 2 * 60 * 1000

  // Token still valid
  if (expiresAt > twoMinFromNow) return access

  // Token expiring soon → refresh
  try {
    const newToken = await iolRefresh(refresh)
    setTokenCookies(response, newToken.access_token, newToken.refresh_token, newToken.expires_in)
    return newToken.access_token
  } catch {
    clearTokenCookies(response)
    return null
  }
}
