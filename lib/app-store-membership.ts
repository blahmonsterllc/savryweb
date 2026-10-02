import 'server-only'

import { AppStoreSignatureError, membershipFromTransaction, verifyAppStoreJWS } from '@/lib/app-store-jws.mjs'

/** The one product that makes someone a Savry+ member, as sold by the iOS app. */
export const SAVRY_PLUS_PURCHASE = {
  bundleId: process.env.APPLE_BUNDLE_ID || 'recipe.foodprep',
  productId: 'recipe.foodprep.savry.plus.annual',
} as const

/**
 * Test purchases (Xcode, TestFlight, App Review) are signed by Apple too, but
 * cost nothing. They count only where APP_STORE_ALLOW_SANDBOX is "true".
 */
export const allowSandboxPurchases = () => process.env.APP_STORE_ALLOW_SANDBOX === 'true'

export type VerifiedPurchase = ReturnType<typeof membershipFromTransaction>

/**
 * Verifies a signed transaction from the app or from Apple and returns the
 * facts stored for the membership. Returns a reason instead of throwing when
 * the purchase cannot be accepted.
 */
export function readSavryPlusPurchase(signedTransaction: unknown, userId?: string): { purchase: VerifiedPurchase } | { rejected: string } {
  try {
    const transaction = verifyAppStoreJWS(signedTransaction as string)
    return { purchase: membershipFromTransaction(transaction, { ...SAVRY_PLUS_PURCHASE, userId, allowSandbox: allowSandboxPurchases() }) }
  } catch (error) {
    if (error instanceof AppStoreSignatureError) return { rejected: error.message }
    throw error
  }
}
