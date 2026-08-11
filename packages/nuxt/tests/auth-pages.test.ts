import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { PanelAuthPage } from '../src/auth-page'
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
})
