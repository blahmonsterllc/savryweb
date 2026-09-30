declare module '@/lib/security-policy.mjs' {
  export function safeReturnPath(value: string | null | undefined, fallback?: string): string
  export function legacyAppApiEnabled(value: string | undefined): boolean
  export function securityHeaders(): Array<{ key: string; value: string }>
}
