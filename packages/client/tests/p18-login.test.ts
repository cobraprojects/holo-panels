import { describe, expect, it, vi } from 'vitest'
import { executePanelLogin } from '../src/auth/login'

describe('panel login client boundary', () => {
  it('posts only fixed credentials with CSRF to the compiled panel endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }))
    await executePanelLogin({
      credentials: { email: ' admin@example.com ', password: 'secret' },
      csrfToken: 'csrf-token',
      fetch: fetcher,
      panelId: 'admin',
    })

    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/login', {
      body: JSON.stringify({ credentials: { email: 'admin@example.com', password: 'secret' } }),
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-token' },
      method: 'POST',
    })
  })

  it('rejects invalid panel IDs and empty credentials before the network', async () => {
    const fetcher = vi.fn()
    await expect(executePanelLogin({ credentials: { email: '', password: '' }, csrfToken: '', fetch: fetcher, panelId: 'admin' }))
      .resolves.toEqual({ ok: false, url: null })
    await expect(executePanelLogin({ credentials: { email: 'a@b.test', password: 'x' }, csrfToken: '', fetch: fetcher, panelId: '../admin' }))
      .rejects.toThrow('stable panel ID')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
