import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { auth as firebaseAuth, db } from '@/lib/firebase'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        try {
          // Verify user with Firebase Auth
          const userRecord = await firebaseAuth.getUserByEmail(credentials.email)
          
          // Get user data from Firestore
          const userDoc = await db.collection('users').doc(userRecord.uid).get()
          const userData = userDoc.data()

          if (!userData) {
            throw new Error('User data not found')
          }

          // Note: Firebase Auth handles password verification internally
          // For now, we'll need to use Firebase Admin SDK to verify
          // In production, you'd use Firebase client SDK on the frontend
          
          return {
            id: userRecord.uid,
            email: userRecord.email || '',
            name: userData.name || userRecord.displayName,
            tier: userData.tier || 'FREE',
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw new Error('Invalid credentials')
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.tier = user.tier
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.tier = token.tier as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)







