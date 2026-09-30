import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Retired Firebase registration endpoint. Community accounts are created by
 * Supabase Auth so the website and Apple apps share one user identity.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Deprecation', 'true')
  return res.status(410).json({
    success: false,
    code: 'LEGACY_REGISTRATION_RETIRED',
    error: 'Create a Savry community account through the current sign-in page.',
  })
}






