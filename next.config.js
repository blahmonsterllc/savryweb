/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // This folder is the project, whatever other lockfiles sit above it.
  outputFileTracingRoot: __dirname,
  images: {
    // Only the site's own images are optimized. SVGs (logo, decorations) are
    // served as-is with `unoptimized`, so the optimizer never handles SVG.
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    const { securityHeaders } = await import('./lib/security-policy.mjs')
    return [{ source: '/:path*', headers: securityHeaders() }]
  },
}

module.exports = nextConfig
