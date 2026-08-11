import assert from 'node:assert/strict'
import test from 'node:test'
import { satisfiesVersionRange } from './published-manifest-policy.mjs'

test('minimum compatibility accepts every stable release at or above the floor', () => {
  assert.equal(satisfiesVersionRange('>=0.3.9', '0.3.9'), true)
  assert.equal(satisfiesVersionRange('>=0.3.9', '0.3.10'), true)
  assert.equal(satisfiesVersionRange('>=0.3.9', '0.4.0'), true)
  assert.equal(satisfiesVersionRange('>=0.3.9', '1.0.0'), true)
})

test('minimum compatibility rejects versions below the floor', () => {
  assert.equal(satisfiesVersionRange('>=0.3.9', '0.3.8'), false)
  assert.equal(satisfiesVersionRange('>=0.3.9', '0.2.99'), false)
})

test('caret compatibility follows zero-major semver boundaries', () => {
  assert.equal(satisfiesVersionRange('^0.0.9', '0.0.9'), true)
  assert.equal(satisfiesVersionRange('^0.0.9', '0.0.10'), false)
  assert.equal(satisfiesVersionRange('^1.2.3', '1.9.0'), true)
  assert.equal(satisfiesVersionRange('^1.2.3', '2.0.0'), false)
})

test('compatibility rejects malformed and prerelease inputs', () => {
  assert.equal(satisfiesVersionRange('0.3.9', '0.3.11'), false)
  assert.equal(satisfiesVersionRange('>=0.3.9', '0.3.11-next.0'), false)
  assert.equal(satisfiesVersionRange('>=invalid', '0.3.10'), false)
})
