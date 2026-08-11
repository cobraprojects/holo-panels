import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { prepareExamples } from './prepare-examples.mjs'

describe('example metadata preparation', () => {
  it('prepares discovery before migrating every framework example', async () => {
    const calls = []
    const directories = []

    await prepareExamples(async (example, command) => {
      calls.push([example, command])
    }, async (example) => {
      directories.push(example)
    })

    assert.deepEqual(directories, ['example-next', 'example-nuxt', 'example-sveltekit'])
    assert.deepEqual(calls, [
      ['example-next', 'prepare'],
      ['example-next', 'migrate'],
      ['example-nuxt', 'prepare'],
      ['example-nuxt', 'migrate'],
      ['example-sveltekit', 'prepare'],
      ['example-sveltekit', 'migrate'],
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
      ['example-next', 'prepare'],
      ['example-next', 'migrate'],
    ])
  })
})
