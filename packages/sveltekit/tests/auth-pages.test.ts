import { mount, unmount, type Component } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PanelAuthPage from '../src/AuthPage.svelte'
import PanelMultiFactorPage from '../src/MultiFactorPage.svelte'
import PanelProfilePage from '../src/ProfilePage.svelte'

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

describe('SvelteKit panel authentication pages', () => {
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

  async function verifyArabic<TProps extends Record<string, unknown>>(component: Component<TProps>, props: TProps, expected: string): Promise<void> {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ar' })
    const container = document.createElement('div')
    document.body.append(container)
    const instance = mount(component, { props, target: container })
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(container.textContent).toContain(expected)
    expect(container.querySelector('main')).toMatchObject({ dir: 'rtl', lang: 'ar' })
    await unmount(instance)
    container.remove()
  }

  it('renders registration, multi-factor, and profile journeys in Arabic and RTL', async () => {
    await verifyArabic(PanelAuthPage, { panelId: 'cp', type: 'registration' as const }, 'إنشاء حساب')
    await verifyArabic(PanelMultiFactorPage, { panelId: 'cp' }, 'المصادقة متعددة العوامل')
    await verifyArabic(PanelProfilePage, { panelId: 'cp' }, 'الملف الشخصي')
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  async function verifyPage(instance: object, container: HTMLDivElement): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(container.textContent).toContain('Control')
    expect(container.querySelector('main')?.dataset.density).toBe('compact')
    expect(container.querySelector('main')?.getAttribute('style')).toContain('--holo-color-primary: #123456')
    await unmount(instance)
  }

  it('renders registration from the panel-owned presentation', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    await verifyPage(mount(PanelAuthPage, { props: { panelId: 'cp', type: 'registration' }, target: container }), container)
  })

  it('renders multi-factor management from the panel-owned presentation', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    await verifyPage(mount(PanelMultiFactorPage, { props: { panelId: 'cp' }, target: container }), container)
  })

  it('renders profile management from the panel-owned presentation', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    await verifyPage(mount(PanelProfilePage, { props: { panelId: 'cp' }, target: container }), container)
  })
})
