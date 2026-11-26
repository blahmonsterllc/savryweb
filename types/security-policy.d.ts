declare module '@/lib/security-policy.mjs' {
  export function safeReturnPath(value: string | null | undefined, fallback?: string): string
  export function safeJsonLd(value: unknown): string
  export function webAnalyticsToken(env?: Record<string, string | undefined>): string | null
  export function contentSecurityPolicy(env?: Record<string, string | undefined>): string
  export function securityHeaders(): Array<{ key: string; value: string }>
}
