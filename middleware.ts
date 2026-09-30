import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAdminEmail } from '@/lib/auth-config'
import { legacyAppApiEnabled } from '@/lib/security-policy.mjs'

// Simple bot detection (without Firebase - edge-compatible)
function shouldBlockBot(userAgent: string, path: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /facebookbot/i, /facebookexternalhit/i, /meta-externalagent/i,
    /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  ]
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent))
  if (!isBot) return false
  
  // Allow legitimate search bots on public pages
  const searchBots = [/googlebot/i, /bingbot/i, /duckduckbot/i, /applebot/i]
  const isSearchBot = searchBots.some(pattern => pattern.test(userAgent))
  if (isSearchBot && !path.startsWith('/api')) return false

  // Link previews (iMessage, WhatsApp, X, Facebook, Slack, Discord) may read
  // public recipe pages so shared links get a card.
  const previewBots = [/facebookexternalhit/i, /meta-externalagent/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i, /slackbot/i, /discordbot/i, /telegrambot/i, /pinterest/i]
  if (path.startsWith('/recipes') && previewBots.some(pattern => pattern.test(userAgent))) return false
  
  // Block all bots on APIs
  if (path.startsWith('/api')) return true
  
  // Block non-search bots everywhere
  return !isSearchBot
}

function getClientIP(headers: Record<string, string>): string {
  return headers['x-real-ip'] || 
         headers['x-forwarded-for']?.split(',')[0] || 
         'unknown'
}

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

  // The previous Firebase-backed app API remains unavailable until every route
  // has migrated to Supabase auth and has passed the connection test suite.
  if (pathname.startsWith('/api/app') && !legacyAppApiEnabled(process.env.ENABLE_LEGACY_APP_API)) {
    return NextResponse.json(
      { success: false, error: 'The legacy app service is unavailable while the secure app connection is being upgraded.' },
      { status: 503, headers: { 'Retry-After': '3600' } }
    )
  }

  // Get user agent for bot checks
  const userAgent = req.headers.get('user-agent') || ''

  // Note: IP blocking is handled in API routes with Firebase (edge-compatible)
  // Middleware only does basic bot detection to reduce load

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

  // Always allow public auth endpoints (Apple Sign In, etc.)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Public, non-secret bootstrap data for native Savry clients.
  if (pathname === '/api/public/config') {
    return NextResponse.next()
  }

  // Only protect admin and health pages - everything else is public
  const needsAdmin =
    pathname === '/health' ||
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    pathname.startsWith('/api/admin') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/app') && !pathname.startsWith('/api/auth') && pathname !== '/api/public/config')

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

