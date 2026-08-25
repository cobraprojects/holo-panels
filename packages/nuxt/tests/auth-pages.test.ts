import { createApp, nextTick, type Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PanelAuthPage } from '../src/auth-page'
import { PanelMultiFactorPage } from '../src/multi-factor-page'
import { PanelProfilePage } from '../src/profile-page'

const presentation = {
  appearance: { colors: { primary: '#123456' }, density: 'compact', fontFamily: 'Panel Sans', monoFontFamily: 'Panel Mono', serifFontFamily: 'Panel Serif', tokens: { 'radius-lg': '1.25rem' } },
  brandName: 'Control',
  forgotPasswordPath: '/cp/forgot-password',
  loginPath: '/cp/login',
  registrationPath: '/cp/register',
  simplePageMaxContentWidth: 'screen-sm',
  theme: 'system',
} as const

describe('Nuxt panel authentication pages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/presentation')) return Response.json(presentation)
      if (url.endsWith('/profile-read')) return Response.json({ values: { email: 'admin@example.test' } })
      if (url.endsWith('/mfa-status')) return Response.json({ enabled: false })
      return new Response(null, { status: 204 })
    }))
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
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(container.textContent).toContain('Control')
    expect(container.querySelector('main')?.dataset.density).toBe('compact')
    expect(container.querySelector('main')?.getAttribute('style')).toContain('--holo-color-primary: #123456')
    app.unmount()
  })
})
