import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'

/**
 * Email Marketing Analytics API
 * View opt-in rates, export email lists, track engagement
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action = 'stats' } = req.query

    if (action === 'export') {
      // Export email list for marketing tools
      const usersSnapshot = await db.collection('users')
        .where('emailMarketingConsent', '==', true)
        .where('emailUnsubscribed', '==', false)
        .get()

      const emailList = usersSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          email: data.email,
          name: data.name,
          tier: data.isPro ? 'PRO' : 'FREE',
          signupDate: data.createdAt,
          optInDate: data.emailMarketingConsentDate,
          lastActive: data.lastActiveAt || data.updatedAt
        }
      })

      return res.status(200).json({
        success: true,
        count: emailList.length,
        emails: emailList,
        exportedAt: new Date().toISOString()
      })
    }

    // Default: Return statistics
    const allUsersSnapshot = await db.collection('users').get()
    const optedInSnapshot = await db.collection('users')
      .where('emailMarketingConsent', '==', true)
      .get()
    const unsubscribedSnapshot = await db.collection('users')
      .where('emailUnsubscribed', '==', true)
      .get()

    let totalUsers = 0
    let optedInUsers = 0
    let unsubscribedUsers = 0
    let freeOptedIn = 0
    let proOptedIn = 0

    allUsersSnapshot.forEach(doc => {
      const data = doc.data()
      totalUsers++
    })

    optedInSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.emailUnsubscribed !== true) {
        optedInUsers++
        if (data.isPro) {
          proOptedIn++
        } else {
          freeOptedIn++
        }
      }
    })

    unsubscribedSnapshot.forEach(doc => {
      unsubscribedUsers++
    })

    const optInRate = totalUsers > 0 ? (optedInUsers / totalUsers) * 100 : 0

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        optedInUsers,
        unsubscribedUsers,
        notAskedYet: totalUsers - optedInUsers - unsubscribedUsers,
        optInRate: Math.round(optInRate * 10) / 10,
        tierBreakdown: {
          freeOptedIn,
          proOptedIn
        }
      },
      updated: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Email marketing API error:', error)
    return res.status(500).json({ error: error.message })
  }
}
