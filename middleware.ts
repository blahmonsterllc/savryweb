import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAdminEmail } from '@/lib/admin-emails'

// Crawlers that may read every public (non-/api) page: search engines, the
// Google ads/verification crawlers, and the link-preview fetchers used by
// messaging apps and social networks so shared recipe links get a card.
const allowedPublicBots = [
  /googlebot/i, /bingbot/i, /duckduckbot/i, /applebot/i, /yandexbot/i, /baiduspider/i,
  /adsbot-google/i, /storebot-google/i, /mediapartners-google/i,
  /facebookexternalhit/i, /meta-externalagent/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  /slackbot/i, /discordbot/i, /telegrambot/i, /pinterest/i,
]

// Simple, edge-compatible bot detection
function shouldBlockBot(userAgent: string, path: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /facebookexternalhit/i, /meta-externalagent/i, /whatsapp/i,
  ]

  const isBot = botPatterns.some((pattern) => pattern.test(userAgent))
  if (!isBot) return false

  // Block every bot on APIs.
  if (path.startsWith('/api')) return true

  // Search engines, Google ad crawlers, and link-preview fetchers may read
  // any public page. Everything else that identifies as a bot is blocked.
  return !allowedPublicBots.some((pattern) => pattern.test(userAgent))
}

// Public API routes that are reachable without an admin session.
function isPublicApiRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth') ||
    pathname === '/api/public/config' ||
    pathname === '/api/email/unsubscribe'
  )
}

async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
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
    pathname.startsWith('/sitemap.xml') ||
    pathname === '/ads.txt'
  ) {
    return NextResponse.next()
  }

  // Get user agent for bot checks
  const userAgent = req.headers.get('user-agent') || ''

  // Bot handling here is intentionally light; the database enforces the
  // real limits (account standing, daily allowances) inside its functions.

  // Check if bot should be blocked (scrapers everywhere, every bot on /api)
  if (shouldBlockBot(userAgent, pathname)) {
    {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Automated requests are not allowed. Please use a web browser.',
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
  const isObviousBot = obviousBotPatterns.some((pattern) => pattern.test(userAgent))

  // Allow iOS app APIs (JWT auth required in handlers), public auth endpoints
  // (Apple Sign In, etc.), the public client config, and the one-click email
  // unsubscribe link (required by CAN-SPAM and GDPR).
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next()
  }

  // Only protect admin and health pages - everything else is public
  const needsAdmin =
    pathname === '/health' ||
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    pathname.startsWith('/api/admin') ||
    (pathname.startsWith('/api') && !isPublicApiRoute(pathname))

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
