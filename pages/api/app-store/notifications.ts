/**
 * App Store Server Notifications (version 2). Apple calls this when a Savry+
 * membership renews, expires, or is refunded, so the website stays right even
 * if the member has not opened the app.
 *
 * POST /api/app-store/notifications   { "signedPayload": "<JWS>" }
 *
 * There is no shared secret: the payload and the transaction inside it are
 * accepted only if Apple's signature and certificate chain verify. Anything
 * verified is answered with 200, including events Savry has no use for, so
 * Apple does not keep retrying them. Set this address as the Production
 * Server URL (Version 2) for the app in App Store Connect.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { AppStoreSignatureError, verifyAppStoreJWS } from '@/lib/app-store-jws.mjs'
import { SAVRY_PLUS_PURCHASE, readSavryPlusPurchase } from '@/lib/app-store-membership'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let notification: Record<string, any>
  try {
    notification = verifyAppStoreJWS(req.body?.signedPayload)
  } catch (error) {
    if (error instanceof AppStoreSignatureError) return res.status(400).json({ error: 'Not signed by the App Store' })
    throw error
  }

  const signedTransaction = notification.data?.signedTransactionInfo
  if (notification.data?.bundleId !== SAVRY_PLUS_PURCHASE.bundleId || typeof signedTransaction !== 'string') {
    // A test ping, or an event with no transaction to act on.
    return res.status(200).json({ handled: false })
  }

  const result = readSavryPlusPurchase(signedTransaction)
  if ('rejected' in result) return res.status(200).json({ handled: false })

  const { data, error } = await getSupabaseAdmin().rpc('apply_app_store_notification', { purchase: result.purchase })
  if (error) {
    // A 5xx asks Apple to send the event again later.
    console.error('app store notification: could not record', notification.notificationType, error.message)
    return res.status(500).json({ error: 'Could not record the event' })
  }
  return res.status(200).json({ handled: data?.linked === true })
}
