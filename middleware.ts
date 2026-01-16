import { NextRequest, NextResponse } from 'next/server'
import { getAdminCookieName, isValidAdminSessionToken } from '@/lib/admin-session'

async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(getAdminCookieName())?.value
  return await isValidAdminSessionToken(token)
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

  // Always allow iOS app APIs to keep working.
  if (pathname.startsWith('/api/app')) {
    return NextResponse.next()
  }

  // Always allow admin auth endpoints
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  // Only protect admin and health pages - everything else is public
  const needsAdmin =
    pathname === '/health' ||
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/app') && !pathname.startsWith('/api/admin'))

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



