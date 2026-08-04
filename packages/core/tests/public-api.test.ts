import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../../..')

describe('public API declaration fixtures', () => {
  it('match the generated package declarations', () => {
    expect(() => execFileSync(
      process.execPath,
      ['scripts/validate-public-api.mjs'],
      { cwd: repositoryRoot, stdio: 'pipe' },
    )).not.toThrow()
  }, 15_000)
})
