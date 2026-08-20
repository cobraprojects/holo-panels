import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { prepareExamples } from './prepare-examples.mjs'

describe('example metadata preparation', () => {
  it('migrates schema metadata before preparing discovery for every framework example', async () => {
    const calls = []
    const directories = []

    await prepareExamples(async (example, command) => {
      calls.push([example, command])
    }, async (example) => {
      directories.push(example)
    })

    assert.deepEqual(directories, ['example-next', 'example-nuxt', 'example-sveltekit'])
    assert.deepEqual(calls, [
      ['example-next', 'migrate'],
      ['example-next', 'prepare'],
      ['example-nuxt', 'migrate'],
      ['example-nuxt', 'prepare'],
      ['example-sveltekit', 'migrate'],
      ['example-sveltekit', 'prepare'],
    ])
  })

  it('stops before later examples when schema migration fails', async () => {
    const calls = []

    await assert.rejects(
      prepareExamples(async (example, command) => {
        calls.push([example, command])
        if (example === 'example-next' && command === 'migrate') {
          throw new Error('migration failed')
        }
      }),
      /migration failed/,
    )

    assert.deepEqual(calls, [
      ['example-next', 'migrate'],
    ])
  })
})
