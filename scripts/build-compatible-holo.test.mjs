import assert from 'node:assert/strict'
import test from 'node:test'
import { orderBuildPackages } from './build-compatible-holo.mjs'

function packageEntry(name, dependencies = []) {
  return { dependencies: new Set(dependencies), name, packageRoot: `/packages/${name}` }
}

test('orders Holo packages deterministically after their internal dependencies', () => {
  const ordered = orderBuildPackages([
    packageEntry('@holo-js/adapter', ['@holo-js/core', 'vue']),
    packageEntry('@holo-js/kernel'),
    packageEntry('@holo-js/core', ['@holo-js/kernel']),
  ])
  assert.deepEqual(ordered.map(entry => entry.name), [
    '@holo-js/kernel',
    '@holo-js/core',
    '@holo-js/adapter',
  ])
})

test('rejects duplicate package names and dependency cycles', () => {
  assert.throws(
    () => orderBuildPackages([packageEntry('@holo-js/core'), packageEntry('@holo-js/core')]),
    /Duplicate Holo package name/u,
  )
  assert.throws(
    () => orderBuildPackages([
      packageEntry('@holo-js/core', ['@holo-js/kernel']),
      packageEntry('@holo-js/kernel', ['@holo-js/core']),
    ]),
    /Cyclic Holo build dependency/u,
  )
})
