import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineTransportOperation,
  PanelsTransportError,
  ProtocolCompatibilityError,
  type ResponseEnvelope,
} from '@holo-js/panels-core'
import {
  createTransportRecorder,
  HoloSecurityCsrfProvider,
  PanelsTransport,
  type ClientCsrfProvider,
  type TransportHttpResponse,
} from '../src/transport'

const csrfProvider: ClientCsrfProvider = Object.freeze({
  getField: () => Object.freeze({ name: '_token', value: 'signed token' }),
})

class ReadPayload {
  readonly [key: string]: unknown
  declare readonly page: number
}

class ReadData {
  readonly [key: string]: unknown
  declare readonly records: string[]
}

class MutationPayload {
  readonly [key: string]: unknown
  declare readonly title: string
}

class MutationData {
  readonly [key: string]: unknown
  declare readonly id: string
}

const readOperation = defineTransportOperation({ data: ReadData, payload: ReadPayload }, {
  kind: 'read',
  name: 'records.list',
})

const mutationOperation = defineTransportOperation({ data: MutationData, payload: MutationPayload }, {
  kind: 'mutation',
  name: 'records.create',
  supportsIdempotency: true,
})

function success<TData>(id: string, data: TData): TransportHttpResponse {
  return Object.freeze({
    status: 200,
    body: {
      data,
      effects: [],
      id,
      ok: true,
      protocolVersion: '1.0',
    },
  })
}

function transport(steps: readonly (TransportHttpResponse | Error)[], options: { readonly attempts?: number } = {}) {
  const recorder = createTransportRecorder(steps)
  return {
    recorder,
    transport: new PanelsTransport({
      adapter: recorder,
      csrfProvider,
      createId: () => '00000000-0000-4000-8000-000000000001',
      retry: { delayMs: 0, maxAttempts: options.attempts ?? 3 },
      wait: async () => {},
    }),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('panels client transport', () => {
  it('sends versioned form requests with the Holo CSRF field and records deterministically', async () => {
    const { recorder, transport: client } = transport([success('00000000-0000-4000-8000-000000000001', { records: ['one'] })])

    const response = await client.execute(readOperation, {
      endpoint: '/holo/panels/admin',
      panelId: 'admin',
      payload: { page: 1 },
    })

    expect(response).toMatchObject({ ok: true, data: { records: ['one'] } })
    expect(recorder.requests).toHaveLength(1)
    expect(recorder.requests[0]).toMatchObject({
      credentials: 'same-origin',
      method: 'POST',
      url: '/holo/panels/admin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    })
    const fields = new URLSearchParams(recorder.requests[0]!.body)
    expect(fields.get('_token')).toBe('signed token')
    expect(JSON.parse(fields.get('request')!)).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      operation: 'records.list',
      panelId: 'admin',
      payload: { page: 1 },
      protocolVersion: '1.0',
    })
  })

  it('rejects cross-origin endpoints before exposing CSRF material', async () => {
    const { recorder, transport: client } = transport([])
    await expect(client.execute(readOperation, {
      endpoint: 'https://attacker.test/operations',
      panelId: 'admin',
      payload: { page: 1 },
    })).rejects.toThrow('root-relative same-origin')
    expect(recorder.requests).toHaveLength(0)
  })

  it('retries safe reads with the same request and never retries mutations', async () => {
    const read = transport([
      new Error('offline'),
      { status: 503, body: 'unavailable' },
      success('00000000-0000-4000-8000-000000000001', { records: [] }),
    ])

    await expect(read.transport.execute(readOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { page: 1 },
    })).resolves.toMatchObject({ ok: true })
    expect(read.recorder.requests).toHaveLength(3)
    expect(new Set(read.recorder.requests.map(request => request.body)).size).toBe(1)

    const mutation = transport([new Error('offline'), success('00000000-0000-4000-8000-000000000001', { id: 'post-1' })])
    await expect(mutation.transport.execute(mutationOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { title: 'Post' },
    })).rejects.toBeInstanceOf(PanelsTransportError)
    expect(mutation.recorder.requests).toHaveLength(1)
    expect(mutation.recorder.requests[0]!.headers['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001:mutation')
  })

  it('uses stable idempotency keys only for supported mutations', async () => {
    const { recorder, transport: client } = transport([success('00000000-0000-4000-8000-000000000001', { id: 'post-1' })])
    await client.execute(mutationOperation, {
      endpoint: '/operations',
      idempotencyKey: 'create-post:request-0001',
      panelId: 'admin',
      payload: { title: 'Post' },
    })

    expect(recorder.requests[0]!.headers['Idempotency-Key']).toBe('create-post:request-0001')
    const unsupported = transport([success('00000000-0000-4000-8000-000000000001', { records: [] })])
    await expect(unsupported.transport.execute(readOperation, {
      endpoint: '/operations',
      idempotencyKey: 'unsupported-key-0001',
      panelId: 'admin',
      payload: { page: 1 },
    })).rejects.toThrow('does not support idempotency')
    expect(unsupported.recorder.requests).toHaveLength(0)
  })

  it('propagates abort signals and stops before sending pre-aborted requests', async () => {
    const controller = new AbortController()
    controller.abort()
    const { recorder, transport: client } = transport([])

    await expect(client.execute(readOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { page: 1 },
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(recorder.requests).toHaveLength(0)
  })

  it('propagates active aborts to the adapter without retrying', async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | undefined
    const recorder = createTransportRecorder([(request) => {
      receivedSignal = request.signal
      return new Promise((_, reject) => {
        request.signal?.addEventListener('abort', () => {
          const error = new Error('aborted by adapter')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    }])
    const client = new PanelsTransport({ adapter: recorder, csrfProvider })
    const execution = client.execute(readOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { page: 1 },
      signal: controller.signal,
    })
    controller.abort()

    await expect(execution).rejects.toMatchObject({ name: 'AbortError' })
    expect(receivedSignal).toBe(controller.signal)
    expect(recorder.requests).toHaveLength(1)
  })

  it('discards a response that arrives after its owner aborts an adapter that ignores cancellation', async () => {
    const controller = new AbortController()
    let resolveResponse: ((response: TransportHttpResponse) => void) | undefined
    const recorder = createTransportRecorder([() => new Promise(resolve => { resolveResponse = resolve })])
    const client = new PanelsTransport({
      adapter: recorder,
      csrfProvider,
      createId: () => '00000000-0000-4000-8000-000000000001',
    })
    const execution = client.execute(readOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { page: 1 },
      signal: controller.signal,
    })

    controller.abort()
    resolveResponse?.(success('00000000-0000-4000-8000-000000000001', { records: ['obsolete'] }))

    await expect(execution).rejects.toMatchObject({ name: 'AbortError' })
    expect(recorder.requests).toHaveLength(1)
  })

  it('rejects protocol mismatch without retrying or returning state data', async () => {
    const recorder = createTransportRecorder([{
      status: 200,
      body: {
        id: '00000000-0000-4000-8000-000000000001',
        ok: true,
        protocolVersion: '2.0',
        data: { records: ['unsafe'] },
        effects: [],
      },
    }, success('00000000-0000-4000-8000-000000000001', { records: [] })])
    const client = new PanelsTransport({
      adapter: recorder,
      csrfProvider,
      createId: () => '00000000-0000-4000-8000-000000000001',
    })

    await expect(client.execute(readOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { page: 1 },
    })).rejects.toBeInstanceOf(ProtocolCompatibilityError)
    expect(recorder.requests).toHaveLength(1)
  })

  it('returns typed error envelopes and normalizes malformed HTTP failures safely', async () => {
    const errorEnvelope: ResponseEnvelope = {
      effects: [],
      error: {
        category: 'validation',
        code: 'invalid_title',
        message: 'Title is required.',
        retryable: false,
      },
      id: '00000000-0000-4000-8000-000000000001',
      ok: false,
      protocolVersion: '1.0',
    }
    const validation = transport([{ status: 422, body: errorEnvelope }])
    await expect(validation.transport.execute(mutationOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { title: '' },
    })).resolves.toMatchObject({ ok: false, error: { code: 'invalid_title' } })

    const malformed = transport([{ status: 500, body: { stack: '/private/source.ts' } }], { attempts: 1 })
    await expect(malformed.transport.execute(readOperation, {
      endpoint: '/operations',
      panelId: 'admin',
      payload: { page: 1 },
    })).rejects.toMatchObject({
      panelsError: {
        code: 'http_500',
        message: 'The operation could not be completed.',
      },
    })
  })

  it('reads the configured CSRF cookie through Holo Security client facilities', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: 'tracking=1; XSRF-TOKEN=signed%20value' },
    })
    expect(new HoloSecurityCsrfProvider().getField()).toEqual({ name: '_token', value: 'signed value' })
    Reflect.deleteProperty(globalThis, 'document')
  })
})
