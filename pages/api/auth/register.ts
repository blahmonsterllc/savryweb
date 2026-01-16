import { NextApiRequest, NextApiResponse } from 'next'
import { auth, db } from '@/lib/firebase'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { email, password, name } = registerSchema.parse(req.body)

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    })

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      name: name || null,
      tier: 'FREE',
      weeklyBudget: null,
      monthlyBudget: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        name: name,
        tier: 'FREE',
      }
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }

    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'User already exists' })
    }
    
    console.error('Registration error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}







