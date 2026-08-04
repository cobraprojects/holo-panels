import assert from 'node:assert/strict'
import test from 'node:test'
import { validateNpmPublishAuthentication } from './release-auth.mjs'

test('returns the authenticated npm identity', () => {
  const identity = validateNpmPublishAuthentication({
    cwd: '/workspace',
    spawn(command, args, options) {
      assert.equal(command, process.platform === 'win32' ? 'npm.cmd' : 'npm')
      assert.deepEqual(args, ['whoami'])
      assert.deepEqual(options, { cwd: '/workspace', encoding: 'utf8' })
      return { status: 0, stdout: 'publisher\n', stderr: '' }
    },
  })

  assert.equal(identity, 'publisher')
})

test('rejects missing npm publication credentials with actionable output', () => {
  assert.throws(() => validateNpmPublishAuthentication({
    spawn() {
      return { status: 1, stdout: '', stderr: '401 Unauthorized\n' }
    },
  }), /npm login[\s\S]*401 Unauthorized/u)
})

test('propagates npm process startup failures', () => {
  const failure = new Error('npm executable missing')

  assert.throws(() => validateNpmPublishAuthentication({
    spawn() {
      return { error: failure, status: null, stdout: '', stderr: '' }
    },
  }), failure)
})
