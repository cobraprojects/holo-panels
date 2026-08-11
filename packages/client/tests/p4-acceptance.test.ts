import {
  defineSchema,
  defineTransportOperation,
  schemaComponentsFor,
  type Effect,
} from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import {
  createTransportRecorder,
  FormStore,
  PanelsTransport,
  TableStateStore,
  type ClientCsrfProvider,
} from '../src'

type FormValues = {
  publish: boolean
  title: string
}

class FormValueSource {
  declare publish: boolean
  declare title: string
}

type TableRecord = {
  id: string
  title: string
}

class TablePayload {
  readonly [key: string]: unknown
  declare readonly page: number
  declare readonly queryVersion: number
  declare readonly search: string
}

class TableData {
  readonly [key: string]: unknown
  declare readonly queryVersion: number
  declare readonly records: TableRecord[]
  declare readonly total: number
}

class MutationPayload {
  readonly [key: string]: unknown
  declare readonly title: string
}

class MutationData {
  readonly [key: string]: unknown
  declare readonly id: string
}

const csrfProvider: ClientCsrfProvider = Object.freeze({
  getField: () => Object.freeze({ name: '_token', value: 'signed-token' }),
})

const tableOperation = defineTransportOperation({ data: TableData, payload: TablePayload }, { kind: 'read', name: 'table.data' })

const mutationOperation = defineTransportOperation({ data: MutationData, payload: MutationPayload }, { kind: 'mutation', name: 'form.submit', supportsIdempotency: true })

function success<TData>(data: TData, effects: readonly Effect[] = []) {
  return Object.freeze({
    status: 200,
    body: {
      data,
      effects,
      id: '00000000-0000-4000-8000-000000000004',
      ok: true as const,
      protocolVersion: '1.0',
    },
  })
}

describe('P4 framework-neutral acceptance', () => {
  it('runs bootstrap, reactive patch, table query, mutation effect, and recovery', async () => {
    const components = schemaComponentsFor(FormValueSource)
    const schema = defineSchema('post-form', FormValueSource).components([
      components.custom('app:input').key('title').statePath('title'),
    ]).compile()
    const form = new FormStore<FormValues>({ publish: false, title: '' }, {
      schema,
      dependencies: [{
        id: 'published-title',
        paths: ['publish'],
        recompute: ({ get }) => [{
          kind: 'visible',
          path: 'title',
          value: get('publish'),
        }],
      }],
    })
    expect(form.state.values).toEqual({ publish: false, title: '' })
    form.set('publish', true)
    expect(form.state.visibility.title).toBe(true)

    const table = new TableStateStore<TableRecord, string>({
      panelId: 'admin',
      tableId: 'posts',
      visibleColumns: ['title'],
    })
    table.setSearch('published')
    const tableData = {
      queryVersion: table.query.queryVersion,
      records: [{ id: 'post-1', title: 'Published' }],
      total: 1,
    }
    const redirect: Effect = { kind: 'redirect', replace: true, url: '/admin/posts/post-1' }
    const recorder = createTransportRecorder([
      success(tableData),
      success({ id: 'post-1' }, [redirect]),
      { status: 503, body: 'temporarily unavailable' },
      success(tableData),
    ])
    const transport = new PanelsTransport({
      adapter: recorder,
      csrfProvider,
      createId: () => '00000000-0000-4000-8000-000000000004',
      retry: { delayMs: 0, maxAttempts: 2 },
      wait: async () => {},
    })

    const query = await transport.execute(tableOperation, {
      endpoint: '/holo/panels/admin',
      panelId: 'admin',
      payload: {
        page: table.query.page,
        queryVersion: table.query.queryVersion,
        search: table.query.search,
      },
    })
    if (!query.ok) throw new Error(query.error.message)
    expect(table.applyData(query.data)).toBe(true)
    expect(table.snapshot.records).toEqual([{ id: 'post-1', title: 'Published' }])

    form.set('title', 'Published')
    const mutation = await transport.execute(mutationOperation, {
      endpoint: '/holo/panels/admin',
      idempotencyKey: 'post-create-request-0001',
      panelId: 'admin',
      payload: { title: form.get('title') },
    })
    expect(mutation.effects).toEqual([redirect])

    const recovered = await transport.execute(tableOperation, {
      endpoint: '/holo/panels/admin',
      panelId: 'admin',
      payload: {
        page: table.query.page,
        queryVersion: table.query.queryVersion,
        search: table.query.search,
      },
    })
    expect(recovered.ok).toBe(true)
    expect(recorder.requests).toHaveLength(4)
  })
})
