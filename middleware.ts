import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { requireSupabasePublishableKey, requireSupabaseURL } from '@/lib/supabase/config'
import { ACCESS_HEADER, checkAccess, clientIp, isAdminArea } from '@/lib/cloudflare-access.mjs'
import { SITE_URL } from '@/lib/site-url'

// Crawlers that may read every public (non-/api) page: search engines, the
// Google ads/verification crawlers, and the link-preview fetchers used by
// messaging apps and social networks so shared recipe links get a card.
const allowedPublicBots = [
  /googlebot/i, /bingbot/i, /duckduckbot/i, /applebot/i, /yandexbot/i, /baiduspider/i,
  /adsbot-google/i, /storebot-google/i, /mediapartners-google/i,
  /facebookexternalhit/i, /meta-externalagent/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  /slackbot/i, /discordbot/i, /telegrambot/i, /pinterest/i, /redditbot/i, /embedly/i, /iframely/i,
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
const UNSUBSCRIBE_PATH = '/api/email/unsubscribe'

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
    pathname === '/api/recipes/cost' ||
    // Members delete their own recipe or account, or refresh their own recipe's cached pages, with their
    // Supabase token; the handlers verify it and only ever touch the caller's own recipes and photo folder.
    pathname === '/api/recipes/delete' ||
    pathname === '/api/recipes/refresh' ||
    pathname === '/api/account/delete' ||
    // Vercel Cron, with the CRON_SECRET bearer token; and the public summary of what it sampled.
    pathname === '/api/cron/kroger-sample' ||
    pathname === '/api/prices/observations' ||
    // Recipe help for iPhones without Apple Intelligence; the handler verifies the member's token and counts each use.
    pathname === '/api/ai/recipe' ||
    // Kitchen scan for Savry+; the handler verifies the member's token and membership, and counts each photo.
    pathname === '/api/ai/pantry'
  )
}

type AdminGate = { standing: 'admin' | 'second-factor' | 'member' | 'anonymous'; response: NextResponse }

const TWO_FACTOR_PATH = '/admin/two-factor'

/**
 * Admin access uses the member's own Savry session (Apple or email sign-in).
 * The session is verified with Supabase Auth, then the database says whether
 * that user is on the admin list AND signed in with a second factor
 * (is_admin() requires an aal2 session). A listed admin without the second
 * factor yet is 'second-factor' and goes to /admin/two-factor. A signed-in
 * member who is not an admin is noted in the admin activity log.
 * A refreshed session cookie is carried on `response` and passed on to the page or handler.
 */
async function checkAdmin(req: NextRequest, viaCloudflare: boolean): Promise<AdminGate> {
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
    if (adminError || isAdmin !== true) {
      // Anything but an explicit true is not an admin.
      const { data: needsSecondFactor } = await supabase.rpc('needs_admin_second_factor')
      if (needsSecondFactor === true) return { standing: 'second-factor', response }
      if (isAdminArea(req.nextUrl.pathname)) {
        await supabase
          .rpc('note_admin_denied', {
            p_path: req.nextUrl.pathname,
            p_ip: clientIp((name) => req.headers.get(name), viaCloudflare),
            p_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
          })
          .then(() => undefined, () => undefined)
      }
      return { standing: 'member', response }
    }
    return { standing: 'admin', response }
  } catch (error) {
    console.error('Admin check error:', error)
    return { standing: 'anonymous', response }
  }
}

/**
 * Cloudflare Access is configured but this request has no valid Access token.
 * On another address (the *.vercel.app one) a page is sent to www.savry.io,
 * where Cloudflare asks for its sign-in; anything else is refused.
 */
function cloudflareAccessRequired(req: NextRequest): NextResponse {
  if (!req.nextUrl.pathname.startsWith('/api')) {
    const canonical = new URL(SITE_URL)
    if (req.nextUrl.host !== canonical.host) {
      return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, canonical))
    }
  }
  return NextResponse.json({ message: 'Cloudflare Access sign-in required' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
}

function redirectToTwoFactor(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = TWO_FACTOR_PATH
  url.search = ''
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
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
  // Mail providers send the one-click unsubscribe POST (RFC 8058) from their own
  // servers; the token is the check there, and a GET changes nothing.
  if (pathname !== APP_STORE_NOTIFICATIONS_PATH && pathname !== UNSUBSCRIBE_PATH && shouldBlockBot(userAgent, pathname)) {
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

  // Cloudflare Access: its own sign-in in front of the whole admin area (the
  // login and two-factor pages included), checked before the Savry sign-in.
  // Until CLOUDFLARE_ACCESS_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD are set this
  // is skipped, and /admin/security flags it.
  let viaCloudflare = false
  if (isAdminArea(pathname)) {
    const access = await checkAccess(req.headers.get(ACCESS_HEADER))
    if (access.status === 'denied') return cloudflareAccessRequired(req)
    viaCloudflare = access.status === 'allowed'
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
  const gate = await checkAdmin(req, viaCloudflare)

  // The two-factor page is for listed admins who still need their second factor.
  if (pathname === TWO_FACTOR_PATH) {
    if (gate.standing === 'admin' || gate.standing === 'second-factor') return gate.response
    return withSessionCookies(gate.standing === 'member' ? redirectToAdminDenied(req) : redirectToSignIn(req), gate)
  }

  if (gate.standing !== 'admin') {
    // For API routes, return JSON instead of a redirect
    if (pathname.startsWith('/api')) {
      const status = gate.standing === 'anonymous' ? 401 : 403
      const message = gate.standing === 'second-factor' ? 'Two-factor sign-in required' : 'Admin authorization required'
      return withSessionCookies(NextResponse.json({ message }, { status }), gate)
    }
    if (gate.standing === 'second-factor') return withSessionCookies(redirectToTwoFactor(req), gate)
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
