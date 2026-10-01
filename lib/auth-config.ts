import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { ADMIN_EMAILS, isAdminEmail } from './admin-emails'

export { ADMIN_EMAILS, isAdminEmail }

export function requireEnv(name: string): string {
  // Trimmed because a value pasted with a trailing newline makes Google reject the client id.
  const val = process.env[name]?.trim()
  if (!val) {
    throw new Error(`${name} environment variable is not set`)
  }
  return val
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    }),
  ],
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow specific admin emails
      return isAdminEmail(user.email)
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email
      }
      return token
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}
