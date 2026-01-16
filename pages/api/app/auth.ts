/**
 * iOS App Authentication Endpoint
 * The iOS app calls this endpoint to authenticate users
 * Returns a session token that can be used for subsequent requests
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sign } from 'jsonwebtoken'

const authSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { email, password } = authSchema.parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        tier: true,
      }
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isPasswordValid = await compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate JWT token for iOS app
    const token = sign(
      {
        userId: user.id,
        email: user.email,
        tier: user.tier,
      },
      process.env.NEXTAUTH_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    )

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    
    console.error('iOS auth error:', error)
    return res.status(500).json({ message: 'Authentication failed' })
  }
}







