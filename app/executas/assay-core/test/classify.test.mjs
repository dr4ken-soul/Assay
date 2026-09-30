import assert from 'node:assert/strict'
import { test } from 'node:test'

/**
 * The operator hint is the only diagnostic a failed column carries, so it has
 * to name the thing that actually broke.
 *
 * A host that refuses `sampling/createMessage` never reached a model and no
 * credential was involved. Telling the operator to check their API key sends
 * them to the wrong place, which is what the first real trial run did.
 */

const { classifyForTest } = await import('../dist/trial.js')
const { ReverseRpcError, RPC_ERROR } = await import('../dist/rpc.js')

test('a sampling grant failure never blames the API key', () => {
  const out = classifyForTest(new ReverseRpcError(RPC_ERROR.samplingNotGranted, 'not granted'), 'anna')
  assert.equal(out.errorClass, 'auth')
  assert.doesNotMatch(out.hint, /key/i)
  assert.match(out.hint, /sampling/i)
})

test('a host that does not implement sampling is named as such', () => {
  const out = classifyForTest(new ReverseRpcError(RPC_ERROR.methodNotFound, 'no such method'), 'anna')
  assert.equal(out.errorClass, 'auth')
  assert.doesNotMatch(out.hint, /key/i)
  assert.match(out.hint, /harness|host/i)
})

test('a byok failure still points at the credential', () => {
  const out = classifyForTest(new ReverseRpcError(RPC_ERROR.samplingNotGranted, 'not granted'), 'byok')
  assert.match(out.hint, /permissions|sampling/i)
})

test('a plain failure on an Anna lane never mentions a key', () => {
  const out = classifyForTest(new Error('boom'), 'anna')
  assert.equal(out.errorClass, 'unknown')
  assert.doesNotMatch(out.hint, /key/i)
})

test('a plain failure on a byok model still names the key', () => {
  const out = classifyForTest(new Error('boom'), 'byok')
  assert.match(out.hint, /key/i)
})
