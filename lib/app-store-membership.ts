import 'server-only'

import { AppStoreSignatureError, OTHER_ACCOUNT, claimableFromFormerAccount, membershipFromTransaction, verifyAppStoreJWS } from '@/lib/app-store-jws.mjs'

/** The products that make someone a Savry+ member, as sold by the iOS app (one subscription group). */
export const SAVRY_PLUS_PURCHASE = {
  bundleId: process.env.APPLE_BUNDLE_ID || 'recipe.foodprep',
  productIds: ['recipe.foodprep.savry.plus.annual', 'recipe.foodprep.savry.plus.monthly'],
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

/**
 * For a purchase refused because it was bought under another Savry account:
 * the purchase, when that account has since been deleted (see
 * claimableFromFormerAccount for why this is safe), or the same refusal when
 * it still exists or cannot be checked.
 */
export async function readPurchaseFromDeletedAccount(
  signedTransaction: unknown,
  accountExists: (userId: string) => Promise<boolean>,
): Promise<{ purchase: VerifiedPurchase } | { rejected: string }> {
  const read = readSavryPlusPurchase(signedTransaction)
  if ('rejected' in read) return read
  const token = read.purchase.appAccountToken
  const exists = token ? await accountExists(token).catch(() => null) : null
  return claimableFromFormerAccount(read.purchase, exists) ? read : { rejected: OTHER_ACCOUNT }
}
