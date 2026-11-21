declare module '@/lib/cloudflare-access.mjs' {
  export const ACCESS_HEADER: string
  export type AccessConfig = { teamDomain: string; audience: string; issuer: string; certsUrl: string }
  export type AccessIdentity = { email: string | null; subject: string | null }
  export type AccessResult = { status: 'not-configured' } | { status: 'denied' } | { status: 'allowed'; identity: AccessIdentity }
  type VerifyOptions = { fetchImpl?: typeof fetch; now?: number }
  export function isAdminArea(pathname: string): boolean
  export function accessConfig(env?: Record<string, string | undefined>): AccessConfig | null
  export function verifyAccessToken(token: string, config: AccessConfig | null, options?: VerifyOptions): Promise<AccessIdentity | null>
  export function checkAccess(headerValue: string | null | undefined, env?: Record<string, string | undefined>, options?: VerifyOptions): Promise<AccessResult>
  export function clearAccessKeyCache(): void
  export function clientIp(getHeader: (name: string) => string | string[] | null | undefined, viaCloudflare: boolean): string | null
}
