/**
 * Admin allowlist with no environment access so it is safe to import from the
 * Edge middleware. `lib/auth-config.ts` re-exports these for NextAuth.
 */
export const ADMIN_EMAILS: readonly string[] = [
  'savryapp@gmail.com',
  'gordonlafler@gmail.com',
  // Add more authorized admin emails here
]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
