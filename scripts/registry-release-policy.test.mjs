import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertRegistryDependencyGraph,
  assertRegistryPackageVersion,
  isCompatibleHoloVersion,
  minimumHoloPatch,
} from './registry-release-policy.mjs'

test('registry release policy accepts every stable Holo version from the compatibility floor', () => {
  assert.equal(minimumHoloPatch('>=0.3.9'), 9)
  assert.equal(isCompatibleHoloVersion('0.3.9', '>=0.3.9'), true)
  assert.equal(isCompatibleHoloVersion('0.3.27', '>=0.3.9'), true)
  assert.equal(isCompatibleHoloVersion('0.4.0', '>=0.3.9'), true)
  assert.equal(isCompatibleHoloVersion('1.0.0', '>=0.3.9'), true)
})

test('registry release policy rejects unsupported Holo versions and ranges', () => {
  assert.equal(isCompatibleHoloVersion('0.3.8', '>=0.3.9'), false)
  assert.equal(isCompatibleHoloVersion('0.3.11-next.0', '>=0.3.9'), false)
  assert.throws(() => minimumHoloPatch('^0.3.9'), /unbounded Holo-JS compatibility floor/u)
})

test('registry release policy rejects overrides and local lockfile references', () => {
  assert.doesNotThrow(() => assertRegistryDependencyGraph('next-app', '{"lockfileVersion":3}', undefined))
  assert.throws(
    () => assertRegistryDependencyGraph('next-app', '{}', {}),
    /must not use dependency overrides/u,
  )
  for (const protocol of ['file:', 'link:', 'workspace:']) {
    assert.throws(
      () => assertRegistryDependencyGraph('next-app', `{"resolved":"${protocol}artifact"}`, undefined),
      /contains a local dependency reference/u,
    )
  }
})

test('registry release policy requires exact Panels versions and compatible Holo versions', () => {
  assert.doesNotThrow(() => assertRegistryPackageVersion(
    '@holo-js/panels-core',
    '0.1.0-next.0',
    '0.1.0-next.0',
    '>=0.3.9',
  ))
  assert.doesNotThrow(() => assertRegistryPackageVersion(
    '@holo-js/core',
    '0.3.10',
    '0.1.0-next.0',
    '>=0.3.9',
  ))
  assert.throws(
    () => assertRegistryPackageVersion('@holo-js/panels-core', '0.1.0-next.1', '0.1.0-next.0', '>=0.3.9'),
    /instead of 0\.1\.0-next\.0/u,
  )
  assert.throws(
    () => assertRegistryPackageVersion('@holo-js/core', '0.3.8', '0.1.0-next.0', '>=0.3.9'),
    /outside >=0\.3\.9/u,
  )
})
