import assert from 'node:assert/strict'
import test from 'node:test'
import { satisfiesCaretRange } from './published-manifest-policy.mjs'

test('caret compatibility accepts supported Holo patch releases', () => {
  assert.equal(satisfiesCaretRange('^0.3.10', '0.3.10'), true)
  assert.equal(satisfiesCaretRange('^0.3.10', '0.3.11'), true)
  assert.equal(satisfiesCaretRange('^0.3.10', '0.3.99'), true)
})

test('caret compatibility rejects versions outside the supported Holo line', () => {
  assert.equal(satisfiesCaretRange('^0.3.10', '0.3.9'), false)
  assert.equal(satisfiesCaretRange('^0.3.10', '0.4.0'), false)
  assert.equal(satisfiesCaretRange('^0.3.10', '1.0.0'), false)
})

test('caret compatibility follows zero-major semver boundaries', () => {
  assert.equal(satisfiesCaretRange('^0.0.9', '0.0.9'), true)
  assert.equal(satisfiesCaretRange('^0.0.9', '0.0.10'), false)
  assert.equal(satisfiesCaretRange('^1.2.3', '1.9.0'), true)
  assert.equal(satisfiesCaretRange('^1.2.3', '2.0.0'), false)
})

test('caret compatibility rejects malformed and prerelease inputs', () => {
  assert.equal(satisfiesCaretRange('0.3.10', '0.3.11'), false)
  assert.equal(satisfiesCaretRange('^0.3.10', '0.3.11-next.0'), false)
  assert.equal(satisfiesCaretRange('^invalid', '0.3.10'), false)
})
