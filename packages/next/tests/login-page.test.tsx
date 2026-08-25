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
})
