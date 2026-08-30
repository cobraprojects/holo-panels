// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextPanelLoginPage } from '../src/login-page'

describe('Next panel login page', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('loads branding, links, theme, and width from the panel presentation endpoint', async () => {
    const fetcher = vi.fn(async () => Response.json({
      appearance: { colors: { primary: '#7c3aed' }, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
      brandName: 'Control Center',
      forgotPasswordPath: '/admin/forgot-password',
      loginPath: '/admin/login',
      registrationPath: '/admin/register',
      simplePageMaxContentWidth: 'screen-sm',
      theme: 'system',
    }))
    vi.stubGlobal('fetch', fetcher)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<NextPanelLoginPage panelId="admin" />)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('Control Center')
    expect(container.querySelector('a[href="/admin/forgot-password"]')).not.toBeNull()
    expect(container.querySelector('a[href="/admin/register"]')).not.toBeNull()
    expect(container.querySelector('main')?.getAttribute('style')).toContain('--hp-auth-max-width: 40rem')
    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/presentation', expect.any(Object))
    await act(async () => root.unmount())
  })

  it('submits once and renders invalid credentials as an authentication error', async () => {
    let resolveLogin: (response: Response) => void = () => {}
    const login = new Promise<Response>(resolve => {
      resolveLogin = resolve
    })
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') return login
      return Response.json({
        appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
        brandName: 'Control Center',
        forgotPasswordPath: null,
        loginPath: '/admin/login',
        registrationPath: null,
        simplePageMaxContentWidth: 'screen-sm',
        theme: 'system',
      })
    })
    vi.stubGlobal('fetch', fetcher)
    document.cookie = 'XSRF-TOKEN=fresh-token'
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<NextPanelLoginPage panelId="admin" />)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })
    const email = container.querySelector<HTMLInputElement>('input[name="email"]')!
    const password = container.querySelector<HTMLInputElement>('input[name="password"]')!
    const form = container.querySelector<HTMLFormElement>('form')!
    email.value = 'admin@example.test'
    password.value = 'wrong'

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)

    await act(async () => {
      resolveLogin(Response.json({ code: 'invalid-credentials', error: 'Panel authentication request failed.' }, { status: 422 }))
      await login
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('These credentials do not match our records.')
    await act(async () => root.unmount())
  })

  it('renders the login journey in Arabic from the browser locale', async () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ar' })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
      brandName: 'Control Center',
      forgotPasswordPath: null,
      loginPath: '/admin/login',
      registrationPath: null,
      simplePageMaxContentWidth: 'screen-sm',
      theme: 'system',
    })))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<NextPanelLoginPage panelId="admin" />)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('تسجيل الدخول')
    expect(container.textContent).toContain('البريد الإلكتروني')
    await act(async () => root.unmount())
  })
})
