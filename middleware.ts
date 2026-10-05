import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { requireSupabasePublishableKey, requireSupabaseURL } from '@/lib/supabase/config'

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

const APP_STORE_NOTIFICATIONS_PATH = '/api/app-store/notifications'

// Public API routes that are reachable without an admin session.
function isPublicApiRoute(pathname: string): boolean {
  return (
    pathname === '/api/public/config' ||
    // Members call this with their own Supabase token; the handler verifies it.
    pathname === '/api/account/apple-revoke' ||
    // The app sends a member's signed Savry+ purchase with their Supabase token; the handler verifies both.
    pathname === '/api/membership/sync' ||
    // Apple's servers report renewals and refunds here; the handler verifies Apple's signature.
    pathname === APP_STORE_NOTIFICATIONS_PATH ||
    // Vercel Cron calls these with the CRON_SECRET bearer token; the handlers verify it.
    pathname === '/api/cron/patrol' ||
    pathname === '/api/cron/memberships' ||
    pathname === '/api/cron/weekly-email' ||
    pathname === '/api/email/unsubscribe' ||
    // The app asks for shelf prices near a ZIP code; nothing personal is sent or stored, and the server caches by store.
    pathname === '/api/prices/store' ||
    // The public price table the app downloads; the same file every visitor's recipe page is priced from.
    pathname === '/api/prices/table' ||
    pathname === '/api/cron/recost' ||
    // Members price their own recipe with their Supabase token; the handler verifies it and computes the cost itself.
    pathname === '/api/recipes/cost'
  )
}

type AdminGate = { standing: 'admin' | 'member' | 'anonymous'; response: NextResponse }

/**
 * Admin access uses the member's own Savry session (Apple or email sign-in).
 * The session is verified with Supabase Auth, then the database says whether
 * that user is on the admin list. A refreshed session cookie is carried on
 * `response` and passed on to the page or handler.
 */
async function checkAdmin(req: NextRequest): Promise<AdminGate> {
  let response = NextResponse.next({ request: req })
  try {
    const supabase = createServerClient(requireSupabaseURL(), requireSupabasePublishableKey(), {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return { standing: 'anonymous', response }
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
    if (adminError || isAdmin !== true) return { standing: 'member', response }
    return { standing: 'admin', response }
  } catch (error) {
    console.error('Admin check error:', error)
    return { standing: 'anonymous', response }
  }
}

/** Keeps a refreshed session cookie when the answer is a redirect or an error. */
function withSessionCookies(target: NextResponse, gate: AdminGate): NextResponse {
  gate.response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}

function redirectToSignIn(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/app-login'
  url.search = ''
  url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

function redirectToAdminDenied(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.search = ''
  url.searchParams.set('denied', '1')
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

  // Get user agent for bot checks
  const userAgent = req.headers.get('user-agent') || ''

  // Bot handling here is intentionally light; the database enforces the
  // real limits (account standing, daily allowances) inside its functions.

  // Check if bot should be blocked (scrapers everywhere, every bot on /api).
  // Apple's notification servers are not a browser; their signature is the check.
  if (pathname !== APP_STORE_NOTIFICATIONS_PATH && shouldBlockBot(userAgent, pathname)) {
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
  const gate = await checkAdmin(req)
  if (gate.standing !== 'admin') {
    // For API routes, return JSON instead of a redirect
    if (pathname.startsWith('/api')) {
      const status = gate.standing === 'member' ? 403 : 401
      return withSessionCookies(NextResponse.json({ message: 'Admin authorization required' }, { status }), gate)
    }
    return withSessionCookies(gate.standing === 'member' ? redirectToAdminDenied(req) : redirectToSignIn(req), gate)
  }

  return gate.response
}

export const config = {
  matcher: [
    /*
      Run for all routes except static assets. We still early-return for allowlisted paths above.
    */
    '/((?!_next/static|_next/image).*)',
  ],
}
