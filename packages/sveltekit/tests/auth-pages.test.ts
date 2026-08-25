import { mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PanelAuthPage from '../src/AuthPage.svelte'
import PanelMultiFactorPage from '../src/MultiFactorPage.svelte'
import PanelProfilePage from '../src/ProfilePage.svelte'

const presentation = {
  appearance: { colors: { primary: '#123456' }, density: 'compact', fontFamily: 'Panel Sans', monoFontFamily: 'Panel Mono', serifFontFamily: 'Panel Serif', tokens: { 'radius-lg': '1.25rem' } },
  brandName: 'Control',
  forgotPasswordPath: '/cp/forgot-password',
  loginPath: '/cp/login',
  registrationPath: '/cp/register',
  simplePageMaxContentWidth: 'screen-sm',
  theme: 'system',
} as const

describe('SvelteKit panel authentication pages', () => {
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
