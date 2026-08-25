import { describe, expect, it } from 'vitest'
import { createFieldFactory, type FieldContext } from '../src/index'

interface RecordFixture {
  readonly city: string
}

const context: FieldContext<RecordFixture> = Object.freeze({
  get: () => undefined,
  operation: 'create',
  record: null,
  set: () => {},
})

describe('choice field options', () => {
  it('preserves static options for client manifests and server operations', async () => {
    const field = createFieldFactory<RecordFixture>().select('city').options({ Cairo: 'Cairo', London: 'London' }).compile()

    expect(field.properties?.options).toEqual({ Cairo: 'Cairo', London: 'London' })
    expect(field.server.options.manifestOptions()).toEqual([
      { label: 'Cairo', value: 'Cairo' },
      { label: 'London', value: 'London' },
    ])
    await expect(field.server.options.list({ locale: 'en', page: 1, perPage: 25, search: 'lon' }, context)).resolves.toEqual({
      hasMore: false,
      options: [{ label: 'London', value: 'London' }],
      page: 1,
      perPage: 25,
      total: 1,
    })
  })

  it('resolves callback options on the server without serializing the callback', async () => {
    const field = createFieldFactory<RecordFixture>().select('city').options(() => [
      { label: 'Cairo', value: 'Cairo' },
    ]).compile()

    expect(field.properties?.options).toBeNull()
    expect(field.server.options.manifestOptions()).toEqual([])
    await expect(field.server.options.hydrateSelected({ locale: 'en', page: 1, perPage: 25, search: '' }, ['Cairo'], context)).resolves.toEqual([
      { label: 'Cairo', value: 'Cairo' },
    ])
  })
})
