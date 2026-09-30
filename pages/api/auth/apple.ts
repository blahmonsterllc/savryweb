import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Retired legacy endpoint.
 *
 * The old implementation derived an account identifier from an unverified token.
 * That is not a valid Sign in with Apple security boundary. Web and app clients
 * must use Supabase Auth, which validates Apple's signed identity token.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Deprecation', 'true')
  return res.status(410).json({
    success: false,
    code: 'LEGACY_AUTH_RETIRED',
    error: 'Use the current Savry sign-in flow. This unverified legacy endpoint has been retired.',
  })
}
