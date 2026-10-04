/**
 * Links a Savry+ purchase made in the iOS app to the signed-in member, so the
 * website knows they are a paying member (no ads).
 *
 * POST /api/membership/sync
 *   Authorization: Bearer <Supabase access token of the signed-in member>
 *   { "signedTransaction": "<StoreKit 2 JWS of the member's latest Savry+ transaction>" }
 *
 * The transaction is trusted only because Apple signed it: the signature and
 * certificate chain are checked here before anything is stored. A purchase
 * already linked to another Savry account is refused.
 *
 * → 200 { member, status, currentPeriodEnd }
 *   400 { member: false, error }   not a valid Savry+ purchase
 *   401                            not signed in
 *   409 { member: false, error }   purchase belongs to another Savry account
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { readSavryPlusPurchase } from '@/lib/app-store-membership'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ member: false, error: 'Method not allowed' })
  }

  // A membership can only be linked to the account that is asking.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ member: false, error: 'Sign in first' })
  const supabase = getSupabaseAdmin()
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return res.status(401).json({ member: false, error: 'Sign in first' })

  // The app attaches the buyer's Savry account id to the purchase; a transaction
  // carrying a different id is refused here. One purchase links to one account.
  const result = readSavryPlusPurchase(req.body?.signedTransaction, userData.user.id)
  if ('rejected' in result) return res.status(400).json({ member: false, error: result.rejected })

  const { data, error } = await supabase.rpc('record_app_store_membership', { target_user: userData.user.id, purchase: result.purchase })
  if (error) {
    console.error('membership sync: could not record the purchase', error.message)
    return res.status(500).json({ member: false, error: 'Could not record the membership' })
  }
  if (data?.linked !== true) {
    return res.status(409).json({ member: false, error: 'This purchase is already linked to another Savry account' })
  }
  return res.status(200).json({ member: data.member === true, status: data.status, currentPeriodEnd: data.currentPeriodEnd })
}
