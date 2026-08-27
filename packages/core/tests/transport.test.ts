import { describe, expect, it } from 'vitest'
import { ValidationException } from '@holo-js/forms/schema'
import {
  createRequestEnvelope,
  decodeRequestEnvelope,
  decodeResponseEnvelope,
  decodeTransportServerRequest,
  normalizeTransportError,
  TransportDecodingError,
} from '../src/transport'
import { panelNotification } from '../src/notifications'
import { ProtocolCompatibilityError } from '../src/protocol/version'

describe('server transport contracts', () => {
  it('delivers Holo field and form errors without leaking values or unsafe paths', () => {
    const failure = new ValidationException({ title: ['Already used'], _root: ['Review the form'] })
    expect(normalizeTransportError(failure)).toMatchObject({ category: 'validation', details: { errors: { title: ['Already used'], _root: ['Review the form'] } } })
    expect(normalizeTransportError(failure).details?.errors).not.toHaveProperty('constructor.prototype')
    expect(normalizeTransportError({ status: 422, errors: { password: ['secret'] } }).details).toBeUndefined()
  })
  it('constructs and decodes frozen versioned requests', () => {
    const request = createRequestEnvelope({
      id: 'request-1',
      operation: 'records.list',
      panelId: 'admin',
      payload: { page: 1 },
    })

    expect(request).toEqual({
      id: 'request-1',
      operation: 'records.list',
      panelId: 'admin',
      payload: { page: 1 },
      protocolVersion: '1.0',
    })
    expect(Object.isFrozen(request)).toBe(true)
    expect(decodeRequestEnvelope(request)).toEqual(request)
    expect(() => createRequestEnvelope({ ...request, payload: { unsafe: () => undefined } as never })).toThrow('is not JSON-safe')
  })

  it('decodes Holo Security-compatible form requests and idempotency headers', async () => {
    const encoded = JSON.stringify(createRequestEnvelope({
      id: 'request-1',
      operation: 'records.create',
      panelId: 'admin',
      payload: { title: 'Post' },
    }))
    const decoded = await decodeTransportServerRequest({
      formData: async () => ({ get: name => name === 'request' ? encoded : undefined }),
      headers: { get: name => name === 'Idempotency-Key' ? 'create-post:request-0001' : null },
    })

    expect(decoded).toMatchObject({
      envelope: { operation: 'records.create', payload: { title: 'Post' } },
      idempotencyKey: 'create-post:request-0001',
    })
  })

  it('rejects protocol mismatch before reading state-bearing response fields', () => {
    const response = {
      id: 'request-1',
      ok: true,
      protocolVersion: '2.0',
      get data(): never {
        throw new Error('data was read')
      },
      get effects(): never {
        throw new Error('effects were read')
      },
    }

    expect(() => decodeResponseEnvelope(response, 'request-1')).toThrow(ProtocolCompatibilityError)
  })

  it('decodes typed effects and rejects unsafe navigation effects', () => {
    const presentation = panelNotification('records.saved')
      .title('Saved')
      .body('The record was updated')
      .status('success')
      .action('open', 'Open', 'navigate', '/admin/posts/1')
      .presentation()
    const response = decodeResponseEnvelope({
      id: 'request-1',
      ok: true,
      protocolVersion: '1.0',
      data: { saved: true },
      effects: [
        { kind: 'redirect', url: '/admin/posts', replace: true },
        { kind: 'toast', level: 'success', message: 'Saved', duration: 2500 },
        { kind: 'toast', presentation },
        { kind: 'invalidate-table', tableId: 'posts' },
      ],
    }, 'request-1')

    expect(response.effects).toEqual([
      { kind: 'redirect', url: '/admin/posts', replace: true },
      { kind: 'toast', level: 'success', message: 'Saved', duration: 2500 },
      { kind: 'toast', presentation },
      { kind: 'invalidate-table', tableId: 'posts' },
    ])
    expect(() => decodeResponseEnvelope({
      id: 'request-1',
      ok: true,
      protocolVersion: '1.0',
      data: null,
      effects: [{ kind: 'redirect', url: 'javascript:alert(1)' }],
    })).toThrow(TransportDecodingError)
    expect(() => decodeResponseEnvelope({
      id: 'request-1',
      ok: true,
      protocolVersion: '1.0',
      data: null,
      effects: [{ kind: 'toast', presentation: { ...presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'javascript:alert(1)' }] } }],
    })).toThrow(TransportDecodingError)
  })

  it('normalizes framework-shaped HTTP errors without exposing unsafe messages', () => {
    expect(normalizeTransportError({ statusCode: 403, message: 'database secret' })).toEqual({
      category: 'authorization',
      code: 'http_403',
      message: 'You are not authorized to perform this operation.',
      retryable: false,
    })
    expect(normalizeTransportError({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })).toMatchObject({
      category: 'not-found',
      code: 'http_404',
    })
    expect(normalizeTransportError(new Error('/private/source/path'))).toEqual({
      category: 'internal',
      code: 'transport_failure',
      message: 'The operation could not be completed.',
      retryable: true,
    })
  })
})
