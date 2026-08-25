import { mount, unmount } from 'svelte'
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
      forgotPasswordPath: '/admin/forgot-password',
      loginPath: '/admin/login',
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
})
