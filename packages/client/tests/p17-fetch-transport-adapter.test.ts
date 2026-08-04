import { afterEach, describe, expect, it, vi } from 'vitest'
import { FetchTransportAdapter } from '../src/transport/adapter'

describe('FetchTransportAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the constrained request and parses JSON responses', async () => {
    const fetchMock = vi.fn(async () => new Response('{"accepted":true}', { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const adapter = new FetchTransportAdapter()

    await expect(adapter.send({
      body: '{"operation":"save"}',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'verified' },
      method: 'POST',
      signal,
      url: '/panels/transport',
    })).resolves.toEqual({ body: { accepted: true }, status: 202 })

    expect(fetchMock).toHaveBeenCalledWith('/panels/transport', {
      body: '{"operation":"save"}',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'verified' },
      method: 'POST',
      signal,
    })
  })

  it('returns plain text and empty response bodies without hiding the status', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('upstream unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new FetchTransportAdapter()

    await expect(adapter.send({
      body: '{}',
      credentials: 'same-origin',
      headers: {},
      method: 'POST',
      url: '/panels/transport',
    })).resolves.toEqual({ body: 'upstream unavailable', status: 503 })
    await expect(adapter.send({
      body: '{}',
      credentials: 'same-origin',
      headers: {},
      method: 'POST',
      url: '/panels/transport',
    })).resolves.toEqual({ body: undefined, status: 204 })
  })
})
