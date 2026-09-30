import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'
import { COLLECTION, toPublicRecipe } from '@/lib/community-recipes'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Sign in required' })

  try {
    const identity = await verifyJWT(header.slice(7))
    const [userDoc, recipeDocs] = await Promise.all([
      db.collection('users').doc(identity.userId).get(),
      db.collection(COLLECTION).where('importedBy', '==', identity.userId).limit(100).get(),
    ])
    const user = userDoc.data() ?? {}
    const recipes = recipeDocs.docs
      .filter((doc) => doc.data().isPublic)
      .map((doc) => toPublicRecipe(doc.id, doc.data()))
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))

    return res.status(200).json({
      success: true,
      user: {
        id: identity.userId,
        name: user.name || identity.email.split('@')[0],
        email: identity.email,
        tier: identity.tier,
      },
      recipes: recipes.map(({ id, slug, title, imageUrl, madeCount, version, publishedAt, url }) => ({
        id,
        slug,
        title,
        imageUrl,
        madeCount,
        version,
        publishedAt,
        url,
      })),
    })
  } catch {
    return res.status(401).json({ success: false, error: 'Session expired' })
  }
}
