import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAdminEmail } from '@/lib/auth-config'
import { shouldBlockBot, getClientIP, shouldBlockIP } from '@/lib/traffic-analytics'

async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.email) return false
    return isAdminEmail(token.email as string)
  } catch (error) {
    console.error('Auth check error:', error)
    return false
  }
}

function redirectToAdminLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow Next internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next()
  }

  // Get user agent and IP for bot/rate limit checks
  const userAgent = req.headers.get('user-agent') || ''
  const clientIP = getClientIP(Object.fromEntries(req.headers))

  // Check if IP is blocked
  try {
    const isBlocked = await shouldBlockIP(clientIP)
    if (isBlocked) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'Your IP has been blocked due to suspicious activity'
        },
        { status: 403 }
      )
    }
  } catch (error) {
    // If check fails, continue (don't break the app)
    console.error('IP block check failed:', error)
  }

  // Check if bot should be blocked (blocks Meta bots and others on APIs)
  // NOTE: iOS APIs have additional security checks in their handlers
  if (shouldBlockBot(userAgent, pathname)) {
    // Allow iOS APIs to handle their own bot detection (they check JWT too)
    if (!pathname.startsWith('/api/app')) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'Automated requests are not allowed. Please use a web browser.'
        },
        { status: 403 }
      )
    }
  }

  // iOS app APIs - Basic bot check (detailed checks in handlers)
  // Block obvious bots even before they reach the handler
  const obviousBotPatterns = [
    /curl/i,
    /wget/i,
    /python-requests/i,
    /postman/i,
    /insomnia/i,
  ]
  const isObviousBot = obviousBotPatterns.some(pattern => pattern.test(userAgent))
  
  if (pathname.startsWith('/api/app') && isObviousBot) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Automated requests are not allowed. Please use the official iOS app.'
      },
      { status: 403 }
    )
  }
  
  // Allow iOS app APIs (with JWT auth required in handlers)
  if (pathname.startsWith('/api/app')) {
    return NextResponse.next()
  }

  // Always allow admin auth endpoints
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  // Always allow public auth endpoints (Apple Sign In, etc.)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Only protect admin and health pages - everything else is public
  const needsAdmin =
    pathname === '/health' ||
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/app') && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/auth'))

  if (!needsAdmin) {
    return NextResponse.next()
  }

  // Allow the admin login page itself
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Admin check
  const isAuthed = await isAdminAuthed(req)
  if (!isAuthed) {
    // For API routes, return 401 JSON instead of redirect
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ message: 'Admin authorization required' }, { status: 401 })
    }
    return redirectToAdminLogin(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
      Run for all routes except static assets. We still early-return for allowlisted paths above.
    */
    '/((?!_next/static|_next/image).*)',
  ],
}



