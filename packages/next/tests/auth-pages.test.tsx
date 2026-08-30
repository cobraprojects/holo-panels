// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextPanelAuthPage } from '../src/auth-page'
import { NextPanelMultiFactorPage } from '../src/multi-factor-page'
import { NextPanelProfilePage } from '../src/profile-page'

const presentation = {
  appearance: { colors: { primary: '#123456' }, density: 'compact', fontFamily: 'Panel Sans', monoFontFamily: 'Panel Mono', serifFontFamily: 'Panel Serif', tokens: { 'radius-lg': '1.25rem' } },
  brandName: 'Control',
  forgotPasswordPath: '/cp/forgot-password',
  loginPath: '/cp/login',
  registrationPath: '/cp/register',
  simplePageMaxContentWidth: 'screen-sm',
  theme: 'system',
} as const

describe('Next panel authentication pages', () => {
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
    ['registration', <NextPanelAuthPage panelId="cp" type="registration" />, 'إنشاء حساب'],
    ['multi-factor', <NextPanelMultiFactorPage panelId="cp" />, 'المصادقة متعددة العوامل'],
    ['profile', <NextPanelProfilePage panelId="cp" />, 'الملف الشخصي'],
  ])('renders the %s journey in Arabic and RTL', async (_name, component, expected) => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ar' })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(component)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain(expected)
    expect(container.querySelector('main')).toMatchObject({ dir: 'rtl', lang: 'ar' })
    await act(async () => root.unmount())
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it.each([
    ['registration', <NextPanelAuthPage panelId="cp" type="registration" />],
    ['multi-factor', <NextPanelMultiFactorPage panelId="cp" />],
    ['profile', <NextPanelProfilePage panelId="cp" />],
  ])('renders the %s page from the panel-owned presentation', async (_name, component) => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(component)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('Control')
    expect(container.querySelector('main')?.dataset.density).toBe('compact')
    expect(container.querySelector('main')?.getAttribute('style')).toContain('--holo-color-primary: #123456')
    await act(async () => root.unmount())
  })
})
