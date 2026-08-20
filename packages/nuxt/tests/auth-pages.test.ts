import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { PanelAuthPage } from '../src/auth-page'
import { PanelLoginPage } from '../src/login-page'
import { PanelMultiFactorPage } from '../src/multi-factor-page'
import { PanelProfilePage } from '../src/profile-page'

describe('Nuxt panel authentication pages', () => {
  it('renders isolated framework-owned registration, MFA, and profile pages from panel configuration', async () => {
    const registration = await renderToString(createSSRApp(PanelAuthPage, { brandName: 'Control', loginPath: '/cp/login', panelId: 'cp', type: 'registration' }))
    const multiFactor = await renderToString(createSSRApp(PanelMultiFactorPage, { brandName: 'Control', panelId: 'cp' }))
    const profile = await renderToString(createSSRApp(PanelProfilePage, { brandName: 'Control', panelId: 'cp' }))

    expect(registration).toContain('Create an account')
    expect(registration).toContain('data-slot="input"')
    expect(registration).toContain('/cp/login')
    expect(multiFactor).toContain('Begin enrollment')
    expect(profile).toContain('Manage your account information')
  })

  it('applies complete appearance variables to every surface while preserving themeColors', async () => {
    const appearance = {
      colors: { primary: '#123456' },
      density: 'compact',
      fontFamily: 'Panel Sans',
      monoFontFamily: 'Panel Mono',
      serifFontFamily: 'Panel Serif',
      tokens: { 'radius-lg': '1.25rem' },
    } as const
    const pages = await Promise.all([
      renderToString(createSSRApp(PanelAuthPage, { appearance, brandName: 'Control', panelId: 'cp', type: 'registration' })),
      renderToString(createSSRApp(PanelLoginPage, { appearance, brandName: 'Control', panelId: 'cp' })),
      renderToString(createSSRApp(PanelMultiFactorPage, { appearance, brandName: 'Control', panelId: 'cp' })),
      renderToString(createSSRApp(PanelProfilePage, { appearance, brandName: 'Control', panelId: 'cp' })),
    ])
    const legacy = await renderToString(createSSRApp(PanelProfilePage, { brandName: 'Control', panelId: 'cp', themeColors: { primary: '#654321' } }))

    for (const page of pages) {
      expect(page).toContain('data-density="compact"')
      expect(page).toContain('--holo-color-primary:#123456')
      expect(page).toContain('--holo-radius-lg:1.25rem')
      expect(page).toContain('--holo-font-sans:Panel Sans')
      expect(page).toContain('--holo-font-mono:Panel Mono')
      expect(page).toContain('--holo-font-serif:Panel Serif')
    }
    expect(legacy).toContain('--holo-color-primary:#654321')
  })
})
