import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createSign, X509Certificate } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { APPLE_ROOT_CA_G3_SHA256, AppStoreSignatureError, membershipFromTransaction, verifyAppStoreJWS } from '../lib/app-store-jws.mjs'

// A stand-in for Apple's chain: root -> intermediate -> leaf, with the same marker
// extensions Apple uses, made with openssl for the test run only.
function makeChain({ leafMarker = true, name = 'chain' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), `savry-jws-${name}-`))
  const run = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' })
  writeFileSync(path.join(dir, 'int.cnf'), 'basicConstraints=critical,CA:TRUE\n1.2.840.113635.100.6.2.1=DER:0500\n')
  writeFileSync(path.join(dir, 'leaf.cnf'), `basicConstraints=CA:FALSE\n${leafMarker ? '1.2.840.113635.100.6.11.1=DER:0500\n' : ''}`)
  for (const who of ['root', 'int', 'leaf']) run('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', `${who}.key`)
  run('req', '-x509', '-new', '-key', 'root.key', '-subj', '/CN=Test Root', '-days', '30', '-out', 'root.pem', '-addext', 'basicConstraints=critical,CA:TRUE')
  run('req', '-new', '-key', 'int.key', '-subj', '/CN=Test Intermediate', '-out', 'int.csr')
  run('x509', '-req', '-in', 'int.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '30', '-extfile', 'int.cnf', '-out', 'int.pem')
  run('req', '-new', '-key', 'leaf.key', '-subj', '/CN=Test Leaf', '-out', 'leaf.csr')
  run('x509', '-req', '-in', 'leaf.csr', '-CA', 'int.pem', '-CAkey', 'int.key', '-CAcreateserial', '-days', '30', '-extfile', 'leaf.cnf', '-out', 'leaf.pem')
  const der = (file) => new X509Certificate(readFileSync(path.join(dir, file))).raw.toString('base64')
  return {
    x5c: [der('leaf.pem'), der('int.pem'), der('root.pem')],
    leafKey: readFileSync(path.join(dir, 'leaf.key'), 'utf8'),
    rootSha256: new X509Certificate(readFileSync(path.join(dir, 'root.pem'))).fingerprint256,
  }
}

function sign(chain, payload, { alg = 'ES256', x5c = chain.x5c } = {}) {
  const head = Buffer.from(JSON.stringify({ alg, x5c })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createSign('SHA256').update(`${head}.${body}`).sign({ key: chain.leafKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${head}.${body}.${signature}`
}

let hasOpenSSL = true
try { execFileSync('openssl', ['version'], { stdio: 'pipe' }) } catch { hasOpenSSL = false }

const USER = '0f3c1a52-7d5e-4a0b-9f1e-2b6c8d9e0a11'
const transaction = (extra = {}) => ({
  bundleId: 'recipe.foodprep', productId: 'recipe.foodprep.savry.plus.annual', environment: 'Production',
  originalTransactionId: '2000000123456789', purchaseDate: Date.now() - 86_400_000, expiresDate: Date.now() + 300 * 86_400_000,
  signedDate: Date.now() + 2000, type: 'Auto-Renewable Subscription', ...extra,
})
const expected = { bundleId: 'recipe.foodprep', productIds: ['recipe.foodprep.savry.plus.annual', 'recipe.foodprep.savry.plus.monthly'], userId: USER }
const rejects = (fn, pattern) => assert.throws(fn, (error) => error instanceof AppStoreSignatureError && pattern.test(error.message))

test('the pinned root is Apple Root CA - G3', () => {
  assert.equal(APPLE_ROOT_CA_G3_SHA256, '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179')
})

test('a transaction signed by a trusted chain is accepted', { skip: !hasOpenSSL }, () => {
  const chain = makeChain()
  const payload = verifyAppStoreJWS(sign(chain, transaction()), { trustedRoots: [chain.rootSha256] })
  assert.equal(payload.originalTransactionId, '2000000123456789')
  const membership = membershipFromTransaction(payload, expected)
  assert.equal(membership.revoked, false)
  assert.ok(Date.parse(membership.expiresAt) > Date.now())
})

test('anything not signed by Apple is refused', { skip: !hasOpenSSL }, () => {
  const chain = makeChain()
  const other = makeChain({ name: 'other' })
  const trusted = { trustedRoots: [chain.rootSha256] }
  const good = sign(chain, transaction())

  rejects(() => verifyAppStoreJWS(good), /does not end at Apple/) // default trust is Apple only; a self-made chain never passes
  rejects(() => verifyAppStoreJWS(sign(other, transaction()), trusted), /does not end at Apple/)

  // Payload swapped after signing
  const [h, , s] = good.split('.')
  const forged = `${h}.${Buffer.from(JSON.stringify(transaction({ expiresDate: Date.now() + 9e11 }))).toString('base64url')}.${s}`
  rejects(() => verifyAppStoreJWS(forged, trusted), /signature does not match/)

  // Signed with a key that is not the leaf certificate's
  rejects(() => verifyAppStoreJWS(sign({ ...chain, leafKey: other.leafKey }, transaction()), trusted), /signature does not match/)

  // Trusted root at the end, but the leaf was issued by someone else
  rejects(() => verifyAppStoreJWS(sign(other, transaction(), { x5c: [other.x5c[0], other.x5c[1], chain.x5c[2]] }), trusted), /chain is broken/)

  rejects(() => verifyAppStoreJWS(sign(chain, transaction(), { alg: 'none' }), trusted), /algorithm/)
  rejects(() => verifyAppStoreJWS(sign(chain, transaction(), { alg: 'HS256' }), trusted), /algorithm/)
  rejects(() => verifyAppStoreJWS(sign(chain, transaction(), { x5c: chain.x5c.slice(0, 2) }), trusted), /chain is missing/)
  rejects(() => verifyAppStoreJWS('not-a-jws', trusted), /malformed/)
})

test('certificates must carry Apple\'s App Store markers and be valid when signed', { skip: !hasOpenSSL }, () => {
  const plain = makeChain({ leafMarker: false, name: 'plain' })
  rejects(() => verifyAppStoreJWS(sign(plain, transaction()), { trustedRoots: [plain.rootSha256] }), /not App Store signing certificates/)
  const chain = makeChain({ name: 'dates' })
  const later = Date.now() + 90 * 86_400_000
  rejects(() => verifyAppStoreJWS(sign(chain, transaction({ signedDate: later })), { trustedRoots: [chain.rootSha256], now: later }), /not valid when this was signed/)
})

test('only a live Savry+ purchase for this app and this member becomes a membership', () => {
  assert.equal(membershipFromTransaction(transaction(), expected).productId, 'recipe.foodprep.savry.plus.annual')
  assert.equal(membershipFromTransaction(transaction({ productId: 'recipe.foodprep.savry.plus.monthly' }), expected).productId, 'recipe.foodprep.savry.plus.monthly')
  rejects(() => membershipFromTransaction(transaction({ bundleId: 'com.other.app' }), expected), /different app/)
  rejects(() => membershipFromTransaction(transaction({ productId: 'something.else' }), expected), /not Savry\+/)
  rejects(() => membershipFromTransaction(transaction({ environment: 'Sandbox' }), expected), /Test purchases/)
  rejects(() => membershipFromTransaction(transaction({ environment: 'Xcode' }), { ...expected, allowSandbox: true }), /Test purchases/)
  assert.ok(membershipFromTransaction(transaction({ environment: 'Sandbox' }), { ...expected, allowSandbox: true }))
  rejects(() => membershipFromTransaction(transaction({ appAccountToken: '11111111-2222-3333-4444-555555555555' }), expected), /different Savry account/)
  assert.equal(membershipFromTransaction(transaction({ appAccountToken: USER.toUpperCase() }), expected).appAccountToken, USER)
  rejects(() => membershipFromTransaction(transaction({ expiresDate: undefined }), expected), /no end date/)
  const refunded = membershipFromTransaction(transaction({ revocationDate: Date.now() - 5000 }), expected)
  assert.equal(refunded.revoked, true)
  assert.ok(Date.parse(refunded.expiresAt) < Date.now(), 'a refunded purchase is over')
})
