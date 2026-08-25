import { afterEach, describe, expect, it, vi } from 'vitest'
import { executePanelLogin } from '../src/auth/login'
import { loadPanelAuthPresentation } from '../src/auth/operation'

describe('panel login client boundary', () => {
  afterEach(() => vi.unstubAllGlobals())

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

  it('refreshes a stale CSRF cookie and retries the login once', async () => {
    let cookie = 'XSRF-TOKEN=stale-token'
    vi.stubGlobal('document', {
      get cookie() {
        return cookie
      },
    })
    vi.stubGlobal('location', { href: 'https://example.test/admin/login?next=%2Fadmin' })
    const success = new Response(null, { status: 200 })
    Object.defineProperty(success, 'url', { value: 'https://example.test/admin' })
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'GET') {
        cookie = 'XSRF-TOKEN=fresh-token'
        return new Response(null, { status: 200 })
      }
      return fetcher.mock.calls.length === 1
        ? new Response('CSRF token mismatch.', { status: 419 })
        : success
    })

    await expect(executePanelLogin({
      credentials: { email: 'super@example.test', password: 'panel-secret' },
      csrfToken: 'stale-token',
      fetch: fetcher,
      panelId: 'admin',
    })).resolves.toEqual({ ok: true, url: 'https://example.test/admin' })

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[1]).toEqual([
      'https://example.test/admin/login?next=%2Fadmin',
      {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'text/html' },
        method: 'GET',
      },
    ])
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'fresh-token',
      },
      method: 'POST',
    })
  })

  it('loads the panel-owned authentication presentation without a mutation token', async () => {
    const presentation = {
      appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
      brandName: 'Control Center',
      forgotPasswordPath: '/admin/password-reset/request',
      loginPath: '/admin/login',
      registrationPath: '/admin/register',
      simplePageMaxContentWidth: 'screen-sm',
      theme: 'system',
    } as const
    const fetcher = vi.fn(async () => Response.json(presentation))

    await expect(loadPanelAuthPresentation('admin', fetcher)).resolves.toEqual(presentation)
    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/presentation', {
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': '' },
      method: 'GET',
    })
  })
})
