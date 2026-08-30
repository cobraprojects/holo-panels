import { afterEach, describe, expect, it, vi } from 'vitest'
import { executePanelLogin, panelLoginErrorMessage } from '../src/auth/login'
import { loadPanelAuthPresentation } from '../src/auth/operation'

describe('panel login client boundary', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('localizes login failures without exposing server messages', () => {
    expect(panelLoginErrorMessage({ error: 'authentication', ok: false, status: 422, url: null }, 'ar')).toBe('بيانات الاعتماد هذه غير صحيحة.')
    expect(panelLoginErrorMessage({ error: 'security', ok: false, status: 419, url: null }, 'ar')).toBe('انتهت صلاحية جلستك. حدّث الصفحة وحاول مرة أخرى.')
    expect(panelLoginErrorMessage({ error: 'request', ok: false, status: 500, url: null }, 'ar')).toBe('تعذر تسجيل الدخول. حاول مرة أخرى.')
  })

  it('posts only fixed credentials with CSRF to the compiled panel endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }))
    await expect(executePanelLogin({
      credentials: { email: ' admin@example.com ', password: 'secret' },
      csrfToken: 'csrf-token',
      fetch: fetcher,
      panelId: 'admin',
    })).resolves.toEqual({ error: null, ok: true, status: 200, url: null })

    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/login', {
      body: JSON.stringify({ credentials: { email: 'admin@example.com', password: 'secret' } }),
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      method: 'POST',
    })
  })

  it('rejects invalid panel IDs and empty credentials before the network', async () => {
    const fetcher = vi.fn()
    await expect(executePanelLogin({ credentials: { email: '', password: '' }, csrfToken: '', fetch: fetcher, panelId: 'admin' }))
      .resolves.toEqual({ error: 'authentication', ok: false, status: 422, url: null })
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
    })).resolves.toEqual({ error: null, ok: true, status: 200, url: 'https://example.test/admin' })

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
      body: JSON.stringify({
        credentials: { email: 'super@example.test', password: 'panel-secret' },
        destination: '/admin',
      }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': 'fresh-token',
      },
      method: 'POST',
    })
  })

  it('stops after one CSRF refresh and reports the second failure as a security error', async () => {
    let cookie = 'XSRF-TOKEN=stale-token'
    vi.stubGlobal('document', {
      get cookie() {
        return cookie
      },
    })
    vi.stubGlobal('location', { href: 'https://example.test/admin/login' })
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'GET') {
        cookie = 'XSRF-TOKEN=fresh-token'
        return new Response(null, { status: 200 })
      }
      return new Response('CSRF token mismatch.', { status: 419 })
    })

    await expect(executePanelLogin({
      credentials: { email: 'super@example.test', password: 'panel-secret' },
      csrfToken: 'stale-token',
      fetch: fetcher,
      panelId: 'admin',
    })).resolves.toEqual({ error: 'security', ok: false, status: 419, url: null })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('reports rejected credentials as an authentication error', async () => {
    const fetcher = vi.fn(async () => Response.json({ code: 'invalid-credentials', error: 'Panel authentication request failed.' }, { status: 422 }))

    await expect(executePanelLogin({
      credentials: { email: 'super@example.test', password: 'wrong' },
      csrfToken: 'fresh-token',
      fetch: fetcher,
      panelId: 'admin',
    })).resolves.toEqual({ error: 'authentication', ok: false, status: 422, url: null })
  })

  it('reports a SvelteKit validation action envelope as an authentication error', async () => {
    const failure = {
      bag: 'default',
      errors: { email: ['These credentials do not match our records.'] },
      message: 'email: These credentials do not match our records.',
      ok: false,
      status: 422,
      valid: false,
      values: {},
    }
    const fetcher = vi.fn(async () => Response.json({ data: JSON.stringify(failure), status: 422, type: 'failure' }))

    await expect(executePanelLogin({
      credentials: { email: 'super@example.test', password: 'wrong' },
      csrfToken: 'fresh-token',
      fetch: fetcher,
      panelId: 'admin',
    })).resolves.toEqual({ error: 'authentication', ok: false, status: 422, url: null })
  })

  it('does not misreport other validation failures as invalid credentials', async () => {
    const fetcher = vi.fn(async () => Response.json({ code: 'profile-input-invalid', error: 'Panel authentication request failed.' }, { status: 422 }))

    await expect(executePanelLogin({
      credentials: { email: 'super@example.test', password: 'panel-secret' },
      csrfToken: 'fresh-token',
      fetch: fetcher,
      panelId: 'admin',
    })).resolves.toEqual({ error: 'request', ok: false, status: 422, url: null })
  })

  it('loads the panel-owned authentication presentation without a mutation token', async () => {
    const presentation = {
      appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
      brandName: 'Control Center',
      direction: 'ltr',
      forgotPasswordPath: '/admin/password-reset/request',
      loginPath: '/admin/login',
      locale: 'en',
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
