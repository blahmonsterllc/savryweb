import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { createAdminSessionToken, getAdminCookieName, isValidAdminPassword } from '@/lib/admin-session'

const loginSchema = z.object({
  password: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { password } = loginSchema.parse(req.body)
    if (!isValidAdminPassword(password)) {
      return res.status(401).json({ message: 'Invalid password' })
    }

    const token = await createAdminSessionToken()
    const isProd = process.env.NODE_ENV === 'production'

    res.setHeader('Set-Cookie', [
      `${getAdminCookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; ${isProd ? 'Secure;' : ''}`,
    ])

    return res.status(200).json({ success: true })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    console.error('Admin login error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}



