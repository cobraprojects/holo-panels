import { mount, tick, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PanelLoginPage from '../src/LoginPage.svelte'

describe('SvelteKit panel login page', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('loads branding, links, theme, and width from the panel presentation endpoint', async () => {
    const fetcher = vi.fn(async () => Response.json({
      appearance: { colors: { primary: '#7c3aed' }, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
      brandName: 'Control Center',
      direction: 'ltr',
      forgotPasswordPath: '/admin/forgot-password',
      loginPath: '/admin/login',
      locale: 'en',
      registrationPath: '/admin/register',
      simplePageMaxContentWidth: 'screen-sm',
      theme: 'system',
    }))
    vi.stubGlobal('fetch', fetcher)
    const container = document.createElement('div')
    document.body.append(container)
    const instance = mount(PanelLoginPage, { props: { panelId: 'admin' }, target: container })
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(container.textContent).toContain('Control Center')
    expect(container.querySelector('a[href="/admin/forgot-password"]')).not.toBeNull()
    expect(container.querySelector('a[href="/admin/register"]')).not.toBeNull()
    expect(container.querySelector('main')?.getAttribute('style')).toContain('--hp-auth-max-width: 40rem')
    expect(fetcher).toHaveBeenCalledWith('/holo/panels/admin/auth/presentation', expect.any(Object))
    await unmount(instance)
  })

  it('submits once and renders invalid credentials as an authentication error', async () => {
    let resolveLogin: (response: Response) => void = () => {}
    const login = new Promise<Response>(resolve => {
      resolveLogin = resolve
    })
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => init?.method === 'POST'
      ? login
      : Response.json({
          appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
          brandName: 'Control Center',
          direction: 'ltr',
          forgotPasswordPath: null,
          loginPath: '/admin/login',
          locale: 'en',
          registrationPath: null,
          simplePageMaxContentWidth: 'screen-sm',
          theme: 'system',
        }))
    vi.stubGlobal('fetch', fetcher)
    document.cookie = 'XSRF-TOKEN=fresh-token'
    const container = document.createElement('div')
    document.body.append(container)
    const instance = mount(PanelLoginPage, { props: { panelId: 'admin' }, target: container })
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()
    const email = container.querySelector<HTMLInputElement>('input[name="email"]')!
    const password = container.querySelector<HTMLInputElement>('input[name="password"]')!
    const form = container.querySelector<HTMLFormElement>('form')!
    email.value = 'admin@example.test'
    email.dispatchEvent(new Event('input', { bubbles: true }))
    password.value = 'wrong'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()

    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    resolveLogin(Response.json({ code: 'invalid-credentials', error: 'Panel authentication request failed.' }, { status: 422 }))
    await login
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()
    expect(container.textContent).toContain('These credentials do not match our records.')
    await unmount(instance)
  })

  it('renders the login journey in the server-selected Arabic locale', async () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ar' })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} },
      brandName: 'Control Center',
      direction: 'rtl',
      forgotPasswordPath: null,
      loginPath: '/admin/login',
      locale: 'ar',
      registrationPath: null,
      simplePageMaxContentWidth: 'screen-sm',
      theme: 'system',
    })))
    const container = document.createElement('div')
    document.body.append(container)
    const instance = mount(PanelLoginPage, { props: { panelId: 'admin' }, target: container })
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()

    expect(container.textContent).toContain('تسجيل الدخول')
    expect(container.textContent).toContain('البريد الإلكتروني')
    await unmount(instance)
  })
})
