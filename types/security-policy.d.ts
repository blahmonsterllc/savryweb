declare module '@/lib/security-policy.mjs' {
  export function safeReturnPath(value: string | null | undefined, fallback?: string): string
  export function safeJsonLd(value: unknown): string
  export function contentSecurityPolicy(): string
  export function securityHeaders(): Array<{ key: string; value: string }>
}
