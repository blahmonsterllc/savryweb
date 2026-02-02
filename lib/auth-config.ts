import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// List of authorized admin emails
const ADMIN_EMAILS = [
  'savryapp@gmail.com',
  'gordonlafler@gmail.com',
  // Add more authorized admin emails here
]

export function requireEnv(name: string): string {
  const val = process.env[name]
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
      if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        return true
      }
      return false
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

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
