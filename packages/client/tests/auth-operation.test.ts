import { describe, expect, it, vi } from 'vitest'
import { executePanelAuthRequest } from '../src/auth'

describe('panel authentication client', () => {
  it('posts logout through the fixed panel authentication boundary', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(executePanelAuthRequest({ csrfToken: 'token', fetch: fetcher, operation: 'logout', panelId: 'admin', payload: {} })).resolves.toMatchObject({ ok: true, status: 204 })
    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/logout', expect.objectContaining({ body: '{}', method: 'POST' }))
  })

  it('submits an allow-listed panel operation with CSRF protection and exposes native response behavior', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(executePanelAuthRequest({
      csrfToken: 'csrf-token',
      fetch: fetcher,
      operation: 'password-reset-request',
      panelId: 'admin',
      payload: { email: 'admin@example.com' },
    })).resolves.toEqual({ data: null, ok: true, status: 204, url: null })

    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/password-reset-request', {
      body: JSON.stringify({ email: 'admin@example.com' }),
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-token' },
      method: 'POST',
    })
  })

  it('rejects an unsafe panel ID before sending credentials or CSRF material', async () => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(executePanelAuthRequest({ csrfToken: 'secret', fetch: fetcher, operation: 'registration', panelId: '../admin', payload: {} })).rejects.toThrow('stable panel ID')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
