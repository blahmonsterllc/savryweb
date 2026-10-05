// Verifies signed transactions and server notifications from the App Store
// (StoreKit 2 JWS) without calling Apple: the signature must chain to Apple's
// root certificate, which is pinned here by fingerprint. Plain JS so the Node
// test runner can exercise it with a test certificate chain.

import { X509Certificate, createVerify } from 'node:crypto'

/** SHA-256 fingerprint of "Apple Root CA - G3" (valid to 2039), the root of every App Store signature. */
export const APPLE_ROOT_CA_G3_SHA256 = '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179'

// Apple marks its signing certificates with these extensions (DER-encoded object identifiers).
const OID_APP_STORE_LEAF = Buffer.from('060a2a864886f7636406 0b01'.replace(/ /g, ''), 'hex') // 1.2.840.113635.100.6.11.1
const OID_APPLE_INTERMEDIATE = Buffer.from('060a2a864886f763640602 01'.replace(/ /g, ''), 'hex') // 1.2.840.113635.100.6.2.1

export class AppStoreSignatureError extends Error {}

const fail = (message) => { throw new AppStoreSignatureError(message) }
const fingerprint = (certificate) => certificate.fingerprint256.replace(/:/g, '').toUpperCase()

function decodeSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
  } catch {
    return fail('The signed data is not readable')
  }
}

/**
 * Checks the signature and certificate chain of an App Store JWS and returns its payload.
 * @param {string} jws
 * @param {{ trustedRoots?: string[], now?: number }} [options] trustedRoots: SHA-256 fingerprints accepted as the root
 */
export function verifyAppStoreJWS(jws, options = {}) {
  const trustedRoots = (options.trustedRoots ?? [APPLE_ROOT_CA_G3_SHA256]).map((value) => value.replace(/:/g, '').toUpperCase())
  const now = options.now ?? Date.now()
  if (typeof jws !== 'string' || jws.length > 20_000) fail('The signed data is missing')
  const parts = jws.split('.')
  if (parts.length !== 3) fail('The signed data is malformed')

  const header = decodeSegment(parts[0])
  if (header.alg !== 'ES256') fail('Unexpected signature algorithm')
  if (!Array.isArray(header.x5c) || header.x5c.length !== 3) fail('The certificate chain is missing')

  let chain
  try {
    chain = header.x5c.map((value) => new X509Certificate(Buffer.from(value, 'base64')))
  } catch {
    return fail('The certificate chain is unreadable')
  }
  const [leaf, intermediate, root] = chain

  if (!trustedRoots.includes(fingerprint(root))) fail('The certificate chain does not end at Apple')
  if (!root.verify(root.publicKey) || !intermediate.verify(root.publicKey) || !leaf.verify(intermediate.publicKey)) fail('The certificate chain is broken')
  if (!root.ca || !intermediate.ca) fail('The certificate chain is not issued by a certificate authority')
  if (!leaf.raw.includes(OID_APP_STORE_LEAF) || !intermediate.raw.includes(OID_APPLE_INTERMEDIATE)) fail('The certificates are not App Store signing certificates')

  const signature = Buffer.from(parts[2], 'base64url')
  const signed = createVerify('SHA256').update(`${parts[0]}.${parts[1]}`).verify({ key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, signature)
  if (!signed) fail('The signature does not match')

  const payload = decodeSegment(parts[1])
  // Certificates must have been valid when Apple signed this, not necessarily today.
  const signedAt = typeof payload.signedDate === 'number' && payload.signedDate <= now ? payload.signedDate : now
  for (const certificate of chain) {
    if (signedAt < Date.parse(certificate.validFrom) || signedAt > Date.parse(certificate.validTo)) fail('A certificate in the chain was not valid when this was signed')
  }
  return payload
}

/**
 * Turns a verified transaction into the facts Savry stores, or throws if it
 * is not a live Savry+ purchase that this member may claim.
 * @param {Record<string, any>} transaction payload returned by verifyAppStoreJWS
 * @param {{ bundleId: string, productIds: readonly string[], userId?: string, allowSandbox?: boolean }} expected
 */
export function membershipFromTransaction(transaction, expected) {
  if (transaction.bundleId !== expected.bundleId) fail('This purchase is for a different app')
  if (!expected.productIds.includes(transaction.productId)) fail('This purchase is not Savry+')
  if (transaction.environment !== 'Production' && !(expected.allowSandbox && transaction.environment === 'Sandbox')) fail('Test purchases are not accepted')
  if (typeof transaction.originalTransactionId !== 'string' || !transaction.originalTransactionId) fail('The purchase has no identifier')
  if (typeof transaction.expiresDate !== 'number') fail('The purchase has no end date')
  if (expected.userId && transaction.appAccountToken && String(transaction.appAccountToken).toLowerCase() !== expected.userId.toLowerCase()) {
    fail('This purchase was made for a different Savry account')
  }
  const revoked = typeof transaction.revocationDate === 'number'
  return {
    originalTransactionId: transaction.originalTransactionId,
    productId: transaction.productId,
    purchasedAt: new Date(transaction.purchaseDate ?? transaction.originalPurchaseDate ?? Date.now()).toISOString(),
    // A refunded or revoked purchase ends at the moment it was revoked.
    expiresAt: new Date(revoked ? transaction.revocationDate : transaction.expiresDate).toISOString(),
    revoked,
    appAccountToken: transaction.appAccountToken ? String(transaction.appAccountToken).toLowerCase() : null,
  }
}
