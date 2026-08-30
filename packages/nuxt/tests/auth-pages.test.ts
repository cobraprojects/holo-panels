import { createApp, nextTick, type Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PanelAuthPage } from '../src/auth-page'
import { PanelMultiFactorPage } from '../src/multi-factor-page'
import { PanelProfilePage } from '../src/profile-page'

const presentation = {
  appearance: { colors: { primary: '#123456' }, density: 'compact', fontFamily: 'Panel Sans', monoFontFamily: 'Panel Mono', serifFontFamily: 'Panel Serif', tokens: { 'radius-lg': '1.25rem' } },
  brandName: 'Control',
  direction: 'rtl',
  forgotPasswordPath: '/cp/forgot-password',
  loginPath: '/cp/login',
  locale: 'ar',
  registrationPath: '/cp/register',
  simplePageMaxContentWidth: 'screen-sm',
  theme: 'system',
} as const

async function settle(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  await nextTick()
}

describe('Nuxt panel authentication pages', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'en' })
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/presentation')) return Response.json(presentation)
      if (url.endsWith('/profile-read')) return Response.json({ values: { email: 'admin@example.test' } })
      if (url.endsWith('/mfa-status')) return Response.json({ enabled: false })
      return new Response(null, { status: 204 })
    }))
  })

  it.each([
    ['registration', PanelAuthPage, { panelId: 'cp', type: 'registration' }, 'إنشاء حساب'],
    ['multi-factor', PanelMultiFactorPage, { panelId: 'cp' }, 'المصادقة متعددة العوامل'],
    ['profile', PanelProfilePage, { panelId: 'cp' }, 'الملف الشخصي'],
  ])('renders the %s journey in Arabic and RTL', async (_name, component, props, expected) => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ar' })
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(component as Component, props)
    app.mount(container)
    await settle()

    expect(container.textContent).toContain(expected)
    expect(container.querySelector('main')).toMatchObject({ dir: 'rtl', lang: 'ar' })
    app.unmount()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it.each([
    ['registration', PanelAuthPage, { panelId: 'cp', type: 'registration' }],
    ['multi-factor', PanelMultiFactorPage, { panelId: 'cp' }],
    ['profile', PanelProfilePage, { panelId: 'cp' }],
  ])('renders the %s page from the panel-owned presentation', async (_name, component, props) => {
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(component as Component, props)
    app.mount(container)
    await settle()

    expect(container.textContent).toContain('Control')
    expect(container.querySelector('main')?.dataset.density).toBe('compact')
    expect(container.querySelector('main')?.getAttribute('style')).toContain('--holo-color-primary: #123456')
    app.unmount()
  })

  it('exposes generated recovery codes as a labeled region', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/presentation')) return Response.json(presentation)
      if (url.endsWith('/mfa-status')) return Response.json({ enabled: false })
      if (url.endsWith('/mfa-enrollment-begin')) return Response.json({ manualKey: 'PANELSECRET' })
      if (url.endsWith('/mfa-enrollment-confirm')) return Response.json({ recoveryCodes: ['first-code', 'second-code'] })
      return new Response(null, { status: 204 })
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelMultiFactorPage, { panelId: 'cp' })
    app.mount(container)
    await settle()

    const begin = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('بدء التسجيل'))
    begin?.click()
    await settle()
    const code = container.querySelector<HTMLInputElement>('#cp-code')
    if (!code) throw new Error('The authentication code field was not rendered')
    code.value = '123456'
    code.dispatchEvent(new Event('input', { bubbles: true }))
    code.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()

    expect(container.querySelector('section[aria-labelledby="cp-recovery-codes-heading"]')?.textContent).toContain('first-code')
    app.unmount()
  })
})
