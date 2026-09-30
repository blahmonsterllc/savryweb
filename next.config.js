/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['localhost'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    const { securityHeaders } = await import('./lib/security-policy.mjs')
    return [{ source: '/:path*', headers: securityHeaders() }]
  },
}

module.exports = nextConfig
